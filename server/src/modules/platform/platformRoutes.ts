import bcrypt from "bcryptjs";
import { NextFunction, Request, Response, Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { semTenant } from "../../context/tenant";
import { protect, requirePlatformAdmin } from "../../middleware/auth";
import { Municipio } from "../../models/Municipio";
import { Orgao, SITUACOES_ORGAO, TIPOS_CONTRATANTE, nomePadraoOrgao } from "../../models/Orgao";
import { PAPEIS, Usuario, UsuarioDoc } from "../../models/Usuario";
import { registrarAuditoria } from "../../utils/audit";
import { HttpError, naoEncontrado } from "../../utils/httpError";
import { trocarImagem, uploadImagem, urlBrasao, urlLogoOrgao } from "../../utils/imagens";
import { slugify } from "../../utils/slug";
import { listarHistorico } from "../historico/historico";
import { apagarArquivo } from "../../utils/storage";

/**
 * Area da plataforma (GADZ / superadmin).
 * Aqui se cadastram municipios, orgaos contratantes (Prefeitura/Camara),
 * contratos e o administrador de cada orgao.
 */
const router = Router();

router.use(protect, requirePlatformAdmin);
// Tudo daqui pra baixo roda sem isolamento de municipio
router.use((_req: Request, _res: Response, next: NextFunction) => semTenant(() => next()));

// ---------- helpers de validacao ----------

// Escapa caracteres especiais para usar texto do usuario dentro de RegExp
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const igualSemCaixa = (t: string) => new RegExp(`^${escapar(t)}$`, "i");

// Campo de formulario vazio ("") vira undefined
const vazioParaUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
const texto = () => z.preprocess(vazioParaUndef, z.string().trim().optional());
const data = () => z.preprocess(vazioParaUndef, z.coerce.date().optional());
const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), "Id invalido");
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

const municipioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do municipio"),
  uf: z.string().trim().toUpperCase().pipe(z.enum(UFS, { message: "UF invalida" })),
});

const dadosOrgaoSchema = z.object({
  nome: texto(),
  sigla: texto(),
  cnpj: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\D/g, "") || undefined : vazioParaUndef(v)),
    z.string().length(14, "CNPJ deve ter 14 digitos").optional()
  ),
  situacao: z.enum(SITUACOES_ORGAO).optional(),
  contatos: z
    .object({
      email: z.preprocess(vazioParaUndef, z.string().email("E-mail de contato invalido").optional()),
      telefone: texto(),
      site: texto(),
      endereco: texto(),
      horario: texto(),
      whatsapp: texto(),
    })
    .optional(),
  recebeMensagens: z.boolean().optional(),
  responsavel: z.object({ nome: texto(), cargo: texto() }).optional(),
  plenario: texto(), // so Camara
  contrato: z
    .object({
      numero: texto(),
      inicio: data(),
      fim: data(),
      // Valor em reais no formulario; gravado em centavos
      valorMensal: z.preprocess(vazioParaUndef, z.coerce.number().nonnegative().optional()),
      observacoes: texto(),
    })
    .optional(),
});

const novoUsuarioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.string().trim().toLowerCase().email("E-mail invalido"),
  senha: z.preprocess(vazioParaUndef, z.string().min(8, "Senha com no minimo 8 caracteres").optional()),
  papel: z.enum(PAPEIS).default("admin_orgao"),
});

const novoOrgaoSchema = dadosOrgaoSchema
  .extend({
    tipo: z.enum(TIPOS_CONTRATANTE),
    municipioId: z.preprocess(vazioParaUndef, objectId.optional()),
    novoMunicipio: municipioSchema.optional(),
    // Administrador: um usuario ja cadastrado (usuarioId) OU os dados de um novo
    admin: z.union([
      z.object({ usuarioId: objectId }),
      novoUsuarioSchema.omit({ papel: true }),
    ]),
  })
  .refine((d) => d.municipioId || d.novoMunicipio, {
    message: "Escolha um municipio ou cadastre um novo",
    path: ["municipioId"],
  });

