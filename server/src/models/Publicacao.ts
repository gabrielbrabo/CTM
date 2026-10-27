import { HydratedDocument, InferSchemaType, Schema, model } from "mongoose";
import { IDS_TIPOS, textoBuscaDetalhes } from "../config/tiposPublicacao";
import { tenantScope } from "../plugins/tenantScope";

// Tipos vem do catalogo (config/tiposPublicacao.ts): Camara, Prefeitura e compartilhados
export const TIPOS_PUBLICACAO = IDS_TIPOS;

/**
 * Fluxo editorial:
 *  rascunho -> (em_revisao, se o orgao exigir revisao) -> publicado -> despublicado
 *  em_revisao pode ser "devolvido" -> volta para rascunho
 */
export const ESTADOS_PUBLICACAO = ["rascunho", "em_revisao", "publicado", "despublicado"] as const;
export type EstadoPublicacao = (typeof ESTADOS_PUBLICACAO)[number];

// Aviso mostrado ao cidadao sobre a informacao
export const CONFIABILIDADES = ["oficial", "pendente_confirmacao"] as const;

export const EVENTOS_HISTORICO = [
  "criado",
  "editado",
  "enviado_revisao",
  "devolvido",
  "publicado",
  "corrigido",
  "despublicado",
  "anexo_adicionado",
  "anexo_removido",
] as const;
export type EventoHistorico = (typeof EVENTOS_HISTORICO)[number];

const anexoSchema = new Schema(
  {
    nome: { type: String, required: true }, // nome original do arquivo
    chave: { type: String, required: true }, // caminho no disco ou chave no S3
    mime: { type: String, required: true },
    tamanho: { type: Number, required: true }, // bytes
    enviadoEm: { type: Date, default: Date.now },
    // Mostrar este arquivo (imagem ou PDF escaneado) no lugar do texto da publicacao
    noCorpo: { type: Boolean, default: false },
  },
  { _id: true }
);

const historicoSchema = new Schema(
  {
    evento: { type: String, enum: EVENTOS_HISTORICO, required: true },
    data: { type: Date, default: Date.now },
    usuarioId: { type: Schema.Types.ObjectId, ref: "Usuario" },
    usuarioNome: String,
    motivo: String,
  },
  { _id: false }
);

// Voto nominal de cada vereador
export const VOTOS = ["sim", "nao", "abstencao", "ausente"] as const;
// Presenca na sessao
export const PRESENCAS = ["presente", "ausente", "justificada"] as const;

const votoSchema = new Schema(
  {
    vereadorId: { type: Schema.Types.ObjectId, ref: "Vereador", required: true },
    voto: { type: String, enum: VOTOS, required: true },
  },
  { _id: false }
);

const presencaSchema = new Schema(
  {
    vereadorId: { type: Schema.Types.ObjectId, ref: "Vereador", required: true },
    situacao: { type: String, enum: PRESENCAS, required: true },
  },
  { _id: false }
);

// "PL nº 012/2026" e "12/2026" sao o mesmo numero
export function normalizarNumero(v?: string | null): string {
  if (!v) return "";
  // So numeros e separadores ("PL nº 012/2026" -> "12/2026"); tira zeros a esquerda
  return v
    .replace(/[^0-9/.-]+/g, "")
    .replace(/(^|[/.-])0+(\d)/g, "$1$2")
    .replace(/^[/.-]+|[/.-]+$/g, "");
}

