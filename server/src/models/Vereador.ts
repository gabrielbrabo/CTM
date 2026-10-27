import { HydratedDocument, InferSchemaType, Schema, model } from "mongoose";
import { tenantScope } from "../plugins/tenantScope";

/**
 * Vereadores da Camara (cadastro publico: NAO acessam o sistema).
 * Aparecem no portal e sao ligados as publicacoes como autores,
 * relator, votos nominais e presenca nas sessoes.
 */

// Situacao do mandato
export const SITUACOES_VEREADOR = ["exercicio", "licenciado", "afastado", "suplente", "ex"] as const;
export type SituacaoVereador = (typeof SITUACOES_VEREADOR)[number];

// Cargo na Mesa Diretora (ou "vereador" quando nao faz parte da Mesa)
export const CARGOS_MESA = [
  "presidente",
  "vice_presidente",
  "primeiro_secretario",
  "segundo_secretario",
  "vereador",
] as const;

const vereadorSchema = new Schema(
  {
    municipioId: { type: Schema.Types.ObjectId, ref: "Municipio", required: true },
    orgaoId: { type: Schema.Types.ObjectId, ref: "Orgao", required: true }, // a Camara
    nome: { type: String, required: true, trim: true, maxlength: 150 }, // nome civil
    nomeParlamentar: { type: String, trim: true, maxlength: 80 }, // como e conhecido
    partido: { type: String, trim: true, maxlength: 20 }, // sigla
    cargoMesa: { type: String, enum: CARGOS_MESA, default: "vereador" },
    situacao: { type: String, enum: SITUACOES_VEREADOR, default: "exercicio" },
    legislatura: { type: String, trim: true, maxlength: 30 }, // ex.: "2025-2028"
    mandatoInicio: Date,
    mandatoFim: Date,
    email: { type: String, trim: true, lowercase: true, maxlength: 150 },
    telefone: { type: String, trim: true, maxlength: 40 },
    gabinete: { type: String, trim: true, maxlength: 150 },
    redeSocial: { type: String, trim: true, maxlength: 300 }, // link (Instagram, Facebook...)
    biografia: { type: String, trim: true, maxlength: 5000 },
    ordem: { type: Number, default: 0 }, // ordem na lista (menor primeiro)
    mostrarNoPortal: { type: Boolean, default: true },
    fotoKey: String,
    fotoMime: String,
    fotoAtualizadoEm: Date,
  },
  { timestamps: true }
);

vereadorSchema.index({ municipioId: 1, orgaoId: 1, situacao: 1, ordem: 1, nome: 1 });
vereadorSchema.plugin(tenantScope);

export type VereadorAttrs = InferSchemaType<typeof vereadorSchema>;
export type VereadorDoc = HydratedDocument<VereadorAttrs>;
export const Vereador = model("Vereador", vereadorSchema, "vereadores");

// Nome para mostrar: o parlamentar, se tiver
export const nomeExibicao = (v: { nome: string; nomeParlamentar?: string | null }) => v.nomeParlamentar || v.nome;
