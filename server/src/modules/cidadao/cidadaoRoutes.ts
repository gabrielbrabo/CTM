import bcrypt from "bcryptjs";
import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { Types } from "mongoose";
import { z } from "zod";
import { semTenant } from "../../context/tenant";
import { protectCidadao } from "../../middleware/auth";
import { Cidadao, CidadaoDoc } from "../../models/Cidadao";
import { Mensagem, MensagemDoc } from "../../models/Mensagem";
import { Municipio } from "../../models/Municipio";
import { Notificacao } from "../../models/Notificacao";
import { Orgao } from "../../models/Orgao";
import { HttpError, naoAutenticado, naoEncontrado } from "../../utils/httpError";
import { urlBrasao, urlLogoOrgao } from "../../utils/imagens";
import {
  REFRESH_COOKIE_CIDADAO,
  gerarAccessTokenCidadao,
  gerarRefreshTokenCidadao,
  opcoesCookieCidadao,
  verificarRefreshToken,
} from "../../utils/tokens";

/**
 * Conta da populacao no portal (/api/cidadao).
 * Ler o portal NAO precisa de conta; a conta serve para:
 * - mandar mensagens aos orgaos e acompanhar as respostas
 * - ativar notificacoes de um municipio (sininho)
 */
const router = Router();

const limite = (max: number, minutos: number, msg: string) =>
  rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    message: { message: msg },
  });
const limiteConta = limite(20, 15, "Muitas tentativas. Tente novamente em alguns minutos.");
const limiteMensagem = limite(10, 60, "Você enviou muitas mensagens. Tente novamente mais tarde.");

function cidadaoPublico(c: CidadaoDoc) {
  return { id: String(c._id), nome: c.nome, email: c.email, telefone: c.telefone ?? null };
}

function entrar(res: Response, c: CidadaoDoc) {
  const id = String(c._id);
  res.cookie(REFRESH_COOKIE_CIDADAO, gerarRefreshTokenCidadao(id, c.tokenVersion), opcoesCookieCidadao());
  return { accessToken: gerarAccessTokenCidadao(id, c.tokenVersion), cidadao: cidadaoPublico(c) };
}

// ---------- Cadastro e login ----------

const cadastroSchema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  telefone: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(30).optional()),
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres").max(100),
});

// POST /api/cidadao/auth/cadastro
router.post("/auth/cadastro", limiteConta, async (req: Request, res: Response) => {
  const dados = cadastroSchema.parse(req.body);
  if (await Cidadao.exists({ email: dados.email })) throw new HttpError(409, "Já existe uma conta com este e-mail. Entre com sua senha.");
  const c = await Cidadao.create({ nome: dados.nome, email: dados.email, telefone: dados.telefone, senhaHash: await bcrypt.hash(dados.senha, 12) });
  res.status(201).json(entrar(res, c));
});

// POST /api/cidadao/auth/login
router.post("/auth/login", limiteConta, async (req: Request, res: Response) => {
  const { email, senha } = z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido"), senha: z.string().min(1) }).parse(req.body);
  const c = await Cidadao.findOne({ email }).select("+senhaHash");
  const ok = c ? await bcrypt.compare(senha, c.senhaHash) : false;
  if (!c || !ok || !c.ativo) throw naoAutenticado("E-mail ou senha incorretos");
  c.ultimoLogin = new Date();
  await c.save();
  res.json(entrar(res, c));
});

// POST /api/cidadao/auth/refresh
router.post("/auth/refresh", async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_CIDADAO];
  if (!token) throw naoAutenticado();
  let payload;
  try {
    payload = verificarRefreshToken(token);
  } catch {
    throw naoAutenticado("Sessao expirada");
  }
  if (payload.tp !== "cidadao") throw naoAutenticado();
  const c = await Cidadao.findById(payload.sub);
  if (!c || !c.ativo || c.tokenVersion !== payload.tv) throw naoAutenticado("Sessao invalida");
  res.json(entrar(res, c));
});

// POST /api/cidadao/auth/logout
router.post("/auth/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_CIDADAO];
  if (token) {
    try {
      const payload = verificarRefreshToken(token);
      if (payload.tp === "cidadao") await Cidadao.updateOne({ _id: payload.sub }, { $inc: { tokenVersion: 1 } });
    } catch {
      // token invalido: so limpa o cookie
    }
  }
  const { maxAge: _ignorar, ...opcoes } = opcoesCookieCidadao();
  res.clearCookie(REFRESH_COOKIE_CIDADAO, opcoes);
  res.json({ ok: true });
});

// ---------- Daqui para baixo precisa estar logado ----------
router.use(protectCidadao);

