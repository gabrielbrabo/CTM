import { Request, Response, Router } from "express";
import { Types } from "mongoose";
import { semTenant } from "../../context/tenant";
import { municipioPublico } from "../../middleware/municipio";
import { Municipio } from "../../models/Municipio";
import { Orgao } from "../../models/Orgao";
import { TIPOS_PUBLICACAO_DEF } from "../../config/tiposPublicacao";
import { Publicacao, TIPOS_PUBLICACAO } from "../../models/Publicacao";
import { env } from "../../config/env";
import { enviarAnexo } from "../../utils/anexos";
import { enviarImagem, urlBrasao, urlFotoVereador, urlLogoOrgao } from "../../utils/imagens";
import { dadosDaPublicacao, enviarPdf, gerarPdfAnexos, gerarPdfPublicacao, logoParaPdf } from "../../utils/pdfPublicacao";
import { naoEncontrado } from "../../utils/httpError";
import { Vereador } from "../../models/Vereador";
import { mapaVereadores, vinculosComNomes } from "../vereador/vinculos";
import { ordenarVereadores } from "../vereador/vereadorRoutes";

// Rotas do portal publico: sem login, so leitura
const router = Router();

// GET /api/public/municipios -> lista para a tela "escolha o municipio"
// So aparecem municipios com pelo menos um orgao contratante ATIVO.
// Ordem de cadastro: o primeiro municipio cadastrado aparece primeiro.
router.get("/municipios", async (_req: Request, res: Response) => {
  const comOrgaoAtivo = await semTenant(() =>
    Orgao.distinct("municipioId", { contratante: true, situacao: "ativo" })
  );
  const municipios = await Municipio.find({ _id: { $in: comOrgaoAtivo }, ativo: true })
    .select("slug nome uf brasaoKey brasaoAtualizadoEm createdAt")
    .sort({ createdAt: 1, _id: 1 });

  res.json(
    municipios.map((m) => ({ id: String(m._id), slug: m.slug, nome: m.nome, uf: m.uf, brasaoUrl: urlBrasao(m) }))
  );
});

// GET /api/public/tipos-publicacao -> catalogo de tipos e campos (usado pelo painel e pelo portal)
router.get("/tipos-publicacao", (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json(TIPOS_PUBLICACAO_DEF);
});

// GET /api/public/imagens/municipio/:id -> brasao do municipio
router.get("/imagens/municipio/:id", async (req: Request, res: Response) => {
  const m = await Municipio.findById(String(req.params.id)).select("brasaoKey brasaoMime");
  await enviarImagem(res, m?.brasaoKey, m?.brasaoMime);
});

// GET /api/public/imagens/orgao/:id -> logo do orgao
router.get("/imagens/orgao/:id", async (req: Request, res: Response) => {
  const o = await semTenant(() => Orgao.findById(String(req.params.id)).select("logoKey logoMime"));
  await enviarImagem(res, o?.logoKey, o?.logoMime);
});

// GET /api/public/imagens/vereador/:id -> foto do vereador
router.get("/imagens/vereador/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw naoEncontrado("Imagem não encontrada");
  const v = await semTenant(() => Vereador.findById(id).select("fotoKey fotoMime"));
  await enviarImagem(res, v?.fotoKey, v?.fotoMime);
});

// GET /api/public/m/:slug -> dados do municipio + orgaos ativos (Prefeitura e/ou Camara)
router.get("/m/:slug", municipioPublico, async (req: Request, res: Response) => {
  const m = req.municipio!;
  // Sem filtro de municipio aqui: o plugin tenantScope injeta automaticamente
  const orgaos = await Orgao.find({ contratante: true, situacao: "ativo" }).sort({ tipo: 1 });

  res.json({
    municipio: {
      id: String(m._id),
      slug: m.slug,
      nome: m.nome,
      uf: m.uf,
      brasaoUrl: urlBrasao(m),
      tema: m.tema,
      contatos: m.contatos,
    },
    orgaos: orgaos.map((o) => ({
      id: String(o._id),
      tipo: o.tipo,
      nome: o.nome,
      sigla: o.sigla ?? null,
      plenario: o.plenario ?? null,
      logoUrl: urlLogoOrgao(o),
      // Contato para a populacao + se recebe mensagens pelo portal
      contatos: o.contatos ?? {},
      recebeMensagens: o.recebeMensagens !== false,
    })),
  });
});

