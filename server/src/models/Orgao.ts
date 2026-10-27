import { HydratedDocument, InferSchemaType, Schema, model } from "mongoose";
import { tenantScope } from "../plugins/tenantScope";

export const TIPOS_ORGAO = ["prefeitura", "camara", "secretaria", "comissao", "unidade"] as const;
export type TipoOrgao = (typeof TIPOS_ORGAO)[number];

// Orgaos que contratam o sistema (cada um tem contrato, pagamento e admin proprios)
export const TIPOS_CONTRATANTE = ["prefeitura", "camara"] as const;
export type TipoContratante = (typeof TIPOS_CONTRATANTE)[number];

// ativo = aparece no portal e os usuarios podem trabalhar
export const SITUACOES_ORGAO = ["ativo", "suspenso", "encerrado"] as const;
export type SituacaoOrgao = (typeof SITUACOES_ORGAO)[number];

const orgaoSchema = new Schema(
  {
    municipioId: { type: Schema.Types.ObjectId, ref: "Municipio", required: true, index: true },
    tipo: { type: String, enum: TIPOS_ORGAO, required: true },
    nome: { type: String, required: true, trim: true },
    sigla: { type: String, trim: true },
    // Secretaria/comissao pode ficar "dentro" da Prefeitura/Camara
    parentId: { type: Schema.Types.ObjectId, ref: "Orgao", default: null },
    // Preenchido automaticamente: true para prefeitura e camara
    contratante: { type: Boolean, default: false },
    cnpj: { type: String, trim: true },
    // Logo do orgao (aparece em quadro em cima do nome no portal)
    logoKey: { type: String },
    logoMime: { type: String },
    logoAtualizadoEm: { type: Date },
    situacao: { type: String, enum: SITUACOES_ORGAO, default: "ativo" },
    contatos: {
      email: { type: String, trim: true, lowercase: true },
      telefone: { type: String, trim: true },
      site: { type: String, trim: true },
      endereco: { type: String, trim: true },
      horario: { type: String, trim: true }, // horario de atendimento ao publico
      whatsapp: { type: String, trim: true },
    },
    // Recebe mensagens da populacao pelo portal ("Fale com...")
    recebeMensagens: { type: Boolean, default: true },
    responsavel: {
      nome: { type: String, trim: true },
      cargo: { type: String, trim: true },
    },
    // Dados do contrato com a GADZ
    contrato: {
      numero: { type: String, trim: true },
      inicio: Date,
      fim: Date,
      valorMensalCentavos: { type: Number, min: 0 },
      observacoes: { type: String, trim: true },
    },
    // Camara: nome do plenario (ex.: "Plenário Vereador José da Silva")
    plenario: { type: String, trim: true, maxlength: 200 },
    // Se true, publicacoes deste orgao passam por revisao antes de publicar
    exigeRevisao: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Marca prefeitura/camara como contratante antes de validar
orgaoSchema.pre("validate", function () {
  this.contratante = (TIPOS_CONTRATANTE as readonly string[]).includes(this.tipo);
});

// So pode existir UMA prefeitura e UMA camara por municipio
orgaoSchema.index(
  { municipioId: 1, tipo: 1 },
  { unique: true, partialFilterExpression: { contratante: true }, name: "contratante_unico_por_municipio" }
);
orgaoSchema.index({ municipioId: 1, situacao: 1 });
orgaoSchema.plugin(tenantScope);

export type OrgaoAttrs = InferSchemaType<typeof orgaoSchema>;
export type OrgaoDoc = HydratedDocument<OrgaoAttrs>;
export const Orgao = model("Orgao", orgaoSchema, "orgaos");

export function nomePadraoOrgao(tipo: TipoContratante, municipio: string): string {
  return tipo === "prefeitura" ? `Prefeitura Municipal de ${municipio}` : `Câmara Municipal de ${municipio}`;
}