// GET /api/cidadao/eu -> dados, municipios seguidos e contadores do sininho
router.get("/eu", async (req: Request, res: Response) => {
  const c = req.cidadao!;
  const [municipios, notificacoesNaoLidas, mensagensNaoLidas] = await semTenant(() =>
    Promise.all([
      Municipio.find({ _id: { $in: c.inscricoes.map((i) => i.municipioId) } }).select("slug nome uf brasaoKey brasaoAtualizadoEm"),
      Notificacao.countDocuments({ cidadaoId: c._id, lida: false }),
      Mensagem.countDocuments({ cidadaoId: c._id, lidaPeloCidadao: false }),
    ])
  );
  res.json({
    cidadao: cidadaoPublico(c),
    seguindo: municipios.map((m) => ({ id: String(m._id), slug: m.slug, nome: m.nome, uf: m.uf, brasaoUrl: urlBrasao(m) })),
    notificacoesNaoLidas,
    mensagensNaoLidas,
  });
});

// ---------- Notificacoes por municipio ----------

// POST /api/cidadao/inscricoes { municipio: "sao-romao" } -> ativa
router.post("/inscricoes", async (req: Request, res: Response) => {
  const { municipio } = z.object({ municipio: z.string().trim().min(1) }).parse(req.body);
  const m = await Municipio.findOne({ slug: municipio, ativo: { $ne: false } });
  if (!m) throw naoEncontrado("Município não encontrado");
  await Cidadao.updateOne(
    { _id: req.cidadao!._id, "inscricoes.municipioId": { $ne: m._id } },
    { $push: { inscricoes: { municipioId: m._id, desde: new Date() } } }
  );
  res.json({ ok: true, seguindo: true });
});

// DELETE /api/cidadao/inscricoes/:municipio -> desativa
router.delete("/inscricoes/:municipio", async (req: Request, res: Response) => {
  const m = await Municipio.findOne({ slug: String(req.params.municipio) });
  if (m) await Cidadao.updateOne({ _id: req.cidadao!._id }, { $pull: { inscricoes: { municipioId: m._id } } });
  res.json({ ok: true, seguindo: false });
});

// GET /api/cidadao/notificacoes?pagina=1
router.get("/notificacoes", async (req: Request, res: Response) => {
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const porPagina = 20;
  const filtro = { cidadaoId: req.cidadao!._id };
  const [itens, total, naoLidas] = await Promise.all([
    Notificacao.find(filtro).sort({ criadaEm: -1 }).skip((pagina - 1) * porPagina).limit(porPagina).lean(),
    Notificacao.countDocuments(filtro),
    Notificacao.countDocuments({ ...filtro, lida: false }),
  ]);
  res.json({
    total,
    naoLidas,
    pagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    itens: itens.map((n) => ({ id: String(n._id), tipo: n.tipo, titulo: n.titulo, texto: n.texto ?? null, link: n.link, lida: n.lida, criadaEm: n.criadaEm })),
  });
});

// POST /api/cidadao/notificacoes/lidas { ids?: [] } -> marca como lidas (sem ids = todas)
router.post("/notificacoes/lidas", async (req: Request, res: Response) => {
  const { ids } = z.object({ ids: z.array(z.string()).max(100).optional() }).parse(req.body ?? {});
  const filtro: Record<string, unknown> = { cidadaoId: req.cidadao!._id, lida: false };
  if (ids?.length) filtro._id = { $in: ids.filter((i) => Types.ObjectId.isValid(i)) };
  await Notificacao.updateMany(filtro, { $set: { lida: true } });
  res.json({ ok: true });
});

// ---------- Mensagens aos orgaos ----------

async function nomesOrgaos(ids: unknown[]) {
  const orgaos = await Orgao.find({ _id: { $in: ids } }).select("nome tipo logoKey logoAtualizadoEm municipioId");
  const muns = await Municipio.find({ _id: { $in: orgaos.map((o) => o.municipioId) } }).select("nome uf slug");
  const mMap = new Map(muns.map((m) => [String(m._id), m]));
  return new Map(
    orgaos.map((o) => {
      const m = mMap.get(String(o.municipioId));
      return [String(o._id), { nome: o.nome, tipo: o.tipo, logoUrl: urlLogoOrgao(o), municipio: m ? `${m.nome}/${m.uf}` : "", municipioSlug: m?.slug ?? "" }];
    })
  );
}

