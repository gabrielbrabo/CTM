import { Request, Response, Router } from "express";
import { z } from "zod";
import { exigePapel, papelNoOrgao } from "../../middleware/orgao";
import { Publicacao } from "../../models/Publicacao";
import multer from "multer";
import { env } from "../../config/env";
import { registrarAuditoria } from "../../utils/audit";
import { nomeOriginal } from "../../utils/anexos";
import { extrairTexto, MIMES_EXTRACAO, sugerirTitulo } from "../../utils/extrairTexto";
import { HttpError } from "../../utils/httpError";
import { trocarImagem, uploadImagem, urlLogoOrgao } from "../../utils/imagens";
import { apagarArquivo } from "../../utils/storage";
import publicacaoRoutes from "../publicacao/publicacaoRoutes";
import usuariosOrgaoRoutes from "./usuariosOrgaoRoutes";
import { listarHistorico } from "../historico/historico";
import vereadorRoutes from "../vereador/vereadorRoutes";
import mensagensOrgaoRoutes from "../mensagem/mensagensOrgaoRoutes";
import { Mensagem } from "../../models/Mensagem";

/**
 * Painel do orgao. Montado em /api/admin/o/:orgaoId (protect + orgaoAdmin ja rodaram).
 */
const router = Router({ mergeParams: true });

// GET /api/admin/o/:orgaoId -> dados do orgao, meu papel e contadores
router.get("/", async (req: Request, res: Response) => {
  const o = req.orgao!;
  const m = req.municipio!;
  const contagem = await Publicacao.aggregate([
    { $match: { orgaoId: o._id } },
    { $group: { _id: "$estado", total: { $sum: 1 } } },
  ]);
  const porEstado = Object.fromEntries(contagem.map((c: { _id: string; total: number }) => [c._id, c.total]));
  const mensagensNaoLidas = await Mensagem.countDocuments({ orgaoId: o._id, lidaPeloOrgao: false });

  res.json({
    orgao: {
      id: String(o._id),
      tipo: o.tipo,
      nome: o.nome,
      situacao: o.situacao,
      exigeRevisao: Boolean(o.exigeRevisao),
      plenario: o.plenario ?? null,
      logoUrl: urlLogoOrgao(o),
      contatos: o.contatos ?? {},
      recebeMensagens: o.recebeMensagens !== false,
    },
    mensagensNaoLidas,
    municipio: { id: String(m._id), nome: m.nome, uf: m.uf, slug: m.slug },
    papel: papelNoOrgao(req),
    publicacoes: {
      rascunho: porEstado.rascunho ?? 0,
      em_revisao: porEstado.em_revisao ?? 0,
      publicado: porEstado.publicado ?? 0,
      despublicado: porEstado.despublicado ?? 0,
    },
  });
});

// PATCH /api/admin/o/:orgaoId/config -> configuracoes do orgao (so admin do orgao)
router.patch("/config", exigePapel("admin_orgao"), async (req: Request, res: Response) => {
  const dados = z
    .object({
      exigeRevisao: z.boolean().optional(),
      // Camara: nome do plenario
      plenario: z.string().trim().max(200).optional(),
      // Contato para a populacao (aparece no portal)
      contatos: z
        .object({
          email: z.string().trim().max(150).optional(),
          telefone: z.string().trim().max(40).optional(),
          whatsapp: z.string().trim().max(40).optional(),
          endereco: z.string().trim().max(300).optional(),
          horario: z.string().trim().max(200).optional(),
          site: z.string().trim().max(300).optional(),
        })
        .optional(),
      recebeMensagens: z.boolean().optional(),
    })
    .parse(req.body);
  const orgao = req.orgao!;
  if (dados.exigeRevisao !== undefined) orgao.exigeRevisao = dados.exigeRevisao;
  if (dados.plenario !== undefined && orgao.tipo === "camara") orgao.plenario = dados.plenario || undefined;
  if (dados.contatos) {
    if (dados.contatos.email && !z.string().email().safeParse(dados.contatos.email).success) throw new HttpError(400, "E-mail de contato inválido");
    orgao.set("contatos", { ...(orgao.toObject().contatos ?? {}), ...dados.contatos });
  }
  if (dados.recebeMensagens !== undefined) orgao.recebeMensagens = dados.recebeMensagens;
  await orgao.save();
  await registrarAuditoria(req, { acao: "orgao.config", entidade: "Orgao", entidadeId: orgao._id, diff: dados });
  res.json({ exigeRevisao: orgao.exigeRevisao, plenario: orgao.plenario ?? null, contatos: orgao.contatos ?? {}, recebeMensagens: orgao.recebeMensagens !== false });
});

// POST /api/admin/o/:orgaoId/logo -> troca a logo do orgao (so admin do orgao)
router.post("/logo", exigePapel("admin_orgao"), uploadImagem, async (req: Request, res: Response) => {
  const orgao = req.orgao!;
  const nova = await trocarImagem(req, `${orgao.municipioId}/${orgao._id}/logo`, orgao.logoKey);
  orgao.set({ logoKey: nova.chave, logoMime: nova.mime, logoAtualizadoEm: nova.atualizadoEm });
  await orgao.save();
  await registrarAuditoria(req, { acao: "orgao.logo", entidade: "Orgao", entidadeId: orgao._id });
  res.json({ logoUrl: urlLogoOrgao(orgao) });
});

// DELETE /api/admin/o/:orgaoId/logo
router.delete("/logo", exigePapel("admin_orgao"), async (req: Request, res: Response) => {
  const orgao = req.orgao!;
  if (orgao.logoKey) await apagarArquivo(orgao.logoKey);
  orgao.set({ logoKey: undefined, logoMime: undefined, logoAtualizadoEm: undefined });
  await orgao.save();
  await registrarAuditoria(req, { acao: "orgao.logo_remover", entidade: "Orgao", entidadeId: orgao._id });
  res.json({ logoUrl: null });
});

// Upload so para leitura do texto (o arquivo nao e guardado aqui)
const uploadExtracao = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.anexoMaxMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (MIMES_EXTRACAO[file.mimetype]) cb(null, true);
    else cb(new HttpError(400, "Para extrair o texto envie PDF, Word (.docx/.doc), ODT, imagem (JPG/PNG/WEBP) ou TXT."));
  },
}).single("arquivo");

// POST /api/admin/o/:orgaoId/extrair-texto -> le o texto de PDF, Word, imagem (OCR)...
router.post("/extrair-texto", uploadExtracao, async (req: Request, res: Response) => {
  if (!req.file) throw new HttpError(400, "Selecione um arquivo");
  const { texto, metodo, semTexto } = await extrairTexto(req.file.buffer, req.file.mimetype);
  const nomeArquivo = nomeOriginal(req.file);
  // semTexto: PDF escaneado -> o painel oferece mostrar o documento no lugar do texto
  const tituloSugerido = semTexto ? nomeArquivo.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") : sugerirTitulo(texto);
  res.json({ texto, metodo, semTexto, tituloSugerido, nomeArquivo });
});

// GET /api/admin/o/:orgaoId/historico -> movimentacao deste orgao (so administrador)
router.get("/historico", exigePapel("admin_orgao"), async (req: Request, res: Response) => {
  res.json(await listarHistorico(req, { orgaoId: req.orgao!._id }));
});

router.use("/usuarios", usuariosOrgaoRoutes);
router.use("/vereadores", vereadorRoutes);
router.use("/mensagens", mensagensOrgaoRoutes);
router.use("/publicacoes", publicacaoRoutes);

export default router;