function contratoParaBanco(c?: z.infer<typeof dadosOrgaoSchema>["contrato"]) {
  if (!c) return undefined;
  const { valorMensal, ...resto } = c;
  return {
    ...resto,
    valorMensalCentavos: valorMensal !== undefined ? Math.round(valorMensal * 100) : undefined,
  };
}

// Slug unico: "sao-romao"; se ja existir, "sao-romao-mg"; depois "sao-romao-mg-2"...
async function gerarSlugMunicipio(nome: string, uf: string): Promise<string> {
  const base = slugify(nome);
  const candidatos = [base, `${base}-${uf.toLowerCase()}`];
  for (const c of candidatos) {
    if (!(await Municipio.exists({ slug: c }))) return c;
  }
  let n = 2;
  while (await Municipio.exists({ slug: `${candidatos[1]}-${n}` })) n++;
  return `${candidatos[1]}-${n}`;
}

// Slug valido: so letras minusculas, numeros e hifen (ex.: "sao-romao-mg")
const SLUG_VALIDO = /^[a-z0-9-]+$/;

/**
 * Municipios antigos podem ter slug invalido (ex.: "municipio de teste").
 * Gera um novo slug valido e unico; retorna o slug atual se ja estiver ok.
 */
async function slugCorrigido(m: { _id: unknown; slug?: string | null; nome: string; uf: string }): Promise<string | null> {
  if (m.slug && SLUG_VALIDO.test(m.slug)) return null;
  const base = slugify(m.nome) || "municipio";
  const candidatos = [base, `${base}-${m.uf.toLowerCase()}`];
  for (const c of candidatos) {
    if (!(await Municipio.exists({ slug: c, _id: { $ne: m._id } }))) return c;
  }
  let n = 2;
  while (await Municipio.exists({ slug: `${candidatos[1]}-${n}`, _id: { $ne: m._id } })) n++;
  return `${candidatos[1]}-${n}`;
}

async function buscarOuCriarMunicipio(req: Request, dados: z.infer<typeof municipioSchema>) {
  const existente = await Municipio.findOne({
    nome: igualSemCaixa(dados.nome),
    uf: dados.uf,
  });
  if (existente) return existente;
  const municipio = await Municipio.create({ ...dados, slug: await gerarSlugMunicipio(dados.nome, dados.uf) });
  await registrarAuditoria(req, {
    acao: "municipio.criar",
    entidade: "Municipio",
    entidadeId: municipio._id,
    municipioId: municipio._id,
    diff: dados,
  });
  return municipio;
}

// Cria o usuario ou, se o e-mail ja existir, so adiciona o vinculo com o orgao
async function vincularUsuario(
  req: Request,
  orgao: { _id: Types.ObjectId; municipioId: Types.ObjectId },
  dados: z.infer<typeof novoUsuarioSchema>
): Promise<{ usuario: UsuarioDoc; criado: boolean }> {
  let usuario = await Usuario.findOne({ email: dados.email });
  let criado = false;

  if (!usuario) {
    if (!dados.senha) throw new HttpError(400, "Informe uma senha inicial para o novo usuario");
    usuario = await Usuario.create({
      nome: dados.nome,
      email: dados.email,
      senhaHash: await bcrypt.hash(dados.senha, 12),
      vinculos: [],
    });
    criado = true;
  }

  const jaTem = usuario.vinculos.some((v) => String(v.orgaoId) === String(orgao._id));
  if (jaTem) {
    usuario.vinculos = usuario.vinculos.map((v) =>
      String(v.orgaoId) === String(orgao._id) ? { ...v, papel: dados.papel } : v
    );
  } else {
    usuario.vinculos.push({ municipioId: orgao.municipioId, orgaoId: orgao._id, papel: dados.papel });
  }
  await usuario.save();

  await registrarAuditoria(req, {
    acao: criado ? "usuario.criar" : "usuario.vincular",
    entidade: "Usuario",
    entidadeId: usuario._id,
    municipioId: orgao.municipioId,
    diff: { email: dados.email, orgaoId: String(orgao._id), papel: dados.papel },
  });
  return { usuario, criado };
}

