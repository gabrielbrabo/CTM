import { NextFunction, Request, Response } from "express";
import { Papel, UsuarioDoc } from "../models/Usuario";
import { proibido } from "../utils/httpError";

/**
 * Verifica se o usuario tem um dos papeis no ORGAO informado.
 * Cada orgao (Prefeitura/Camara) e independente: admin da Camara
 * nao mexe na Prefeitura do mesmo municipio.
 */
export function temPapelNoOrgao(usuario: UsuarioDoc, orgaoId: string, papeis: Papel[]): boolean {
  if (usuario.plataformaAdmin) return true;
  return usuario.vinculos.some((v) => String(v.orgaoId) === orgaoId && papeis.includes(v.papel));
}

// Middleware: can(["admin_orgao"], req => req.params.orgaoId)
export function can(papeis: Papel[], pegarOrgaoId: (req: Request) => string | null | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const orgaoId = pegarOrgaoId(req);
    if (!req.usuario || !orgaoId) throw proibido();
    if (!temPapelNoOrgao(req.usuario, String(orgaoId), papeis)) throw proibido();
    next();
  };
}