function mensagemParaJson(m: MensagemDoc, orgao?: { nome: string; tipo: string; logoUrl: string | null; municipio: string; municipioSlug: string }) {
  return {
    id: String(m._id),
    protocolo: m.protocolo,
    assunto: m.assunto,
    situacao: m.situacao,
    lida: m.lidaPeloCidadao,
    criadaEm: (m as unknown as { createdAt: Date }).createdAt,
    ultimaAtividade: m.ultimaAtividade,
    orgao: orgao ?? null,
    respostas: m.respostas.map((r) => ({ autor: r.autor, nome: r.nome, texto: r.texto, data: r.data })),
  };
}

// Numero de protocolo: ano + sequencia no municipio (ex.: 2026.00042)
export async function gerarProtocolo(municipioId: Types.ObjectId) {
  const ano = new Date().getFullYear();
  const n = await Mensagem.countDocuments({ municipioId, protocolo: new RegExp(`^${ano}\\.`) });
  return `${ano}.${String(n + 1).padStart(5, "0")}`;
}

// GET /api/cidadao/mensagens -> minhas mensagens
router.get("/mensagens", async (req: Request, res: Response) => {
  const lista = await semTenant(() => Mensagem.find({ cidadaoId: req.cidadao!._id }).sort({ ultimaAtividade: -1 }).limit(100));
  const orgaos = await semTenant(() => nomesOrgaos(lista.map((m) => m.orgaoId)));
  res.json(lista.map((m) => ({ ...mensagemParaJson(m, orgaos.get(String(m.orgaoId))), respostas: undefined, total: m.respostas.length })));
});

const novaSchema = z.object({
  orgaoId: z.string().refine((v) => Types.ObjectId.isValid(v), "Órgão inválido"),
  assunto: z.string().trim().min(3, "Informe o assunto").max(150),
  texto: z.string().trim().min(5, "Escreva sua mensagem").max(5000),
});

// POST /api/cidadao/mensagens -> nova mensagem para um orgao
router.post("/mensagens", limiteMensagem, async (req: Request, res: Response) => {
  const dados = novaSchema.parse(req.body);
  const c = req.cidadao!;
  const m = await semTenant(async () => {
    const orgao = await Orgao.findOne({ _id: dados.orgaoId, contratante: true, situacao: "ativo" });
    if (!orgao) throw naoEncontrado("Órgão não encontrado");
    if (orgao.recebeMensagens === false) throw new HttpError(400, "Este órgão não está recebendo mensagens pelo portal");
    return Mensagem.create({
      municipioId: orgao.municipioId,
      orgaoId: orgao._id,
      cidadaoId: c._id,
      protocolo: await gerarProtocolo(orgao.municipioId),
      assunto: dados.assunto,
      respostas: [{ autor: "cidadao", nome: c.nome, texto: dados.texto, data: new Date() }],
    });
  });
  const orgaos = await semTenant(() => nomesOrgaos([m.orgaoId]));
  res.status(201).json(mensagemParaJson(m, orgaos.get(String(m.orgaoId))));
});

async function minhaMensagem(req: Request) {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw naoEncontrado("Mensagem não encontrada");
  const m = await semTenant(() => Mensagem.findOne({ _id: id, cidadaoId: req.cidadao!._id }));
  if (!m) throw naoEncontrado("Mensagem não encontrada");
  return m;
}

// GET /api/cidadao/mensagens/:id -> conversa (marca como lida)
router.get("/mensagens/:id", async (req: Request, res: Response) => {
  const m = await minhaMensagem(req);
  if (!m.lidaPeloCidadao) {
    m.lidaPeloCidadao = true;
    await semTenant(() => m.save());
    // As notificacoes desta resposta tambem ficam lidas
    await Notificacao.updateMany({ cidadaoId: req.cidadao!._id, link: `/minha-conta/mensagens/${m._id}` }, { $set: { lida: true } });
  }
  const orgaos = await semTenant(() => nomesOrgaos([m.orgaoId]));
  res.json(mensagemParaJson(m, orgaos.get(String(m.orgaoId))));
});

// POST /api/cidadao/mensagens/:id/responder { texto }
router.post("/mensagens/:id/responder", limiteMensagem, async (req: Request, res: Response) => {
  const { texto } = z.object({ texto: z.string().trim().min(2, "Escreva a resposta").max(5000) }).parse(req.body);
  const m = await minhaMensagem(req);
  if (m.situacao === "encerrada") throw new HttpError(400, "Esta conversa foi encerrada. Envie uma nova mensagem.");
  m.respostas.push({ autor: "cidadao", nome: req.cidadao!.nome, texto, data: new Date() });
  m.situacao = "aberta";
  m.lidaPeloOrgao = false;
  m.ultimaAtividade = new Date();
  await semTenant(() => m.save());
  const orgaos = await semTenant(() => nomesOrgaos([m.orgaoId]));
  res.json(mensagemParaJson(m, orgaos.get(String(m.orgaoId))));
});

export default router;
