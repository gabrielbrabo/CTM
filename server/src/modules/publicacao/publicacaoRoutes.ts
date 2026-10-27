import { randomBytes } from "node:crypto";
import { Request, Response, Router } from "express";
import { z } from "zod";
import { tipoPermitidoNoOrgao, validarDetalhes } from "../../config/tiposPublicacao";
import { papelNoOrgao } from "../../middleware/orgao";
import {
  CONFIABILIDADES,
  EventoHistorico,
  Publicacao,
  PublicacaoDoc,
  TIPOS_PUBLICACAO,
  normalizarNumero,
  normalizarTitulo,
} from "../../models/Publicacao";
import { env } from "../../config/env";
import { enviarAnexo, nomeOriginal, uploadAnexo } from "../../utils/anexos";
import { dadosDaPublicacao, enviarPdf, gerarPdfAnexos, gerarPdfPublicacao, logoParaPdf } from "../../utils/pdfPublicacao";
import { registrarAuditoria } from "../../utils/audit";
import { HttpError, naoEncontrado, proibido } from "../../utils/httpError";
import { slugify } from "../../utils/slug";
import { apagarArquivo, salvarArquivo } from "../../utils/storage";
import { mapaVereadores, prepararVinculos, vinculosComNomes, vinculosSchema } from "../vereador/vinculos";
import { notificarPublicacao } from "../cidadao/notificar";

/**
 * Publicacoes do orgao (painel). Montado em /api/admin/o/:orgaoId/publicacoes
 *
 * Quem pode o que:
 * - Todos do orgao (admin, editor, revisor): criar e editar rascunhos, enviar para revisao
 * - Publicar: admin e revisor; o editor so publica direto se o orgao NAO exigir revisao
 * - Corrigir publicado (com motivo): quem pode publicar
 * - Devolver para correcao: admin e revisor
 * - Despublicar (com motivo): so admin
 * - Excluir: so rascunho nunca publicado
 */
const router = Router({ mergeParams: true });

// Tipos de arquivo que podem aparecer no lugar do texto (documento escaneado, foto)
const PODE_NO_CORPO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const vazioParaUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
const texto = (max: number) => z.preprocess(vazioParaUndef, z.string().trim().max(max).optional());

const dadosSchema = z.object({
  tipo: z.enum(TIPOS_PUBLICACAO as [string, ...string[]]),
  // Campos especificos do tipo (validados pelo catalogo)
  detalhes: z.record(z.unknown()).optional(),
  titulo: z.string().trim().min(3, "Informe o título").max(250),
  numero: texto(50),
  dataReferencia: z.preprocess(vazioParaUndef, z.coerce.date().optional()),
  resumo: texto(1000),
  conteudo: texto(100_000),
  fonte: z
    .object({
      nome: texto(200),
      url: z.preprocess(vazioParaUndef, z.string().trim().url("Link da fonte inválido").optional()),
    })
    .optional(),
  confiabilidade: z.enum(CONFIABILIDADES).optional(),
}).merge(vinculosSchema);

// Confere se o tipo vale para este orgao e valida os campos especificos
function prepararDetalhes(req: Request, tipo: string, detalhes: unknown) {
  if (!tipoPermitidoNoOrgao(tipo, req.orgao!.tipo)) {
    throw new HttpError(400, "Este tipo de publicação não está disponível para este órgão");
  }
  const r = validarDetalhes(tipo, detalhes);
  const msgs = Object.values(r.erros);
  if (msgs.length) throw new HttpError(400, msgs.join(" · "));
  return r.detalhes;
}

/**
 * Impede cadastrar a mesma publicacao duas vezes no orgao:
 * mesmo tipo + mesmo numero (ex.: PL 12/2026), ou, sem numero, mesmo titulo.
 * Para mudar a situacao (ex.: "em pauta" -> "aprovado") edita-se a existente.
 */
