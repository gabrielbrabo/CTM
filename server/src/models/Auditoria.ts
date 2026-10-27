import { InferSchemaType, MongooseDefaultQueryMiddleware, Schema, model } from "mongoose";
import { tenantScope } from "../plugins/tenantScope";

// Log de auditoria: so recebe inclusoes. Alterar ou apagar e bloqueado.
const auditoriaSchema = new Schema(
  {
    // Opcional: acoes da plataforma (GADZ) podem nao ter municipio
    municipioId: { type: Schema.Types.ObjectId, ref: "Municipio", default: null },
    // Orgao (Prefeitura/Camara) da acao, para o historico do proprio orgao
    orgaoId: { type: Schema.Types.ObjectId, ref: "Orgao", default: null },
    usuarioId: { type: Schema.Types.ObjectId, ref: "Usuario", default: null },
    acao: { type: String, required: true },
    entidade: { type: String, required: true },
    entidadeId: { type: String, default: null },
    diff: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: "criadoEm", updatedAt: false } }
);

auditoriaSchema.index({ municipioId: 1, criadoEm: -1 });
auditoriaSchema.index({ municipioId: 1, entidade: 1, entidadeId: 1 });
auditoriaSchema.index({ orgaoId: 1, criadoEm: -1 });
auditoriaSchema.index({ criadoEm: -1 });
auditoriaSchema.index({ usuarioId: 1, criadoEm: -1 });
auditoriaSchema.plugin(tenantScope);

const OPERACOES_PROIBIDAS: MongooseDefaultQueryMiddleware[] = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
];

auditoriaSchema.pre(OPERACOES_PROIBIDAS, function () {
  throw new Error("Registros de auditoria nao podem ser alterados nem apagados");
});

export type AuditoriaAttrs = InferSchemaType<typeof auditoriaSchema>;
export const Auditoria = model("Auditoria", auditoriaSchema, "auditoria");
