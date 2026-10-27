import { NextFunction, Request, Response } from "express";
import { Cidadao } from "../models/Cidadao";
import { Usuario } from "../models/Usuario";
import { naoAutenticado, proibido } from "../utils/httpError";
import { verificarAccessToken } from "../utils/tokens";

// Exige login: le "Authorization: Bearer <token>" e carrega o usuario em req.usuario
export async function protect(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw naoAutenticado();

  let payload;
  try {
    payload = verificarAccessToken(token);
  } catch {
    throw naoAutenticado("Sessao expirada ou invalida");
  }

  // Token de cidadao nao entra no painel dos servidores
  if (payload.tp === "cidadao") throw naoAutenticado("Sessao invalida");
  const usuario = await Usuario.findById(payload.sub);
  if (!usuario || !usuario.ativo || usuario.tokenVersion !== payload.tv) {
    throw naoAutenticado("Sessao invalida");
  }

  req.usuario = usuario;
  next();
}

// So superadmin da plataforma (GADZ)
export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.usuario?.plataformaAdmin) throw proibido();
  next();
}

// Exige login de cidadao (conta da populacao no portal): carrega req.cidadao
export async function protectCidadao(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw naoAutenticado("Entre na sua conta para continuar");
  let payload;
  try {
    payload = verificarAccessToken(token);
  } catch {
    throw naoAutenticado("Sessao expirada ou invalida");
  }
  if (payload.tp !== "cidadao") throw naoAutenticado("Sessao invalida");
  const cidadao = await Cidadao.findById(payload.sub);
  if (!cidadao || !cidadao.ativo || cidadao.tokenVersion !== payload.tv) throw naoAutenticado("Sessao invalida");
  req.cidadao = cidadao;
  next();
}
