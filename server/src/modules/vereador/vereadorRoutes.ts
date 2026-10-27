import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { exigePapel } from "../../middleware/orgao";
import { Publicacao } from "../../models/Publicacao";
import { CARGOS_MESA, SITUACOES_VEREADOR, Vereador, VereadorDoc } from "../../models/Vereador";
import { registrarAuditoria } from "../../utils/audit";
import { HttpError, naoEncontrado } from "../../utils/httpError";
import { trocarImagem, uploadImagem, urlFotoVereador } from "../../utils/imagens";
import { apagarArquivo } from "../../utils/storage";
import { camaraDoMunicipio } from "./vinculos";

/**
 * Cadastro de vereadores (painel da Camara). Montado em /api/admin/o/:orgaoId/vereadores
 * - Todos do orgao podem LISTAR (para escolher autores, votos, presenca)
 * - So o administrador do orgao cadastra, edita, troca foto e exclui
 */
const router = Router({ mergeParams: true });

// Prefeitura: so pode LISTAR os vereadores da Camara do municipio (para lancar votacao)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  if (req.orgao?.tipo === "camara") return next();
  const camaraId = await camaraDoMunicipio(req.orgao!);
  const lista = camaraId ? await Vereador.find({ orgaoId: camaraId }) : [];
  res.json(ordenarVereadores(lista).map(vereadorParaJson));
});

// Cadastro, edicao e fotos: so na Camara
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.orgao?.tipo !== "camara") throw naoEncontrado("Cadastro de vereadores é só da Câmara");
  next();
});

const vazioParaUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
const texto = (max: number) => z.preprocess(vazioParaUndef, z.string().trim().max(max).optional());

const dadosSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome").max(150),
  nomeParlamentar: texto(80),
  partido: texto(20),
  cargoMesa: z.enum(CARGOS_MESA).optional(),
  situacao: z.enum(SITUACOES_VEREADOR).optional(),
  legislatura: texto(30),
  mandatoInicio: z.preprocess(vazioParaUndef, z.coerce.date().optional()),
  mandatoFim: z.preprocess(vazioParaUndef, z.coerce.date().optional()),
  email: z.preprocess(vazioParaUndef, z.string().trim().toLowerCase().email("E-mail inválido").optional()),
  telefone: texto(40),
  gabinete: texto(150),
  redeSocial: z.preprocess(vazioParaUndef, z.string().trim().url("Link inválido (comece com https://)").optional()),
  biografia: texto(5000),
  ordem: z.coerce.number().int().min(0).max(999).optional(),
  mostrarNoPortal: z.boolean().optional(),
});

export function vereadorParaJson(v: VereadorDoc) {
  return {
    id: String(v._id),
    nome: v.nome,
    nomeParlamentar: v.nomeParlamentar ?? null,
    partido: v.partido ?? null,
    cargoMesa: v.cargoMesa,
    situacao: v.situacao,
    legislatura: v.legislatura ?? null,
    mandatoInicio: v.mandatoInicio ?? null,
    mandatoFim: v.mandatoFim ?? null,
    email: v.email ?? null,
    telefone: v.telefone ?? null,
    gabinete: v.gabinete ?? null,
    redeSocial: v.redeSocial ?? null,
    biografia: v.biografia ?? null,
    ordem: v.ordem ?? 0,
    mostrarNoPortal: v.mostrarNoPortal !== false,
    fotoUrl: urlFotoVereador(v),
  };
}

async function carregar(req: Request): Promise<VereadorDoc> {
  const v = await Vereador.findOne({ _id: req.params.id, orgaoId: req.orgao!._id });
  if (!v) throw naoEncontrado("Vereador não encontrado");
  return v;
}

// Quem esta em exercicio primeiro; depois a ordem escolhida e o nome
const ORDEM_SITUACAO: Record<string, number> = { exercicio: 0, licenciado: 1, afastado: 2, suplente: 3, ex: 4 };
// Mesa Diretora primeiro (presidente, vice, secretarios)
const ORDEM_CARGO: Record<string, number> = { presidente: 0, vice_presidente: 1, primeiro_secretario: 2, segundo_secretario: 3, vereador: 4 };
export const ordenarVereadores = <
  T extends { situacao?: string | null; cargoMesa?: string | null; ordem?: number | null; nome: string; nomeParlamentar?: string | null },
