import { Response } from "express";
import fs from "node:fs";
import multer from "multer";
import { env } from "../config/env";
import { HttpError } from "./httpError";
import { caminhoLocal, urlTemporariaS3, usandoS3 } from "./storage";

// Tipos de arquivo aceitos como anexo
export const MIMES_ACEITOS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.oasis.opendocument.text": "ODT",
  "application/vnd.oasis.opendocument.spreadsheet": "ODS",
  "text/csv": "CSV",
  "text/plain": "TXT",
};

// Upload em memoria (depois vai para o disco ou S3), com limite de tamanho e tipo
export const uploadAnexo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.anexoMaxMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (MIMES_ACEITOS[file.mimetype]) cb(null, true);
    else cb(new HttpError(400, "Tipo de arquivo não aceito. Envie PDF, imagem, Word, Excel, ODT, CSV ou TXT."));
  },
}).single("arquivo");

// Multer guarda o nome em latin1; converte para UTF-8 (corrige "relatÃ³rio.pdf")
export function nomeOriginal(file: Express.Multer.File): string {
  try {
    return Buffer.from(file.originalname, "latin1").toString("utf8");
  } catch {
    return file.originalname;
  }
}

// PDF e imagem abrem no navegador; o resto baixa
const abreNoNavegador = (mime: string) => mime === "application/pdf" || mime.startsWith("image/");

export async function enviarAnexo(
  res: Response,
  anexo: { chave: string; nome: string; mime: string },
  forcarDownload = false
) {
  const inline = !forcarDownload && abreNoNavegador(anexo.mime);
  if (usandoS3()) {
    return res.redirect(await urlTemporariaS3(anexo.chave, anexo.nome, inline));
  }
  // Sem CSP do helmet no arquivo: o leitor de PDF do navegador precisa abrir livremente
  res.removeHeader("Content-Security-Policy");
  const caminho = caminhoLocal(anexo.chave);
  if (!fs.existsSync(caminho)) throw new HttpError(404, "Arquivo não encontrado");
  res.setHeader("Content-Type", anexo.mime);
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(anexo.nome)}`
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  fs.createReadStream(caminho).pipe(res);
}
