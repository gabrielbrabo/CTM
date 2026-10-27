import { MongooseDefaultQueryMiddleware, Query, Schema, Types } from "mongoose";
import { getTenant } from "../context/tenant";

/**
 * Plugin de isolamento entre municipios (substitui o RLS do Postgres).
 *
 * Aplicado em todo model que tem o campo municipioId. Regras:
 * 1. Com municipio no contexto: o filtro municipioId e injetado automaticamente;
 *    se o codigo pedir OUTRO municipio, da erro.
 * 2. Sem municipio no contexto: a consulta TEM que informar municipioId,
 *    senao da erro (nunca devolve dados de todos os municipios por engano).
 * 3. Nao e permitido trocar o municipioId de um documento existente.
 * 4. Contexto com bypass (plataforma/scripts) ignora as regras.
 */
export class TenantError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "TenantError";
  }
}

const OPERACOES_CONSULTA: MongooseDefaultQueryMiddleware[] = [
  "find",
  "findOne",
  "countDocuments",
  "distinct",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "replaceOne",
];

// Converte o valor do filtro para texto (aceita ObjectId, string ou { $eq })
function idDoFiltro(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === "string" || valor instanceof Types.ObjectId) return String(valor);
  if (typeof valor === "object" && valor !== null && "$eq" in valor) {
    return idDoFiltro((valor as { $eq: unknown }).$eq);
  }
  // Filtros complexos ($in, $ne...) nao sao aceitos para municipioId
  return "__invalido__";
}

function verificarDocumento(doc: { municipioId?: unknown }, nomeModel: string): void {
  const tenant = getTenant();
  if (tenant?.bypass) return;
  if (!doc.municipioId && tenant?.municipioId) {
    doc.municipioId = new Types.ObjectId(tenant.municipioId);
  }
  if (!doc.municipioId) {
    throw new TenantError(`Documento de ${nomeModel} sem municipioId`);
  }
  if (tenant?.municipioId && String(doc.municipioId) !== tenant.municipioId) {
    throw new TenantError(`Tentativa de gravar ${nomeModel} em outro municipio`);
  }
}

function alteraMunicipio(update: unknown): boolean {
  if (!update || typeof update !== "object") return false;
  const u = update as Record<string, unknown>;
  if ("municipioId" in u) return true;
  for (const op of ["$set", "$unset", "$setOnInsert", "$rename"]) {
    const bloco = u[op] as Record<string, unknown> | undefined;
    if (bloco && typeof bloco === "object" && "municipioId" in bloco) return true;
  }
  return false;
}

export function tenantScope(schema: Schema): void {
  // Consultas, atualizacoes e exclusoes
  schema.pre(OPERACOES_CONSULTA, function (this: Query<unknown, unknown>) {
    const tenant = getTenant();
    if (tenant?.bypass) return;

    const nomeModel = this.model?.modelName ?? "model";
    const filtro = this.getFilter();
    const pedido = idDoFiltro(filtro.municipioId);

    if (alteraMunicipio(this.getUpdate())) {
      throw new TenantError(`Nao e permitido alterar o municipioId de ${nomeModel}`);
    }

    if (tenant?.municipioId) {
      if (pedido === null) {
        this.where({ municipioId: new Types.ObjectId(tenant.municipioId) });
        return;
      }
      if (pedido !== tenant.municipioId) {
        throw new TenantError(`Consulta em ${nomeModel} pediu outro municipio`);
      }
      return;
    }

    if (pedido === null || pedido === "__invalido__") {
      throw new TenantError(`Consulta em ${nomeModel} sem municipioId (e sem contexto de municipio)`);
    }
  });

  // Novo documento via save()/create(): preenche/valida ANTES da validacao do schema
  // (senao o "municipioId obrigatorio" falharia antes do plugin preencher)
  schema.pre("validate", function () {
    verificarDocumento(this as { municipioId?: unknown }, (this.constructor as { modelName?: string }).modelName ?? "model");
  });
  schema.pre("save", function () {
    verificarDocumento(this as { municipioId?: unknown }, (this.constructor as { modelName?: string }).modelName ?? "model");
  });

  // insertMany (Mongoose 8: o hook recebe next e os docs)
  schema.pre("insertMany", function (next, docs) {
    try {
      const lista = (Array.isArray(docs) ? docs : [docs]) as { municipioId?: unknown }[];
      for (const doc of lista) verificarDocumento(doc, (this as { modelName?: string }).modelName ?? "model");
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  // aggregate: injeta $match no inicio do pipeline
  schema.pre("aggregate", function () {
    const tenant = getTenant();
    if (tenant?.bypass) return;
    const pipeline = this.pipeline();
    if (tenant?.municipioId) {
      const id = new Types.ObjectId(tenant.municipioId);
      const inicio = pipeline[0] as { $match?: Record<string, unknown> } | undefined;
      // Junta no $match que ja existe (o $text da busca precisa ficar no primeiro $match)
      if (inicio?.$match) inicio.$match = { ...inicio.$match, municipioId: id };
      else pipeline.unshift({ $match: { municipioId: id } });
      return;
    }
    const primeiro = pipeline[0] as { $match?: { municipioId?: unknown } } | undefined;
    if (!primeiro?.$match?.municipioId) {
      throw new TenantError("Aggregate sem $match de municipioId no inicio (e sem contexto de municipio)");
    }
  });
}
