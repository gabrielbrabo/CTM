import { Request, Response } from "express";
import multer from "multer";
import { HttpError, naoEncontrado } from "./httpError";
import { apagarArquivo, lerArquivo, salvarArquivo } from "./storage";

/**
 * Logos e brasoes (municipio e orgao).
 * Aceita PNG, JPG e WEBP ate 2 MB. SVG nao e aceito (pode conter script).
 */
const MIMES_IMAGEM = ["image/png", "image/jpeg", "image/webp"];

export const uploadImagem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (MIMES_IMAGEM.includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, "Envie a logo em PNG, JPG ou WEBP (até 2 MB)."));
  },
}).single("imagem");

// Confere a "assinatura" do arquivo (evita arquivo com extensao trocada)
function ehImagemValida(buf: Buffer, mime: string): boolean {
  if (mime === "image/png") return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/webp") return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  return false;
}

// Salva a imagem nova e apaga a antiga; devolve os campos para gravar no documento
export async function trocarImagem(req: Request, prefixo: string, chaveAntiga?: string | null) {
  if (!req.file) throw new HttpError(400, "Selecione uma imagem");
  if (!ehImagemValida(req.file.buffer, req.file.mimetype)) throw new HttpError(400, "Arquivo de imagem inválido");
  const chave = await salvarArquivo(prefixo, `logo.${req.file.mimetype.split("/")[1]}`, req.file.buffer, req.file.mimetype);
  if (chaveAntiga) await apagarArquivo(chaveAntiga);
  return { chave, mime: req.file.mimetype, atualizadoEm: new Date() };
}

// Serve a imagem para o portal (pode ser exibida em outro dominio, com cache)
export async function enviarImagem(res: Response, chave?: string | null, mime?: string | null) {
  if (!chave || !mime) throw naoEncontrado("Imagem não encontrada");
  let conteudo: Buffer;
  try {
    conteudo = await lerArquivo(chave);
  } catch {
    throw naoEncontrado("Imagem não encontrada");
  }
  res.setHeader("Content-Type", mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  // O front fica em outro dominio em producao: libera o uso da imagem la
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  // A URL muda quando a imagem e trocada (?v=...), entao pode guardar em cache por bastante tempo
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.send(conteudo);
}

// URLs publicas (null quando nao tem imagem)
export const urlBrasao = (m: { _id: unknown; brasaoKey?: string | null; brasaoAtualizadoEm?: Date | null }) =>
  m.brasaoKey ? `/api/public/imagens/municipio/${m._id}?v=${m.brasaoAtualizadoEm?.getTime() ?? 0}` : null;

export const urlLogoOrgao = (o: { _id: unknown; logoKey?: string | null; logoAtualizadoEm?: Date | null }) =>
  o.logoKey ? `/api/public/imagens/orgao/${o._id}?v=${o.logoAtualizadoEm?.getTime() ?? 0}` : null;

export const urlFotoVereador = (v: { _id: unknown; fotoKey?: string | null; fotoAtualizadoEm?: Date | null }) =>
  v.fotoKey ? `/api/public/imagens/vereador/${v._id}?v=${v.fotoAtualizadoEm?.getTime() ?? 0}` : null;
