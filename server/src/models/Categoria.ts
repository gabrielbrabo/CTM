import { InferSchemaType, Schema, model } from "mongoose";
import { tenantScope } from "../plugins/tenantScope";

const categoriaSchema = new Schema(
  {
    municipioId: { type: Schema.Types.ObjectId, ref: "Municipio", required: true },
    // Modulo a que a categoria pertence (ex.: geral, camara, prefeitura, obras)
    modulo: { type: String, required: true, trim: true },
    nome: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    ativo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categoriaSchema.index({ municipioId: 1, modulo: 1, slug: 1 }, { unique: true });
categoriaSchema.plugin(tenantScope);

export type CategoriaAttrs = InferSchemaType<typeof categoriaSchema>;
export const Categoria = model("Categoria", categoriaSchema, "categorias");