// Titulo sem acento, caixa e pontuacao
export function normalizarTitulo(v?: string | null): string {
  if (!v) return "";
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const publicacaoSchema = new Schema(
  {
    municipioId: { type: Schema.Types.ObjectId, ref: "Municipio", required: true },
    orgaoId: { type: Schema.Types.ObjectId, ref: "Orgao", required: true },
    tipo: { type: String, enum: TIPOS_PUBLICACAO, required: true },
    // Campos especificos do tipo (ex.: autor/ementa/situacao de um projeto de lei)
    detalhes: { type: Schema.Types.Mixed, default: {} },
    // Texto dos detalhes para a busca (preenchido automaticamente)
    buscaExtra: { type: String, select: false },
    titulo: { type: String, required: true, trim: true, maxlength: 250 },
    // Parte do link publico: /:municipio/p/:slug
    slug: { type: String, required: true },
    numero: { type: String, trim: true }, // ex.: "012/2026"
    dataReferencia: Date, // data do fato/documento
    resumo: { type: String, trim: true, maxlength: 1000 }, // linguagem simples
    conteudo: { type: String, trim: true, maxlength: 100_000 }, // texto (sem HTML)
    fonte: {
      nome: { type: String, trim: true },
      url: { type: String, trim: true },
    },
    confiabilidade: { type: String, enum: CONFIABILIDADES, default: "oficial" },
    estado: { type: String, enum: ESTADOS_PUBLICACAO, default: "rascunho" },
    publicadoEm: Date,
    corrigidoEm: Date,
    anexos: { type: [anexoSchema], default: [] },
    // Ligacoes com os vereadores (so Camara; quais valem depende do tipo)
    autoresIds: { type: [{ type: Schema.Types.ObjectId, ref: "Vereador" }], default: [] },
    relatorId: { type: Schema.Types.ObjectId, ref: "Vereador", default: null },
    votos: { type: [votoSchema], default: [] },
    presencas: { type: [presencaSchema], default: [] },
    historico: { type: [historicoSchema], default: [] },
    // Para impedir publicacao repetida (preenchidos automaticamente)
    numeroNormalizado: { type: String, select: false },
    tituloNormalizado: { type: String, select: false },
    criadoPor: { type: Schema.Types.ObjectId, ref: "Usuario" },
    atualizadoPor: { type: Schema.Types.ObjectId, ref: "Usuario" },
  },
  { timestamps: true }
);

publicacaoSchema.index({ municipioId: 1, slug: 1 }, { unique: true });
publicacaoSchema.index({ municipioId: 1, orgaoId: 1, tipo: 1, numeroNormalizado: 1 });
publicacaoSchema.index({ municipioId: 1, orgaoId: 1, tipo: 1, tituloNormalizado: 1 });
publicacaoSchema.index({ municipioId: 1, orgaoId: 1, estado: 1, publicadoEm: -1 });
publicacaoSchema.index({ municipioId: 1, estado: 1, publicadoEm: -1 });
// Perfil do vereador: autorias, votos e presencas
publicacaoSchema.index({ municipioId: 1, autoresIds: 1, publicadoEm: -1 });
publicacaoSchema.index({ municipioId: 1, "votos.vereadorId": 1 });
publicacaoSchema.index({ municipioId: 1, "presencas.vereadorId": 1 });
// Busca por palavras em portugues (ignora "de", "da"... e entende plural/singular)
publicacaoSchema.index(
  { titulo: "text", numero: "text", resumo: "text", buscaExtra: "text", conteudo: "text" },
  {
    weights: { titulo: 10, numero: 8, resumo: 4, buscaExtra: 4, conteudo: 1 },
    default_language: "portuguese",
    name: "busca_texto_v2",
  }
);

// Atualiza o texto de busca dos detalhes a cada gravacao
publicacaoSchema.pre("validate", function () {
  this.buscaExtra = textoBuscaDetalhes(this.tipo, this.detalhes as Record<string, unknown>);
  this.numeroNormalizado = normalizarNumero(this.numero) || undefined;
  this.tituloNormalizado = normalizarTitulo(this.titulo) || undefined;
});
publicacaoSchema.plugin(tenantScope);

export type PublicacaoAttrs = InferSchemaType<typeof publicacaoSchema>;
export type PublicacaoDoc = HydratedDocument<PublicacaoAttrs>;
export const Publicacao = model("Publicacao", publicacaoSchema, "publicacoes");
