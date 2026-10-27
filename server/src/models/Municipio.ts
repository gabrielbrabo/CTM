import { HydratedDocument, InferSchemaType, Schema, model } from "mongoose";

// Municipio e o proprio tenant: NAO usa o plugin tenantScope
const municipioSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]+$/ },
    nome: { type: String, required: true, trim: true },
    uf: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    codigoIbge: { type: String, trim: true },
    // Brasao/logo do municipio (chave no disco ou S3) e quando foi trocado (para atualizar o cache)
    brasaoKey: { type: String },
    brasaoMime: { type: String },
    brasaoAtualizadoEm: { type: Date },
    tema: {
      corPrimaria: { type: String, default: "#1d4ed8" },
      corSecundaria: { type: String, default: "#0f172a" },
    },
    contatos: {
      email: String,
      telefone: String,
      site: String,
      endereco: String,
    },
    plano: { type: String, default: "basico" },
    ativo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type MunicipioAttrs = InferSchemaType<typeof municipioSchema>;
export type MunicipioDoc = HydratedDocument<MunicipioAttrs>;
export const Municipio = model("Municipio", municipioSchema, "municipios");
