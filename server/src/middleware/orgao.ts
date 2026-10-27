import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { runWithTenant, semTenant } from "../context/tenant";
import { Municipio } from "../models/Municipio";
import { Orgao } from "../models/Orgao";
import { Papel } from "../models/Usuario";
import { HttpError, naoEncontrado, proibido } from "../utils/httpError";

/**
 * Painel do orgao: /api/admin/o/:orgaoId/...
 * Precisa vir DEPOIS do protect. So entra quem tem vinculo com o orgao
 * (ou superadmin). Roda o resto da requisicao no contexto do municipio do orgao.
 */
export async function orgaoAdmin(req: Request, _res: Response, next: NextFunction) {
  const usuario = req.usuario;
  if (!usuario) throw proibido();

  const orgaoId = String(req.params.orgaoId || "");
  if (!Types.ObjectId.isValid(orgaoId)) throw naoEncontrado("Orgao nao encontrado");

  const temVinculo = usuario.vinculos.some((v) => String(v.orgaoId) === orgaoId);
  if (!temVinculo && !usuario.plataformaAdmin) throw proibido("Sem acesso a este orgao");

  // Busca sem contexto (ainda nao sabemos o municipio)
  const orgao = await semTenant(() => Orgao.findById(orgaoId));
  if (!orgao) throw naoEncontrado("Orgao nao encontrado");
  const municipio = await Municipio.findById(orgao.municipioId);
  if (!municipio) throw naoEncontrado("Municipio nao encontrado");

  // Orgao suspenso/encerrado: so leitura (exceto superadmin)
  if (orgao.situacao !== "ativo" && req.method !== "GET" && !usuario.plataformaAdmin) {
    throw new HttpError(403, "Este órgão está suspenso ou encerrado. Fale com a GADZ.");
  }

  req.orgao = orgao;
  req.municipio = municipio;
  runWithTenant({ municipioId: String(municipio._id), usuarioId: String(usuario._id) }, () => next());
}

// Papel do usuario no orgao atual (superadmin conta como admin)
export function papelNoOrgao(req: Request): Papel | null {
  if (req.usuario?.plataformaAdmin) return "admin_orgao";
  const v = req.usuario?.vinculos.find((x) => String(x.orgaoId) === String(req.orgao?._id));
  return v?.papel ?? null;
}

// Middleware: exige um dos papeis no orgao atual
export function exigePapel(...papeis: Papel[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const papel = papelNoOrgao(req);
    if (!papel || !papeis.includes(papel)) throw proibido();
    next();
  };
}