function orgaoParaJson(o: InstanceType<typeof Orgao>, municipio?: { _id: unknown; nome: string; uf: string; slug: string } | null) {
  const contrato = o.contrato
    ? {
        numero: o.contrato.numero ?? null,
        inicio: o.contrato.inicio ?? null,
        fim: o.contrato.fim ?? null,
        valorMensal: o.contrato.valorMensalCentavos != null ? o.contrato.valorMensalCentavos / 100 : null,
        observacoes: o.contrato.observacoes ?? null,
      }
    : null;
  return {
    id: String(o._id),
    tipo: o.tipo,
    nome: o.nome,
    sigla: o.sigla ?? null,
    cnpj: o.cnpj ?? null,
    logoUrl: urlLogoOrgao(o),
    situacao: o.situacao,
    contatos: o.contatos ?? {},
    responsavel: o.responsavel ?? {},
    plenario: o.plenario ?? null,
    recebeMensagens: o.recebeMensagens !== false,
    contrato,
    criadoEm: (o as unknown as { createdAt?: Date }).createdAt ?? null,
    municipio: municipio
      ? { id: String(municipio._id), nome: municipio.nome, uf: municipio.uf, slug: municipio.slug }
      : null,
  };
}

function usuarioResumo(u: UsuarioDoc, orgaoId?: string) {
  const vinculo = orgaoId ? u.vinculos.find((v) => String(v.orgaoId) === orgaoId) : undefined;
  return {
    id: String(u._id),
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    plataformaAdmin: u.plataformaAdmin,
    ultimoLogin: u.ultimoLogin ?? null,
    papel: vinculo?.papel ?? null,
  };
}

// ---------- Painel (resumo) ----------

// GET /api/platform/resumo
router.get("/resumo", async (_req: Request, res: Response) => {
  const agora = new Date();
  const em30dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [municipios, porSituacao, usuarios, vencendo, vencidos] = await Promise.all([
    Municipio.countDocuments(),
    Orgao.aggregate([
      { $match: { contratante: true } },
      { $group: { _id: { situacao: "$situacao", tipo: "$tipo" }, total: { $sum: 1 } } },
    ]),
    Usuario.countDocuments({ plataformaAdmin: false }),
    Orgao.find({ contratante: true, situacao: "ativo", "contrato.fim": { $gte: agora, $lte: em30dias } }).sort({
      "contrato.fim": 1,
    }),
    Orgao.find({ contratante: true, situacao: "ativo", "contrato.fim": { $lt: agora } }).sort({ "contrato.fim": 1 }),
  ]);

  const ids = [...vencendo, ...vencidos].map((o) => o.municipioId);
  const muns = await Municipio.find({ _id: { $in: ids } });
  const munPorId = new Map(muns.map((m) => [String(m._id), m]));

  const contagem = { ativo: 0, suspenso: 0, encerrado: 0, prefeituras: 0, camaras: 0 };
  for (const g of porSituacao as { _id: { situacao: keyof typeof contagem; tipo: string }; total: number }[]) {
    contagem[g._id.situacao] += g.total;
    if (g._id.situacao === "ativo") {
      if (g._id.tipo === "prefeitura") contagem.prefeituras += g.total;
      if (g._id.tipo === "camara") contagem.camaras += g.total;
    }
  }

  res.json({
    municipios,
    usuarios,
    orgaos: contagem,
    contratosVencendo: vencendo.map((o) => orgaoParaJson(o, munPorId.get(String(o.municipioId)))),
    contratosVencidos: vencidos.map((o) => orgaoParaJson(o, munPorId.get(String(o.municipioId)))),
  });
});

// ---------- Municipios ----------

// GET /api/platform/municipios -> lista com os orgaos de cada um
router.get("/municipios", async (_req: Request, res: Response) => {
  const [municipios, orgaos] = await Promise.all([
    Municipio.find().sort({ createdAt: 1 }),
    Orgao.find({ contratante: true }).select("municipioId tipo nome situacao"),
  ]);
  res.json(
    municipios.map((m) => ({
      id: String(m._id),
      nome: m.nome,
      uf: m.uf,
      slug: m.slug,
      ativo: m.ativo,
      brasaoUrl: urlBrasao(m),
      orgaos: orgaos
        .filter((o) => String(o.municipioId) === String(m._id))
        .map((o) => ({ id: String(o._id), tipo: o.tipo, nome: o.nome, situacao: o.situacao })),
    }))
  );
});

