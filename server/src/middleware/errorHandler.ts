import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { env } from "../config/env";
import { ZodError } from "zod";
import { TenantError } from "../plugins/tenantScope";
import { HttpError } from "../utils/httpError";

// Tratamento central de erros (o Express 5 ja manda para ca os erros de funcoes async)
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...(err.dados ?? {}) });
  }

  // Erros de upload (arquivo grande demais etc.)
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === "LIMIT_FILE_SIZE" ? `Arquivo maior que ${env.anexoMaxMb} MB` : `Erro no envio do arquivo (${err.code})`;
    return res.status(400).json({ message: msg });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Dados invalidos",
      erros: err.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: err.message });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: `Valor invalido para ${err.path}` });
  }

  // Indice unico violado (ex.: e-mail ou slug repetido)
  if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    return res.status(409).json({ message: "Registro duplicado" });
  }

  // TenantError = bug no codigo (consulta sem municipio). Loga forte e nao expoe detalhe.
  if (err instanceof TenantError) {
    console.error("[TENANT] Bloqueado:", err.message);
    return res.status(500).json({ message: "Erro interno" });
  }

  console.error(err);
  return res.status(500).json({ message: "Erro interno" });
}