>(
  lista: T[]
) =>
  [...lista].sort(
    (a, b) =>
      (ORDEM_SITUACAO[a.situacao ?? "exercicio"] ?? 9) - (ORDEM_SITUACAO[b.situacao ?? "exercicio"] ?? 9) ||
      (ORDEM_CARGO[a.cargoMesa ?? "vereador"] ?? 9) - (ORDEM_CARGO[b.cargoMesa ?? "vereador"] ?? 9) ||
      (a.ordem ?? 0) - (b.ordem ?? 0) ||
      (a.nomeParlamentar || a.nome).localeCompare(b.nomeParlamentar || b.nome, "pt-BR")
  );

// GET /vereadores
router.get("/", async (req: Request, res: Response) => {
  const lista = await Vereador.find({ orgaoId: req.orgao!._id });
  res.json(ordenarVereadores(lista).map(vereadorParaJson));
});

// POST /vereadores
router.post("/", exigePapel("admin_orgao"), async (req: Request, res: Response) => {
  const dados = dadosSchema.parse(req.body);
  const v = await Vereador.create({ ...dados, orgaoId: req.orgao!._id });
  await registrarAuditoria(req, { acao: "vereador.criar", entidade: "Vereador", entidadeId: v._id, diff: dados });
  res.status(201).json(vereadorParaJson(v));
});

// PATCH /vereadores/:id
router.patch("/:id", exigePapel("admin_orgao"), async (req: Request, res: Response) => {
  const v = await carregar(req);
  const dados = dadosSchema.partial().parse(req.body);
  v.set(dados);
  await v.save();
  await registrarAuditoria(req, { acao: "vereador.editar", entidade: "Vereador", entidadeId: v._id, diff: dados });
  res.json(vereadorParaJson(v));
});

// DELETE /vereadores/:id -> so se nao estiver em nenhuma publicacao
router.delete("/:id", exigePapel("admin_orgao"), async (req: Request, res: Response) => {
  const v = await carregar(req);
  const usado = await Publicacao.exists({
    $or: [{ autoresIds: v._id }, { relatorId: v._id }, { "votos.vereadorId": v._id }, { "presencas.vereadorId": v._id }],
  });
  if (usado) {
    throw new HttpError(
      409,
      "Este vereador aparece em publicações (autoria, votos ou presença). Em vez de excluir, mude a situação para “Ex-vereador”."
    );
  }
  if (v.fotoKey) await apagarArquivo(v.fotoKey);
  await v.deleteOne();
  await registrarAuditoria(req, { acao: "vereador.excluir", entidade: "Vereador", entidadeId: v._id, diff: { nome: v.nome } });
  res.json({ ok: true });
});

// POST /vereadores/:id/foto (campo "imagem")
router.post("/:id/foto", exigePapel("admin_orgao"), uploadImagem, async (req: Request, res: Response) => {
  const v = await carregar(req);
  const nova = await trocarImagem(req, `${v.municipioId}/${v.orgaoId}/vereadores/${v._id}`, v.fotoKey);
  v.set({ fotoKey: nova.chave, fotoMime: nova.mime, fotoAtualizadoEm: nova.atualizadoEm });
  await v.save();
  await registrarAuditoria(req, { acao: "vereador.foto", entidade: "Vereador", entidadeId: v._id });
  res.json(vereadorParaJson(v));
});

// DELETE /vereadores/:id/foto
router.delete("/:id/foto", exigePapel("admin_orgao"), async (req: Request, res: Response) => {
  const v = await carregar(req);
  if (v.fotoKey) await apagarArquivo(v.fotoKey);
  v.set({ fotoKey: undefined, fotoMime: undefined, fotoAtualizadoEm: undefined });
  await v.save();
  await registrarAuditoria(req, { acao: "vereador.foto_remover", entidade: "Vereador", entidadeId: v._id });
  res.json(vereadorParaJson(v));
});

export default router;