// POST /api/platform/municipios
router.post("/municipios", async (req: Request, res: Response) => {
  const dados = municipioSchema.parse(req.body);
  const jaExiste = await Municipio.exists({ nome: igualSemCaixa(dados.nome), uf: dados.uf });
  if (jaExiste) throw new HttpError(409, "Este municipio ja esta cadastrado");
  const municipio = await buscarOuCriarMunicipio(req, dados);
  res.status(201).json({ id: String(municipio._id), nome: municipio.nome, uf: municipio.uf, slug: municipio.slug });
});

// PATCH /api/platform/municipios/:id -> nome, uf, ativo (o slug/link nao muda)
router.patch("/municipios/:id", async (req: Request, res: Response) => {
  const dados = municipioSchema.partial().extend({ ativo: z.boolean().optional() }).parse(req.body);
  const atual = await Municipio.findById(req.params.id).lean();
  if (!atual) throw naoEncontrado("Municipio nao encontrado");

  // Atualiza SO os campos enviados (sem revalidar o documento inteiro)
  const set: Record<string, unknown> = { ...dados };
  const novoSlug = await slugCorrigido({ ...atual, ...dados });
  if (novoSlug) set.slug = novoSlug;

  const municipio = await Municipio.findByIdAndUpdate(atual._id, { $set: set }, { new: true, runValidators: true });
  if (!municipio) throw naoEncontrado("Municipio nao encontrado");
  await registrarAuditoria(req, {
    acao: "municipio.editar",
    entidade: "Municipio",
    entidadeId: municipio._id,
    municipioId: municipio._id,
    diff: set,
  });
  res.json({ id: String(municipio._id), nome: municipio.nome, uf: municipio.uf, slug: municipio.slug, ativo: municipio.ativo });
});

// POST /api/platform/municipios/:id/brasao -> troca o brasao/logo do municipio
router.post("/municipios/:id/brasao", uploadImagem, async (req: Request, res: Response) => {
  const municipio = await Municipio.findById(req.params.id);
  if (!municipio) throw naoEncontrado("Municipio nao encontrado");
  const nova = await trocarImagem(req, `${municipio._id}/brasao`, municipio.brasaoKey);
  // updateOne: grava so o brasao deste municipio (um slug antigo invalido nao trava mais o envio)
  const set: Record<string, unknown> = { brasaoKey: nova.chave, brasaoMime: nova.mime, brasaoAtualizadoEm: nova.atualizadoEm };
  const novoSlug = await slugCorrigido(municipio);
  if (novoSlug) set.slug = novoSlug;
  await Municipio.updateOne({ _id: municipio._id }, { $set: set });
  await registrarAuditoria(req, { acao: "municipio.brasao", entidade: "Municipio", entidadeId: municipio._id, municipioId: municipio._id });
  res.json({ id: String(municipio._id), brasaoUrl: urlBrasao({ _id: municipio._id, brasaoKey: nova.chave, brasaoAtualizadoEm: nova.atualizadoEm }) });
});

// DELETE /api/platform/municipios/:id/brasao
router.delete("/municipios/:id/brasao", async (req: Request, res: Response) => {
  const municipio = await Municipio.findById(req.params.id);
  if (!municipio) throw naoEncontrado("Municipio nao encontrado");
  if (municipio.brasaoKey) await apagarArquivo(municipio.brasaoKey);
  await Municipio.updateOne({ _id: municipio._id }, { $unset: { brasaoKey: 1, brasaoMime: 1, brasaoAtualizadoEm: 1 } });
  await registrarAuditoria(req, { acao: "municipio.brasao_remover", entidade: "Municipio", entidadeId: municipio._id, municipioId: municipio._id });
  res.json({ id: String(municipio._id), brasaoUrl: null });
});