async function verificarDuplicada(req: Request, d: { tipo: string; numero?: string | null; titulo: string }, ignorarId?: unknown) {
  const numero = normalizarNumero(d.numero);
  const filtro: Record<string, unknown> = { orgaoId: req.orgao!._id, tipo: d.tipo };
  if (numero) filtro.numeroNormalizado = numero;
  else filtro.tituloNormalizado = normalizarTitulo(d.titulo);
  if (ignorarId) filtro._id = { $ne: ignorarId };
  const existente = await Publicacao.findOne(filtro).select("titulo estado");
  if (existente) {
    throw new HttpError(
      409,
      `Esta publicação já existe: “${existente.titulo}”. Para atualizar (ex.: aprovado, votação), edite a publicação existente em vez de criar outra.`,
      { existenteId: String(existente._id) }
    );
  }
}

const motivoSchema = z.object({ motivo: z.string().trim().min(3, "Informe o motivo") });

// ---------- helpers ----------

function podePublicar(req: Request): boolean {
  const papel = papelNoOrgao(req);
  if (papel === "admin_orgao" || papel === "revisor") return true;
  return papel === "editor" && !req.orgao!.exigeRevisao;
}

function registrarEvento(req: Request, pub: PublicacaoDoc, evento: EventoHistorico, motivo?: string) {
  pub.historico.push({
    evento,
    data: new Date(),
    usuarioId: req.usuario!._id,
    usuarioNome: req.usuario!.nome,
    motivo,
  });
  pub.atualizadoPor = req.usuario!._id;
}

async function carregar(req: Request): Promise<PublicacaoDoc> {
  // O plugin ja limita ao municipio; aqui limita tambem ao orgao
  const pub = await Publicacao.findOne({ _id: req.params.id, orgaoId: req.orgao!._id });
  if (!pub) throw naoEncontrado("Publicação não encontrada");
  return pub;
}

function paraJson(req: Request, p: PublicacaoDoc) {
  const base = `/api/admin/o/${req.orgao!._id}/publicacoes/${p._id}/anexos`;
  return {
    id: String(p._id),
    tipo: p.tipo,
    detalhes: (p.detalhes as Record<string, unknown>) ?? {},
    titulo: p.titulo,
    slug: p.slug,
    numero: p.numero ?? null,
    dataReferencia: p.dataReferencia ?? null,
    resumo: p.resumo ?? null,
    conteudo: p.conteudo ?? null,
    fonte: p.fonte ?? {},
    confiabilidade: p.confiabilidade,
    estado: p.estado,
    publicadoEm: p.publicadoEm ?? null,
    corrigidoEm: p.corrigidoEm ?? null,
    criadoEm: (p as unknown as { createdAt?: Date }).createdAt ?? null,
    atualizadoEm: (p as unknown as { updatedAt?: Date }).updatedAt ?? null,
    anexos: p.anexos.map((a) => ({
      id: String(a._id),
      nome: a.nome,
      mime: a.mime,
      tamanho: a.tamanho,
      noCorpo: Boolean(a.noCorpo),
      url: `${base}/${a._id}`,
    })),
    autoresIds: (p.autoresIds ?? []).map(String),
    relatorId: p.relatorId ? String(p.relatorId) : null,
    votos: (p.votos ?? []).map((v) => ({ vereadorId: String(v.vereadorId), voto: v.voto })),
    presencas: (p.presencas ?? []).map((v) => ({ vereadorId: String(v.vereadorId), situacao: v.situacao })),
    historico: p.historico.map((h) => ({
      evento: h.evento,
      data: h.data,
      usuarioNome: h.usuarioNome ?? null,
      motivo: h.motivo ?? null,
    })),
  };
}

