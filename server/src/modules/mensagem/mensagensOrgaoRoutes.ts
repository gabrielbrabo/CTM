import { Request, Response, Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { Cidadao } from "../../models/Cidadao";
import { Mensagem, MensagemDoc, SITUACOES_MENSAGEM } from "../../models/Mensagem";
import { registrarAuditoria } from "../../utils/audit";
import { HttpError, naoEncontrado } from "../../utils/httpError";
import { notificarResposta } from "../cidadao/notificar";

/**
 * Mensagens da populacao recebidas pelo orgao (painel).
 * Montado em /api/admin/o/:orgaoId/mensagens. Todos do orgao podem ler e responder.
 */
const router = Router({ mergeParams: true });

async function comCidadaos(lista: MensagemDoc[]) {
  const cidadaos = await Cidadao.find({ _id: { $in: lista.map((m) => m.cidadaoId) } }).select("nome email telefone").lean();
  return new Map(cidadaos.map((c) => [String(c._id), { nome: c.nome, email: c.email, telefone: c.telefone ?? null }]));
}

function paraJson(m: MensagemDoc, cidadao?: { nome: string; email: string; telefone: string | null }) {
  return {
    id: String(m._id),
    protocolo: m.protocolo,
    assunto: m.assunto,
    situacao: m.situacao,
    lida: m.lidaPeloOrgao,
    criadaEm: (m as unknown as { createdAt: Date }).createdAt,
    ultimaAtividade: m.ultimaAtividade,
    cidadao: cidadao ?? null,
    respostas: m.respostas.map((r) => ({ autor: r.autor, nome: r.nome, texto: r.texto, data: r.data })),
  };
}

async function carregar(req: Request) {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw naoEncontrado("Mensagem não encontrada");
  const m = await Mensagem.findOne({ _id: id, orgaoId: req.orgao!._id });
  if (!m) throw naoEncontrado("Mensagem não encontrada");
  return m;
}

// GET /mensagens?situacao=aberta&pagina=1
router.get("/", async (req: Request, res: Response) => {
  const filtro: Record<string, unknown> = { orgaoId: req.orgao!._id };
  const situacao = String(req.query.situacao || "");
  if ((SITUACOES_MENSAGEM as readonly string[]).includes(situacao)) filtro.situacao = situacao;
  if (req.query.naoLidas === "1") filtro.lidaPeloOrgao = false;
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const porPagina = 20;
  const [lista, total, naoLidas, porSituacao] = await Promise.all([
    Mensagem.find(filtro).sort({ lidaPeloOrgao: 1, ultimaAtividade: -1 }).skip((pagina - 1) * porPagina).limit(porPagina),
    Mensagem.countDocuments(filtro),
    Mensagem.countDocuments({ orgaoId: req.orgao!._id, lidaPeloOrgao: false }),
    Mensagem.aggregate<{ _id: string; total: number }>([{ $match: { orgaoId: req.orgao!._id } }, { $group: { _id: "$situacao", total: { $sum: 1 } } }]),
  ]);
  const cidadaos = await comCidadaos(lista);
  res.json({
    total,
    naoLidas,
    pagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    porSituacao: Object.fromEntries(porSituacao.map((s) => [s._id, s.total])),
    itens: lista.map((m) => {
      const j = paraJson(m, cidadaos.get(String(m.cidadaoId)));
      const ultima = m.respostas[m.respostas.length - 1];
      return { ...j, respostas: undefined, total: m.respostas.length, previa: ultima?.texto.slice(0, 160) ?? "" };
    }),
  });
});

// GET /mensagens/:id -> conversa (marca como lida pelo orgao)
router.get("/:id", async (req: Request, res: Response) => {
  const m = await carregar(req);
  if (!m.lidaPeloOrgao) {
    m.lidaPeloOrgao = true;
    await m.save();
  }
  const cidadaos = await comCidadaos([m]);
  res.json(paraJson(m, cidadaos.get(String(m.cidadaoId))));
});

// POST /mensagens/:id/responder { texto, encerrar? }
router.post("/:id/responder", async (req: Request, res: Response) => {
  const { texto, encerrar } = z
    .object({ texto: z.string().trim().min(2, "Escreva a resposta").max(5000), encerrar: z.boolean().optional() })
    .parse(req.body);
  const m = await carregar(req);
  const u = req.usuario!;
  m.respostas.push({ autor: "servidor", usuarioId: u._id, nome: `${u.nome} (${req.orgao!.nome})`, texto, data: new Date() });
  m.situacao = encerrar ? "encerrada" : "respondida";
  m.lidaPeloOrgao = true;
  m.lidaPeloCidadao = false;
  m.ultimaAtividade = new Date();
  await m.save();
  await registrarAuditoria(req, { acao: "mensagem.responder", entidade: "Mensagem", entidadeId: m._id, diff: { protocolo: m.protocolo, encerrar: Boolean(encerrar) } });
  await notificarResposta({ cidadaoId: m.cidadaoId, orgaoNome: req.orgao!.nome, assunto: m.assunto, mensagemId: String(m._id) });
  const cidadaos = await comCidadaos([m]);
  res.json(paraJson(m, cidadaos.get(String(m.cidadaoId))));
});

// POST /mensagens/:id/situacao { situacao } -> encerrar ou reabrir
router.post("/:id/situacao", async (req: Request, res: Response) => {
  const { situacao } = z.object({ situacao: z.enum(SITUACOES_MENSAGEM) }).parse(req.body);
  const m = await carregar(req);
  if (situacao === "respondida" && !m.respostas.some((r) => r.autor === "servidor")) throw new HttpError(400, "Responda antes de marcar como respondida");
  m.situacao = situacao;
  await m.save();
  await registrarAuditoria(req, { acao: "mensagem.situacao", entidade: "Mensagem", entidadeId: m._id, diff: { protocolo: m.protocolo, situacao } });
  const cidadaos = await comCidadaos([m]);
  res.json(paraJson(m, cidadaos.get(String(m.cidadaoId))));
});

export default router;