// POST /api/platform/orgaos/:id/logo -> troca a logo do orgao
router.post("/orgaos/:id/logo", uploadImagem, async (req: Request, res: Response) => {
  const orgao = await Orgao.findById(req.params.id);
  if (!orgao) throw naoEncontrado("Orgao nao encontrado");
  const nova = await trocarImagem(req, `${orgao.municipioId}/${orgao._id}/logo`, orgao.logoKey);
  orgao.set({ logoKey: nova.chave, logoMime: nova.mime, logoAtualizadoEm: nova.atualizadoEm });
  await orgao.save();
  await registrarAuditoria(req, { acao: "orgao.logo", entidade: "Orgao", entidadeId: orgao._id, municipioId: orgao.municipioId });
  res.json({ logoUrl: urlLogoOrgao(orgao) });
});

// DELETE /api/platform/orgaos/:id/logo
router.delete("/orgaos/:id/logo", async (req: Request, res: Response) => {
  const orgao = await Orgao.findById(req.params.id);
  if (!orgao) throw naoEncontrado("Orgao nao encontrado");
  if (orgao.logoKey) await apagarArquivo(orgao.logoKey);
  orgao.set({ logoKey: undefined, logoMime: undefined, logoAtualizadoEm: undefined });
  await orgao.save();
  await registrarAuditoria(req, { acao: "orgao.logo_remover", entidade: "Orgao", entidadeId: orgao._id, municipioId: orgao.municipioId });
  res.json({ logoUrl: null });
});

// ---------- Orgaos contratantes ----------

// GET /api/platform/orgaos -> todos os orgaos contratantes
router.get("/orgaos", async (_req: Request, res: Response) => {
  const orgaos = await Orgao.find({ contratante: true }).sort({ createdAt: -1 });
  const muns = await Municipio.find({ _id: { $in: orgaos.map((o) => o.municipioId) } });
  const munPorId = new Map(muns.map((m) => [String(m._id), m]));
  const contagem = await Usuario.aggregate([
    { $unwind: "$vinculos" },
    { $match: { "vinculos.orgaoId": { $in: orgaos.map((o) => o._id) } } },
    { $group: { _id: "$vinculos.orgaoId", total: { $sum: 1 } } },
  ]);
  const usuariosPorOrgao = new Map(contagem.map((c: { _id: unknown; total: number }) => [String(c._id), c.total]));

  res.json(
    orgaos.map((o) => ({
      ...orgaoParaJson(o, munPorId.get(String(o.municipioId))),
      totalUsuarios: usuariosPorOrgao.get(String(o._id)) ?? 0,
    }))
  );
});

