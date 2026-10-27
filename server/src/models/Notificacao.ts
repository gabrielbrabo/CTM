import { InferSchemaType, Schema, model } from "mongoose";

/**
 * Notificacao para o cidadao (sininho do portal).
 * Criada quando um orgao do municipio que ele segue publica algo,
 * ou quando um servidor responde a mensagem dele.
 * (Futuro: o mesmo registro alimenta o envio para o app do celular.)
 */
const notificacaoSchema = new Schema(
  {
    cidadaoId: { type: Schema.Types.ObjectId, ref: "Cidadao", required: true },
    tipo: { type: String, enum: ["publicacao", "resposta"], required: true },
    titulo: { type: String, required: true, maxlength: 250 },
    texto: { type: String, maxlength: 300 },
    link: { type: String, required: true }, // caminho no portal (ex.: /sao-romao/p/decreto-15)
    municipioId: { type: Schema.Types.ObjectId, ref: "Municipio" },
    lida: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "criadaEm", updatedAt: false } }
);

notificacaoSchema.index({ cidadaoId: 1, lida: 1, criadaEm: -1 });
// Notificacoes antigas somem sozinhas depois de 180 dias
notificacaoSchema.index({ criadaEm: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });

export type NotificacaoAttrs = InferSchemaType<typeof notificacaoSchema>;
export const Notificacao = model("Notificacao", notificacaoSchema, "notificacoes");
