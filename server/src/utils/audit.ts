import { Request } from "express";
import { Types } from "mongoose";
import { getTenant } from "../context/tenant";
import { Auditoria } from "../models/Auditoria";

interface DadosAuditoria {
  acao: string; // ex.: "orgao.criar", "auth.login"
  entidade: string; // ex.: "Orgao"
  entidadeId?: string | Types.ObjectId | null;
  diff?: unknown;
  // Se nao informado, usa o municipio do contexto da requisicao
  municipioId?: string | Types.ObjectId | null;
  // Se nao informado, usa o orgao da requisicao (painel do orgao) ou o proprio orgao editado
  orgaoId?: string | Types.ObjectId | null;
  usuarioId?: string | Types.ObjectId | null; // quem fez (quando nao ha login, ex.: tentativa de login)
}

// Grava um registro de auditoria. Use em TODA acao administrativa relevante.
export async function registrarAuditoria(req: Request | null, dados: DadosAuditoria): Promise<void> {
  const tenant = getTenant();
  const municipioId = dados.municipioId ?? tenant?.municipioId ?? null;

  const paraId = (v: string | Types.ObjectId | null | undefined) => (v ? new Types.ObjectId(String(v)) : null);

  // Descobre o orgao da acao
  const diffOrgao = (dados.diff as { orgaoId?: unknown } | null | undefined)?.orgaoId;
  const orgaoId =
    dados.orgaoId ??
    req?.orgao?._id ??
    (dados.entidade === "Orgao" ? dados.entidadeId : null) ??
    (typeof diffOrgao === "string" && Types.ObjectId.isValid(diffOrgao) ? diffOrgao : null);

  const registro = new Auditoria({
    municipioId: paraId(municipioId),
    orgaoId: paraId(orgaoId),
    usuarioId: paraId(dados.usuarioId ?? req?.usuario?._id ?? tenant?.usuarioId),
    acao: dados.acao,
    entidade: dados.entidade,
    entidadeId: dados.entidadeId ? String(dados.entidadeId) : null,
    diff: dados.diff ?? null,
    ip: req?.ip ?? null,
  });
  await registro.save();
}