// POST /api/platform/orgaos -> cadastra Prefeitura ou Camara + administrador do orgao
router.post("/orgaos", async (req: Request, res: Response) => {
  const dados = novoOrgaoSchema.parse(req.body);

  // 1) Municipio (existente ou novo)
  let municipio;
  if (dados.municipioId) {
    municipio = await Municipio.findById(dados.municipioId);
    if (!municipio) throw naoEncontrado("Municipio nao encontrado");
  } else {
    municipio = await buscarOuCriarMunicipio(req, dados.novoMunicipio!);
  }

  // 2) Nao pode ter duas Prefeituras/Camaras no mesmo municipio
  const duplicado = await Orgao.exists({ municipioId: municipio._id, tipo: dados.tipo });
  if (duplicado) {
    const nomeTipo = dados.tipo === "prefeitura" ? "uma Prefeitura" : "uma Câmara";
    throw new HttpError(409, `${municipio.nome}/${municipio.uf} ja tem ${nomeTipo} cadastrada`);
  }

  // 3) Valida o admin antes de criar o orgao (evita orgao sem admin)
  let dadosAdmin: z.infer<typeof novoUsuarioSchema>;
  if ("usuarioId" in dados.admin) {
    // Mesmo usuario em mais de um orgao: so ganha acesso a este tambem
    const existente = await Usuario.findById(dados.admin.usuarioId);
    if (!existente) throw naoEncontrado("Usuario nao encontrado");
    if (existente.plataformaAdmin) throw new HttpError(400, "O administrador da plataforma nao pode ser vinculado a um orgao");
    dadosAdmin = { nome: existente.nome, email: existente.email, papel: "admin_orgao" };
  } else {
    const adminExistente = await Usuario.findOne({ email: dados.admin.email });
    if (!adminExistente && !dados.admin.senha) {
      throw new HttpError(400, "Informe uma senha inicial para o administrador");
    }
    dadosAdmin = { ...dados.admin, papel: "admin_orgao" };
  }

  // 4) Cria o orgao
  const orgao = await Orgao.create({
    municipioId: municipio._id,
    tipo: dados.tipo,
    nome: dados.nome || nomePadraoOrgao(dados.tipo, municipio.nome),
    sigla: dados.sigla,
    cnpj: dados.cnpj,
    situacao: dados.situacao ?? "ativo",
    contatos: dados.contatos,
    responsavel: dados.responsavel,
    plenario: dados.tipo === "camara" ? dados.plenario : undefined,
    contrato: contratoParaBanco(dados.contrato),
  });
  await registrarAuditoria(req, {
    acao: "orgao.criar",
    entidade: "Orgao",
    entidadeId: orgao._id,
    municipioId: municipio._id,
    diff: { tipo: dados.tipo, nome: orgao.nome, cnpj: dados.cnpj, contrato: dados.contrato },
  });

  // 5) Administrador do orgao
  const { usuario, criado } = await vincularUsuario(req, orgao, dadosAdmin);

  res.status(201).json({
    orgao: orgaoParaJson(orgao, municipio),
    admin: { ...usuarioResumo(usuario, String(orgao._id)), criado },
  });
});

// GET /api/platform/orgaos/:id -> detalhes + usuarios do orgao
router.get("/orgaos/:id", async (req: Request, res: Response) => {
  const orgao = await Orgao.findById(req.params.id);
  if (!orgao) throw naoEncontrado("Orgao nao encontrado");
  const municipio = await Municipio.findById(orgao.municipioId);
  const usuarios = await Usuario.find({ "vinculos.orgaoId": orgao._id }).sort({ nome: 1 });
  res.json({
    orgao: orgaoParaJson(orgao, municipio),
    usuarios: usuarios.map((u) => usuarioResumo(u, String(orgao._id))),
  });
});

// PATCH /api/platform/orgaos/:id -> dados, contrato e situacao (tipo e municipio nao mudam)
router.patch("/orgaos/:id", async (req: Request, res: Response) => {
  const dados = dadosOrgaoSchema.parse(req.body);
  const orgao = await Orgao.findById(req.params.id);
  if (!orgao) throw naoEncontrado("Orgao nao encontrado");

  const { contrato, contatos, responsavel, ...simples } = dados;
  Object.assign(orgao, simples);
  if (contatos) orgao.set("contatos", contatos);
  if (responsavel) orgao.set("responsavel", responsavel);
  if (contrato) orgao.set("contrato", contratoParaBanco(contrato));
  if (req.body?.plenario === "") orgao.set("plenario", undefined); // apagou o nome do plenario
  await orgao.save();

  await registrarAuditoria(req, {
    acao: "orgao.editar",
    entidade: "Orgao",
    entidadeId: orgao._id,
    municipioId: orgao.municipioId,
    diff: dados,
  });
  const municipio = await Municipio.findById(orgao.municipioId);
  res.json(orgaoParaJson(orgao, municipio));
});

// POST /api/platform/orgaos/:id/usuarios -> adiciona usuario ao orgao
router.post("/orgaos/:id/usuarios", async (req: Request, res: Response) => {
  const dados = novoUsuarioSchema.parse(req.body);
  const orgao = await Orgao.findById(req.params.id);
  if (!orgao) throw naoEncontrado("Orgao nao encontrado");
  const { usuario, criado } = await vincularUsuario(req, orgao, dados);
  res.status(201).json({ ...usuarioResumo(usuario, String(orgao._id)), criado });
});