function permissoes(req: Request, p: PublicacaoDoc) {
  const papel = papelNoOrgao(req);
  const publicar = podePublicar(req);
  const jaPublicada = p.historico.some((h) => h.evento === "publicado");
  return {
    editar: p.estado !== "publicado" || publicar,
    precisaMotivoParaEditar: p.estado === "publicado",
    enviarRevisao: p.estado === "rascunho" && req.orgao!.exigeRevisao,
    publicar: publicar && ["rascunho", "em_revisao", "despublicado"].includes(p.estado),
    devolver: p.estado === "em_revisao" && (papel === "admin_orgao" || papel === "revisor"),
    despublicar: p.estado === "publicado" && papel === "admin_orgao",
    excluir: p.estado === "rascunho" && !jaPublicada,
  };
}

const responder = (req: Request, res: Response, p: PublicacaoDoc, status = 200) =>
  res.status(status).json({ ...paraJson(req, p), permissoes: permissoes(req, p) });

// ---------- rotas ----------

// GET /publicacoes?estado=&tipo=&q=&pagina=
router.get("/", async (req: Request, res: Response) => {
  const filtro: Record<string, unknown> = { orgaoId: req.orgao!._id };
  if (req.query.estado) filtro.estado = String(req.query.estado);
  if (req.query.tipo) filtro.tipo = String(req.query.tipo);
  const q = String(req.query.q || "").trim();
  if (q) filtro.$text = { $search: q };

  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const porPagina = 20;
  const { tipo: _semTipo, ...filtroSemTipo } = filtro;
  const [itens, total, porTipo] = await Promise.all([
    Publicacao.find(filtro)
      .select("tipo detalhes titulo numero estado publicadoEm updatedAt confiabilidade anexos")
      .sort({ updatedAt: -1 })
      .skip((pagina - 1) * porPagina)
      .limit(porPagina),
    Publicacao.countDocuments(filtro),
    // Quantas de cada tipo (etiquetas coloridas que filtram)
    Publicacao.aggregate<{ _id: string; total: number }>([
      { $match: filtroSemTipo },
      { $group: { _id: "$tipo", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  res.json({
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    porTipo: porTipo.map((t) => ({ tipo: t._id, total: t.total })),
    itens: itens.map((p) => ({
      id: String(p._id),
      tipo: p.tipo,
      detalhes: (p.detalhes as Record<string, unknown>) ?? {},
      titulo: p.titulo,
      numero: p.numero ?? null,
      estado: p.estado,
      confiabilidade: p.confiabilidade,
      publicadoEm: p.publicadoEm ?? null,
      atualizadoEm: (p as unknown as { updatedAt?: Date }).updatedAt ?? null,
      totalAnexos: p.anexos.length,
      anexos: p.anexos.slice(0, 5).map((a) => ({
        nome: a.nome,
        mime: a.mime,
        tamanho: a.tamanho,
        url: `/api/admin/o/${req.orgao!._id}/publicacoes/${p._id}/anexos/${a._id}`,
      })),
    })),
    exigeRevisao: Boolean(req.orgao!.exigeRevisao),
  });
});

// POST /publicacoes -> cria rascunho
router.post("/", async (req: Request, res: Response) => {
  const { autoresIds, relatorId, votos, presencas, ...dados } = dadosSchema.parse(req.body);
  dados.detalhes = prepararDetalhes(req, dados.tipo, dados.detalhes);
  // Vereadores (autores, relator, votos, presenca)
  const vinc = await prepararVinculos(req.orgao!, dados.tipo, { autoresIds, relatorId, votos, presencas }, dados.detalhes ?? {});
  dados.detalhes = vinc.detalhes;
  await verificarDuplicada(req, dados);
  const slug = `${slugify(dados.titulo).slice(0, 80) || "publicacao"}-${randomBytes(3).toString("hex")}`;
  const pub = new Publicacao({
    ...dados,
    ...vinc.campos,
    orgaoId: req.orgao!._id,
    slug,
    estado: "rascunho",
    criadoPor: req.usuario!._id,
  });
  registrarEvento(req, pub, "criado");
  await pub.save();
  await registrarAuditoria(req, { acao: "publicacao.criar", entidade: "Publicacao", entidadeId: pub._id });
  responder(req, res, pub, 201);
});

// GET /publicacoes/:id
router.get("/:id", async (req: Request, res: Response) => {
  responder(req, res, await carregar(req));
});

// PATCH /publicacoes/:id -> edita (se publicada, exige motivo e vira "corrigida")
router.patch("/:id", async (req: Request, res: Response) => {
  const pub = await carregar(req);
  const { autoresIds, relatorId, votos, presencas, ...dados } = dadosSchema.partial().parse(req.body);
  // Se mudou o tipo ou os detalhes, valida de novo (detalhes de outro tipo sao descartados)
  if (dados.tipo !== undefined || dados.detalhes !== undefined) {
    const tipo = dados.tipo ?? pub.tipo;
    dados.detalhes = prepararDetalhes(req, tipo, dados.detalhes ?? pub.detalhes);
  }
  // Vereadores: junta com o que ja existe e valida de novo
  const vinc = await prepararVinculos(
    req.orgao!,
    dados.tipo ?? pub.tipo,
    { autoresIds, relatorId, votos, presencas },
    (dados.detalhes ?? pub.detalhes ?? {}) as Record<string, unknown>,
    pub
  );
  const mudouDetalhes = JSON.stringify(vinc.detalhes) !== JSON.stringify(dados.detalhes ?? pub.detalhes ?? {});
  if (dados.detalhes !== undefined || mudouDetalhes) dados.detalhes = vinc.detalhes;
  Object.assign(dados, vinc.campos);
  if (dados.tipo !== undefined || dados.numero !== undefined || dados.titulo !== undefined) {
    await verificarDuplicada(
      req,
      { tipo: dados.tipo ?? pub.tipo, numero: dados.numero !== undefined ? dados.numero : pub.numero, titulo: dados.titulo ?? pub.titulo },
      pub._id
    );
  }

  if (pub.estado === "publicado") {
    if (!podePublicar(req)) throw proibido("Você não pode corrigir uma publicação já publicada");
    const { motivo } = motivoSchema.parse(req.body);
    pub.set(dados);
    pub.corrigidoEm = new Date();
    registrarEvento(req, pub, "corrigido", motivo);
  } else {
    pub.set(dados);
    registrarEvento(req, pub, "editado");
  }

  await pub.save();
  await registrarAuditoria(req, {
    acao: pub.estado === "publicado" ? "publicacao.corrigir" : "publicacao.editar",
    entidade: "Publicacao",
    entidadeId: pub._id,
    diff: dados,
  });
  responder(req, res, pub);
});

// POST /publicacoes/:id/enviar-revisao
router.post("/:id/enviar-revisao", async (req: Request, res: Response) => {
  const pub = await carregar(req);
  if (pub.estado !== "rascunho") throw new HttpError(400, "Só rascunhos podem ser enviados para revisão");
  pub.estado = "em_revisao";
  registrarEvento(req, pub, "enviado_revisao");
  await pub.save();
  await registrarAuditoria(req, { acao: "publicacao.enviar_revisao", entidade: "Publicacao", entidadeId: pub._id });
  responder(req, res, pub);
});

// POST /publicacoes/:id/devolver { motivo }
router.post("/:id/devolver", async (req: Request, res: Response) => {
  const pub = await carregar(req);
  const papel = papelNoOrgao(req);
  if (papel !== "admin_orgao" && papel !== "revisor") throw proibido();
  if (pub.estado !== "em_revisao") throw new HttpError(400, "Só publicações em revisão podem ser devolvidas");
  const { motivo } = motivoSchema.parse(req.body);
  pub.estado = "rascunho";
  registrarEvento(req, pub, "devolvido", motivo);
  await pub.save();
  await registrarAuditoria(req, { acao: "publicacao.devolver", entidade: "Publicacao", entidadeId: pub._id, diff: { motivo } });
  responder(req, res, pub);
});

// POST /publicacoes/:id/publicar
router.post("/:id/publicar", async (req: Request, res: Response) => {
  const pub = await carregar(req);
  if (!podePublicar(req)) {
    throw proibido("Este órgão exige revisão: envie para revisão e aguarde um revisor ou administrador");
  }
  if (pub.estado === "publicado") throw new HttpError(400, "Já está publicada");
  pub.estado = "publicado";
  // Mantem a data da primeira publicacao (republicar nao muda a ordem do feed)
  const primeiraVez = !pub.publicadoEm;
  if (!pub.publicadoEm) pub.publicadoEm = new Date();
  registrarEvento(req, pub, "publicado");
  await pub.save();
  await registrarAuditoria(req, { acao: "publicacao.publicar", entidade: "Publicacao", entidadeId: pub._id });
  // Sininho: avisa quem segue o municipio (so na primeira publicacao)
  if (primeiraVez) {
    await notificarPublicacao({
      municipioId: pub.municipioId,
      municipioSlug: req.municipio!.slug,
      orgaoNome: req.orgao!.nome,
      titulo: pub.titulo,
      resumo: pub.resumo,
      slug: pub.slug,
    });
  }
  responder(req, res, pub);
});

// POST /publicacoes/:id/despublicar { motivo }
router.post("/:id/despublicar", async (req: Request, res: Response) => {
  const pub = await carregar(req);
  if (papelNoOrgao(req) !== "admin_orgao") throw proibido("Só o administrador do órgão pode despublicar");
  if (pub.estado !== "publicado") throw new HttpError(400, "A publicação não está publicada");
  const { motivo } = motivoSchema.parse(req.body);
  pub.estado = "despublicado";
  registrarEvento(req, pub, "despublicado", motivo);
  await pub.save();
  await registrarAuditoria(req, { acao: "publicacao.despublicar", entidade: "Publicacao", entidadeId: pub._id, diff: { motivo } });
  responder(req, res, pub);
});

// DELETE /publicacoes/:id -> so rascunho que nunca foi publicado
router.delete("/:id", async (req: Request, res: Response) => {
  const pub = await carregar(req);
  if (!permissoes(req, pub).excluir) {
    throw new HttpError(400, "Só rascunhos que nunca foram publicados podem ser excluídos");
  }
  for (const a of pub.anexos) await apagarArquivo(a.chave);
  await Publicacao.deleteOne({ _id: pub._id });
  await registrarAuditoria(req, { acao: "publicacao.excluir", entidade: "Publicacao", entidadeId: pub._id, diff: { titulo: pub.titulo } });
  res.json({ ok: true });
});

// GET /publicacoes/:id/impressao.pdf[?parte=anexos] -> PDF para imprimir (qualquer estado)
// Dois caminhos: somente a publicacao (padrao) ou somente os anexos
router.get("/:id/impressao.pdf", async (req: Request, res: Response) => {
  const pub = await carregar(req);
  const m = req.municipio!;
  if (req.query.parte === "anexos") {
    const pdf = await gerarPdfAnexos(pub.anexos);
    if (!pdf) throw naoEncontrado("Esta publicação não tem anexos em PDF ou imagem para imprimir");
    return enviarPdf(res, pdf, `${pub.titulo} anexos`);
  }
  const pdf = await gerarPdfPublicacao({
    municipio: { nome: m.nome, uf: m.uf },
    orgao: { nome: req.orgao!.nome, logo: await logoParaPdf(req.orgao!) },
    publicacao: { ...dadosDaPublicacao(pub), vereadores: vinculosComNomes(pub, await mapaVereadores([pub])) },
    link: pub.estado === "publicado" ? `${env.clientUrl}/${m.slug}/p/${pub.slug}` : undefined,
  });
  enviarPdf(res, pdf, pub.titulo);
});

// ---------- anexos ----------

// POST /publicacoes/:id/anexos (multipart, campo "arquivo")
router.post("/:id/anexos", uploadAnexo, async (req: Request, res: Response) => {
  const pub = await carregar(req);
  if (pub.estado === "publicado" && !podePublicar(req)) throw proibido();
  if (!req.file) throw new HttpError(400, "Selecione um arquivo");
  if (pub.anexos.length >= 30) throw new HttpError(400, "Limite de 30 anexos por publicação");

  const nome = nomeOriginal(req.file);
  const chave = await salvarArquivo(
    `${pub.municipioId}/${pub.orgaoId}/${pub._id}`,
    nome,
    req.file.buffer,
    req.file.mimetype
  );
  // noCorpo=1: mostrar no lugar do texto (so imagem ou PDF)
  const noCorpo = req.body?.noCorpo === "1" && PODE_NO_CORPO.includes(req.file.mimetype);
  pub.anexos.push({ nome, chave, mime: req.file.mimetype, tamanho: req.file.size, enviadoEm: new Date(), noCorpo });
  registrarEvento(req, pub, "anexo_adicionado", nome);
  if (pub.estado === "publicado") pub.corrigidoEm = new Date();
  await pub.save();
  await registrarAuditoria(req, { acao: "publicacao.anexo_adicionar", entidade: "Publicacao", entidadeId: pub._id, diff: { nome } });
  responder(req, res, pub, 201);
});

// PATCH /publicacoes/:id/anexos/:anexoId { noCorpo } -> mostrar (ou nao) o arquivo no lugar do texto
router.patch("/:id/anexos/:anexoId", async (req: Request, res: Response) => {
  const pub = await carregar(req);
  if (pub.estado === "publicado" && !podePublicar(req)) throw proibido();
  const anexo = pub.anexos.id(String(req.params.anexoId));
  if (!anexo) throw naoEncontrado("Anexo não encontrado");
  const { noCorpo } = z.object({ noCorpo: z.boolean() }).parse(req.body);
  if (noCorpo && !PODE_NO_CORPO.includes(anexo.mime)) {
    throw new HttpError(400, "Só imagens (JPG, PNG, WEBP) e PDF podem ser mostrados no lugar do texto");
  }
  anexo.noCorpo = noCorpo;
  if (pub.estado === "publicado") pub.corrigidoEm = new Date();
  await pub.save();
  await registrarAuditoria(req, {
    acao: "publicacao.anexo_exibicao",
    entidade: "Publicacao",
    entidadeId: pub._id,
    diff: { nome: anexo.nome, noCorpo },
  });
  responder(req, res, pub);
});

// GET /publicacoes/:id/anexos/:anexoId -> visualizar no painel (qualquer estado)
router.get("/:id/anexos/:anexoId", async (req: Request, res: Response) => {
  const pub = await carregar(req);
  const anexo = pub.anexos.id(String(req.params.anexoId));
  if (!anexo) throw naoEncontrado("Anexo não encontrado");
  await enviarAnexo(res, anexo);
});

// DELETE /publicacoes/:id/anexos/:anexoId
router.delete("/:id/anexos/:anexoId", async (req: Request, res: Response) => {
  const pub = await carregar(req);
  if (pub.estado === "publicado" && !podePublicar(req)) throw proibido();
  const anexo = pub.anexos.id(String(req.params.anexoId));
  if (!anexo) throw naoEncontrado("Anexo não encontrado");

  const motivo = pub.estado === "publicado" ? motivoSchema.parse(req.body ?? {}).motivo : undefined;
  const { chave, nome } = anexo;
  anexo.deleteOne();
  registrarEvento(req, pub, "anexo_removido", motivo ? `${nome} — ${motivo}` : nome);
  if (pub.estado === "publicado") pub.corrigidoEm = new Date();
  await pub.save();
  await apagarArquivo(chave);
  await registrarAuditoria(req, { acao: "publicacao.anexo_remover", entidade: "Publicacao", entidadeId: pub._id, diff: { nome, motivo } });
  responder(req, res, pub);
});

export default router;
