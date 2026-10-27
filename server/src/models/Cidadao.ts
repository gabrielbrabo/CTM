import { HydratedDocument, InferSchemaType, Schema, model } from "mongoose";

/**
 * Cidadao: conta da POPULACAO no portal (separada dos servidores).
 * Serve para mandar mensagens aos orgaos e receber notificacoes.
 * Para LER o portal nao precisa de conta.
 * Nao usa o tenantScope: a mesma conta vale para todos os municipios.
 */
const inscricaoSchema = new Schema(
  {
    municipioId: { type: Schema.Types.ObjectId, ref: "Municipio", required: true },
    desde: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cidadaoSchema = new Schema(
  {
    nome: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 150 },
    telefone: { type: String, trim: true, maxlength: 30 },
    senhaHash: { type: String, required: true, select: false },
    ativo: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    // Municipios em que ativou as notificacoes
    inscricoes: { type: [inscricaoSchema], default: [] },
    ultimoLogin: Date,
  },
  { timestamps: true }
);

cidadaoSchema.index({ "inscricoes.municipioId": 1 });

export type CidadaoAttrs = InferSchemaType<typeof cidadaoSchema>;
export type CidadaoDoc = HydratedDocument<CidadaoAttrs>;
export const Cidadao = model("Cidadao", cidadaoSchema, "cidadaos");
