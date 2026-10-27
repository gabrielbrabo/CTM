import { HydratedDocument, Schema, Types, model } from "mongoose";

// Usuario e global (pode ter acesso a mais de um orgao): NAO usa tenantScope.
// O acesso a cada orgao (Prefeitura/Camara) e controlado pelos vinculos.
// admin_orgao = administrador do orgao (cadastra os outros usuarios dele)
export const PAPEIS = ["admin_orgao", "editor", "revisor"] as const;
export type Papel = (typeof PAPEIS)[number];

export interface Vinculo {
  municipioId: Types.ObjectId;
  // Orgao contratante (Prefeitura ou Camara) ao qual o usuario pertence
  orgaoId: Types.ObjectId;
  papel: Papel;
}

export interface UsuarioAttrs {
  nome: string;
  email: string;
  senhaHash: string;
  plataformaAdmin: boolean;
  vinculos: Vinculo[];
  ativo: boolean;
  // Incrementado no logout/troca de senha para invalidar refresh tokens antigos
  tokenVersion: number;
  ultimoLogin?: Date;
}

const vinculoSchema = new Schema<Vinculo>(
  {
    municipioId: { type: Schema.Types.ObjectId, ref: "Municipio", required: true },
    orgaoId: { type: Schema.Types.ObjectId, ref: "Orgao", required: true },
    papel: { type: String, enum: PAPEIS, required: true },
  },
  { _id: false }
);

const usuarioSchema = new Schema<UsuarioAttrs>(
  {
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senhaHash: { type: String, required: true, select: false },
    plataformaAdmin: { type: Boolean, default: false },
    vinculos: { type: [vinculoSchema], default: [] },
    ativo: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    ultimoLogin: Date,
  },
  { timestamps: true }
);

usuarioSchema.index({ "vinculos.municipioId": 1 });
usuarioSchema.index({ "vinculos.orgaoId": 1 });

export type UsuarioDoc = HydratedDocument<UsuarioAttrs>;
export const Usuario = model<UsuarioAttrs>("Usuario", usuarioSchema, "usuarios");

// Dados seguros para devolver ao front (sem senha/tokenVersion)
export function usuarioPublico(u: UsuarioDoc) {
  return {
    id: String(u._id),
    nome: u.nome,
    email: u.email,
    plataformaAdmin: u.plataformaAdmin,
    vinculos: u.vinculos.map((v) => ({
      municipioId: String(v.municipioId),
      orgaoId: String(v.orgaoId),
      papel: v.papel,
    })),
  };
}
