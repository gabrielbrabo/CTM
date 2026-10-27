import { HydratedDocument, InferSchemaType, Schema, model } from "mongoose";
import { tenantScope } from "../plugins/tenantScope";

/**
 * Mensagem de um cidadao para um orgao (Fale com a Prefeitura/Camara).
 * A conversa fica em "respostas" (cidadao e servidores respondem).
 */
export const SITUACOES_MENSAGEM = ["aberta", "respondida", "encerrada"] as const;

const respostaSchema = new Schema(
  {
    autor: { type: String, enum: ["cidadao", "servidor"], required: true },
    usuarioId: { type: Schema.Types.ObjectId, ref: "Usuario" }, // servidor que respondeu
    nome: { type: String, required: true },
    texto: { type: String, required: true, trim: true, maxlength: 5000 },
    data: { type: Date, default: Date.now },
  },
  { _id: false }
);

const mensagemSchema = new Schema(
  {
    municipioId: { type: Schema.Types.ObjectId, ref: "Municipio", required: true },
    orgaoId: { type: Schema.Types.ObjectId, ref: "Orgao", required: true },
    cidadaoId: { type: Schema.Types.ObjectId, ref: "Cidadao", required: true },
    protocolo: { type: String, required: true }, // ex.: 2026-000123
    assunto: { type: String, required: true, trim: true, maxlength: 150 },
    respostas: { type: [respostaSchema], default: [] }, // a 1a e a mensagem do cidadao
    situacao: { type: String, enum: SITUACOES_MENSAGEM, default: "aberta" },
    lidaPeloOrgao: { type: Boolean, default: false },
    lidaPeloCidadao: { type: Boolean, default: true },
    ultimaAtividade: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

mensagemSchema.index({ municipioId: 1, orgaoId: 1, situacao: 1, ultimaAtividade: -1 });
mensagemSchema.index({ municipioId: 1, orgaoId: 1, lidaPeloOrgao: 1 });
mensagemSchema.index({ cidadaoId: 1, ultimaAtividade: -1 });
mensagemSchema.plugin(tenantScope);

export type MensagemDoc = HydratedDocument<InferSchemaType<typeof mensagemSchema>>;
export const Mensagem = model("Mensagem", mensagemSchema, "mensagens");