// DELETE /api/platform/orgaos/:id/usuarios/:usuarioId -> remove o acesso ao orgao (nao apaga o usuario)
router.delete("/orgaos/:id/usuarios/:usuarioId", async (req: Request, res: Response) => {
  const usuario = await Usuario.findById(req.params.usuarioId);
  if (!usuario) throw naoEncontrado("Usuario nao encontrado");
  const orgaoId = String(req.params.id);
  const vinculo = usuario.vinculos.find((v) => String(v.orgaoId) === orgaoId);
  if (!vinculo) throw naoEncontrado("Usuario nao pertence a este orgao");

  usuario.vinculos = usuario.vinculos.filter((v) => String(v.orgaoId) !== orgaoId);
  usuario.tokenVersion += 1; // derruba sessoes abertas
  await usuario.save();
  await registrarAuditoria(req, {
    acao: "usuario.desvincular",
    entidade: "Usuario",
    entidadeId: usuario._id,
    municipioId: vinculo.municipioId,
    diff: { orgaoId },
  });
  res.json({ ok: true });
});

// ---------- Usuarios ----------

// GET /api/platform/usuarios?q= -> todos os usuarios com seus orgaos
router.get("/usuarios", async (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim();
  const filtro = q ? { $or: [{ nome: new RegExp(escapar(q), "i") }, { email: new RegExp(escapar(q), "i") }] } : {};
  const usuarios = await Usuario.find(filtro).sort({ createdAt: -1 }).limit(200);
  const orgaoIds = usuarios.flatMap((u) => u.vinculos.map((v) => v.orgaoId));
  const orgaos = await Orgao.find({ _id: { $in: orgaoIds } }).select("nome municipioId");
  const muns = await Municipio.find({ _id: { $in: orgaos.map((o) => o.municipioId) } }).select("nome uf");
  const orgaoPorId = new Map(orgaos.map((o) => [String(o._id), o]));
  const munPorId = new Map(muns.map((m) => [String(m._id), m]));

  res.json(
    usuarios.map((u) => ({
      ...usuarioResumo(u),
      acessos: u.vinculos.map((v) => {
        const o = orgaoPorId.get(String(v.orgaoId));
        const m = munPorId.get(String(v.municipioId));
        return {
          orgaoId: String(v.orgaoId),
          orgaoNome: o?.nome ?? "(orgao removido)",
          municipio: m ? `${m.nome}/${m.uf}` : "",
          papel: v.papel,
        };
      }),
    }))
  );
});

// PATCH /api/platform/usuarios/:id -> nome, ativo, nova senha
router.patch("/usuarios/:id", async (req: Request, res: Response) => {
  const dados = z
    .object({
      nome: z.preprocess(vazioParaUndef, z.string().trim().min(2).optional()),
      ativo: z.boolean().optional(),
      novaSenha: z.preprocess(vazioParaUndef, z.string().min(8, "Senha com no minimo 8 caracteres").optional()),
    })
    .parse(req.body);

  const usuario = await Usuario.findById(req.params.id);
  if (!usuario) throw naoEncontrado("Usuario nao encontrado");
  if (String(usuario._id) === String(req.usuario!._id) && dados.ativo === false) {
    throw new HttpError(400, "Voce nao pode desativar o seu proprio usuario");
  }

  if (dados.nome) usuario.nome = dados.nome;
  if (dados.ativo !== undefined) usuario.ativo = dados.ativo;
  if (dados.novaSenha) usuario.senhaHash = await bcrypt.hash(dados.novaSenha, 12);
  // Desativar ou trocar senha derruba as sessoes abertas
  if (dados.novaSenha || dados.ativo === false) usuario.tokenVersion += 1;
  await usuario.save();

  await registrarAuditoria(req, {
    acao: "usuario.editar",
    entidade: "Usuario",
    entidadeId: usuario._id,
    municipioId: null,
    diff: { nome: dados.nome, ativo: dados.ativo, trocouSenha: Boolean(dados.novaSenha) },
  });
  res.json(usuarioResumo(usuario));
});

// GET /api/platform/historico -> tudo o que foi feito no sistema (quem, o que, quando)
router.get("/historico", async (req: Request, res: Response) => {
  res.json(await listarHistorico(req, {}));
});

export default router;
