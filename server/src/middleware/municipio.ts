import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { runWithTenant } from "../context/tenant";
import { Municipio } from "../models/Municipio";
import { naoEncontrado, proibido } from "../utils/httpError";

/**
 * Portal publico: resolve o municipio pelo slug da URL (/api/public/m/:slug)
 * e roda o resto da requisicao dentro do contexto dele.
 */
export async function municipioPublico(req: Request, res: Response, next: NextFunction) {
  const slug = String(req.params.slug || "").toLowerCase();
  const municipio = await Municipio.findOne({ slug, ativo: true });
  if (!municipio) throw naoEncontrado("Municipio nao encontrado");

  req.municipio = municipio;
  runWithTenant({ municipioId: String(municipio._id) }, () => next());
}

/**
 * Painel admin: municipio vem da URL (/api/admin/m/:municipioId/...).
 * Precisa vir DEPOIS do protect. So entra quem tem vinculo com o municipio
 * (ou e superadmin da plataforma).
 */
export async function municipioAdmin(req: Request, res: Response, next: NextFunction) {
  const usuario = req.usuario;
  if (!usuario) throw proibido();

  const municipioId = String(req.params.municipioId || "");
  if (!Types.ObjectId.isValid(municipioId)) throw naoEncontrado("Municipio nao encontrado");

  const temVinculo = usuario.vinculos.some((v) => String(v.municipioId) === municipioId);
  if (!temVinculo && !usuario.plataformaAdmin) throw proibido("Sem acesso a este municipio");

  const municipio = await Municipio.findById(municipioId);
  if (!municipio) throw naoEncontrado("Municipio nao encontrado");

  req.municipio = municipio;
  runWithTenant({ municipioId, usuarioId: String(usuario._id) }, () => next());
}