// Orgaos ativos do municipio atual (publicacao de orgao suspenso nao aparece)
async function orgaosAtivos() {
  return Orgao.find({ contratante: true, situacao: "ativo" }).select("tipo nome logoKey logoMime logoAtualizadoEm");
}

// GET /api/public/m/:slug/feed?orgao=camara&tipo=&q=&de=&ate=&pagina=
router.get("/m/:slug/feed", municipioPublico, async (req: Request, res: Response) => {
  const orgaos = await orgaosAtivos();
  const tipoOrgao = String(req.query.orgao || "");
  const orgaosFiltro = tipoOrgao ? orgaos.filter((o) => o.tipo === tipoOrgao) : orgaos;

  const filtro: Record<string, unknown> = {
    estado: "publicado",
    orgaoId: { $in: orgaosFiltro.map((o) => o._id) },
  };
  const tipo = String(req.query.tipo || "");
  if ((TIPOS_PUBLICACAO as readonly string[]).includes(tipo)) filtro.tipo = tipo;
  const q = String(req.query.q || "").trim().slice(0, 100);
  if (q) filtro.$text = { $search: q };
  // Proposicoes de um vereador (perfil do vereador)
  const vereador = String(req.query.vereador || "");
  if (Types.ObjectId.isValid(vereador)) filtro.autoresIds = new Types.ObjectId(vereador);
  const de = req.query.de ? new Date(String(req.query.de)) : null;
  const ate = req.query.ate ? new Date(`${String(req.query.ate)}T23:59:59`) : null;
  if ((de && !isNaN(+de)) || (ate && !isNaN(+ate))) {
    filtro.publicadoEm = {
      ...(de && !isNaN(+de) ? { $gte: de } : {}),
      ...(ate && !isNaN(+ate) ? { $lte: ate } : {}),
    };
  }

  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const porPagina = 15;
  // Quantas de cada tipo (com os mesmos filtros, menos o de tipo) -> etiquetas coloridas que filtram
  const { tipo: _semTipo, ...filtroSemTipo } = filtro;
  const [itens, total, porTipo] = await Promise.all([
    Publicacao.find(filtro)
      .select("orgaoId tipo detalhes titulo slug numero resumo publicadoEm corrigidoEm confiabilidade anexos autoresIds")
      .sort({ publicadoEm: -1, _id: -1 })
      .skip((pagina - 1) * porPagina)
      .limit(porPagina),
    Publicacao.countDocuments(filtro),
    Publicacao.aggregate<{ _id: string; total: number }>([
      { $match: filtroSemTipo },
      { $group: { _id: "$tipo", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);
  const nomeOrgao = new Map(orgaos.map((o) => [String(o._id), { nome: o.nome, tipo: o.tipo, logoUrl: urlLogoOrgao(o) }]));
  const vereadores = await mapaVereadores(itens.map((p) => ({ autoresIds: p.autoresIds })));

  res.json({
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    porTipo: porTipo.map((t) => ({ tipo: t._id, total: t.total })),
    itens: itens.map((p) => ({
      tipo: p.tipo,
      detalhes: (p.detalhes as Record<string, unknown>) ?? {},
      titulo: p.titulo,
      slug: p.slug,
      numero: p.numero ?? null,
      resumo: p.resumo ?? null,
      publicadoEm: p.publicadoEm,
      corrigidoEm: p.corrigidoEm ?? null,
      confiabilidade: p.confiabilidade,
      totalAnexos: p.anexos.length,
      // Documentos para baixar direto da lista
      anexos: p.anexos.slice(0, 5).map((a) => ({
        nome: a.nome,
        mime: a.mime,
        tamanho: a.tamanho,
        url: `/api/public/m/${req.municipio!.slug}/p/${p.slug}/anexos/${a._id}`,
      })),
      orgao: nomeOrgao.get(String(p.orgaoId)) ?? null,
      autores: vinculosComNomes({ autoresIds: p.autoresIds }, vereadores).autores,
    })),
  });
});

async function publicacaoPublica(req: Request) {
  const orgaos = await orgaosAtivos();
  const pub = await Publicacao.findOne({
    slug: String(req.params.pubSlug),
    estado: "publicado",
    orgaoId: { $in: orgaos.map((o) => o._id) },
  });
  if (!pub) throw naoEncontrado("Publicação não encontrada");
  const orgao = orgaos.find((o) => String(o._id) === String(pub.orgaoId))!;
  return { pub, orgao };
}

// GET /api/public/m/:slug/p/:pubSlug -> detalhe da publicacao
router.get("/m/:slug/p/:pubSlug", municipioPublico, async (req: Request, res: Response) => {
  const { pub, orgao } = await publicacaoPublica(req);
  const m = req.municipio!;
  // Historico publico: so eventos que interessam ao cidadao
  const eventosPublicos = ["publicado", "corrigido", "anexo_adicionado", "anexo_removido"];
  const vinculos = vinculosComNomes(pub, await mapaVereadores([pub]));

  res.json({
    municipio: { nome: m.nome, uf: m.uf, slug: m.slug, brasaoUrl: urlBrasao(m) },
    orgao: { nome: orgao.nome, tipo: orgao.tipo, logoUrl: urlLogoOrgao(orgao) },
    publicacao: {
      tipo: pub.tipo,
      detalhes: (pub.detalhes as Record<string, unknown>) ?? {},
      titulo: pub.titulo,
      slug: pub.slug,
      numero: pub.numero ?? null,
      dataReferencia: pub.dataReferencia ?? null,
      resumo: pub.resumo ?? null,
      conteudo: pub.conteudo ?? null,
      fonte: pub.fonte ?? {},
      confiabilidade: pub.confiabilidade,
      publicadoEm: pub.publicadoEm,
      corrigidoEm: pub.corrigidoEm ?? null,
      anexos: pub.anexos.map((a) => ({
        id: String(a._id),
        nome: a.nome,
        mime: a.mime,
        tamanho: a.tamanho,
        noCorpo: Boolean(a.noCorpo),
        url: `/api/public/m/${m.slug}/p/${pub.slug}/anexos/${a._id}`,
      })),
      // Vereadores ligados: autores, relator, votos nominais e presenca
      vereadores: vinculos,
      historico: pub.historico
        .filter((h) => eventosPublicos.includes(h.evento))
        .map((h) => ({ evento: h.evento, data: h.data, motivo: h.motivo ?? null })),
    },
  });
});

// GET /api/public/m/:slug/p/:pubSlug/anexos/:anexoId[?download=1]
router.get("/m/:slug/p/:pubSlug/anexos/:anexoId", municipioPublico, async (req: Request, res: Response) => {
  const { pub } = await publicacaoPublica(req);
  const anexo = pub.anexos.id(String(req.params.anexoId));
  if (!anexo) throw naoEncontrado("Anexo não encontrado");
  await enviarAnexo(res, anexo, req.query.download === "1");
});

// GET /api/public/m/:slug/p/:pubSlug/impressao.pdf[?parte=anexos]
// Dois caminhos: somente a publicacao (padrao) ou somente os anexos
router.get("/m/:slug/p/:pubSlug/impressao.pdf", municipioPublico, async (req: Request, res: Response) => {
  const { pub, orgao } = await publicacaoPublica(req);
  const m = req.municipio!;
  if (req.query.parte === "anexos") {
    const pdf = await gerarPdfAnexos(pub.anexos);
    if (!pdf) throw naoEncontrado("Esta publicação não tem anexos em PDF ou imagem para imprimir");
    return enviarPdf(res, pdf, `${pub.titulo} anexos`);
  }
  const pdf = await gerarPdfPublicacao({
    municipio: { nome: m.nome, uf: m.uf },
    orgao: { nome: orgao.nome, logo: await logoParaPdf(orgao) },
    publicacao: { ...dadosDaPublicacao(pub), vereadores: vinculosComNomes(pub, await mapaVereadores([pub])) },
    link: `${env.clientUrl}/${m.slug}/p/${pub.slug}`,
  });
  enviarPdf(res, pdf, pub.titulo);
});

// ---------- Vereadores (portal) ----------

const NOME_CARGO: Record<string, string> = {
  presidente: "Presidente",
  vice_presidente: "Vice-presidente",
  primeiro_secretario: "1º Secretário(a)",
  segundo_secretario: "2º Secretário(a)",
  vereador: "Vereador(a)",
};

async function camaraAtiva() {
  const camara = (await orgaosAtivos()).find((o) => o.tipo === "camara");
  if (!camara) throw naoEncontrado("Câmara não encontrada");
  return camara;
}

function vereadorPublico(v: InstanceType<typeof Vereador>) {
  return {
    id: String(v._id),
    nome: v.nome,
    nomeParlamentar: v.nomeParlamentar ?? null,
    partido: v.partido ?? null,
    cargoMesa: v.cargoMesa,
    cargoNome: NOME_CARGO[v.cargoMesa ?? "vereador"] ?? "Vereador(a)",
    situacao: v.situacao,
    legislatura: v.legislatura ?? null,
    fotoUrl: urlFotoVereador(v),
  };
}

// GET /api/public/m/:slug/vereadores -> quem sao os vereadores
router.get("/m/:slug/vereadores", municipioPublico, async (req: Request, res: Response) => {
  const camara = await camaraAtiva();
  const lista = await Vereador.find({ orgaoId: camara._id, mostrarNoPortal: { $ne: false } });
  res.json({
    camara: { nome: camara.nome, logoUrl: urlLogoOrgao(camara) },
    vereadores: ordenarVereadores(lista).map(vereadorPublico),
  });
});

// GET /api/public/m/:slug/vereadores/:id -> perfil + autorias, votos e presencas
router.get("/m/:slug/vereadores/:id", municipioPublico, async (req: Request, res: Response) => {
  const camara = await camaraAtiva();
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw naoEncontrado("Vereador não encontrado");
  const v = await Vereador.findOne({ _id: id, orgaoId: camara._id, mostrarNoPortal: { $ne: false } });
  if (!v) throw naoEncontrado("Vereador não encontrado");
  const base = { estado: "publicado", orgaoId: camara._id };
  const ativos = (await orgaosAtivos()).map((o) => o._id);

  const [autorias, comVoto, comPresenca] = await Promise.all([
    Publicacao.find({ ...base, autoresIds: v._id }).select("tipo"),
    Publicacao.find({ estado: "publicado", orgaoId: { $in: ativos }, "votos.vereadorId": v._id })
      .select("tipo titulo slug numero publicadoEm detalhes votos")
      .sort({ publicadoEm: -1 })
      .limit(50),
    Publicacao.find({ ...base, "presencas.vereadorId": v._id })
      .select("tipo titulo slug publicadoEm presencas")
      .sort({ publicadoEm: -1 })
      .limit(200),
  ]);

  // Autorias por tipo (ex.: 12 indicacoes, 3 projetos de lei)
  const porTipo = new Map<string, number>();
  autorias.forEach((p) => porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1));

  const presencas = comPresenca.map((p) => ({
    titulo: p.titulo,
    slug: p.slug,
    data: p.publicadoEm,
    situacao: p.presencas.find((x) => String(x.vereadorId) === id)?.situacao ?? "ausente",
  }));
  const contar = (s: string) => presencas.filter((p) => p.situacao === s).length;

  res.json({
    camara: { nome: camara.nome, logoUrl: urlLogoOrgao(camara) },
    vereador: {
      ...vereadorPublico(v),
      mandatoInicio: v.mandatoInicio ?? null,
      mandatoFim: v.mandatoFim ?? null,
      email: v.email ?? null,
      telefone: v.telefone ?? null,
      gabinete: v.gabinete ?? null,
      redeSocial: v.redeSocial ?? null,
      biografia: v.biografia ?? null,
    },
    autorias: { total: autorias.length, porTipo: [...porTipo].map(([tipo, total]) => ({ tipo, total })) },
    votos: comVoto.map((p) => ({
      titulo: p.titulo,
      slug: p.slug,
      tipo: p.tipo,
      numero: p.numero ?? null,
      data: p.publicadoEm,
      resultado: ((p.detalhes as Record<string, unknown>)?.resultado as string) ?? ((p.detalhes as Record<string, unknown>)?.situacao as string) ?? null,
      voto: p.votos.find((x) => String(x.vereadorId) === id)?.voto ?? null,
    })),
    presencas: {
      total: presencas.length,
      presente: contar("presente"),
      ausente: contar("ausente"),
      justificada: contar("justificada"),
      ultimas: presencas.slice(0, 20),
    },
  });
});

export default router;
