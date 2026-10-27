import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";

/**
 * Armazenamento de arquivos (anexos).
 * - Com S3_BUCKET no .env: grava no Amazon S3 (producao).
 * - Sem S3_BUCKET: grava na pasta server/uploads (desenvolvimento).
 */

const pastaLocal = path.resolve(process.cwd(), env.uploadsDir);
const s3 = env.s3.bucket ? new S3Client({ region: env.s3.region }) : null;

export const usandoS3 = () => Boolean(s3);

// Nome seguro: sem acentos, espacos ou caracteres estranhos
function nomeSeguro(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return base || "arquivo";
}

export async function salvarArquivo(
  prefixo: string,
  nomeOriginal: string,
  conteudo: Buffer,
  mime: string
): Promise<string> {
  const chave = `${prefixo}/${randomUUID()}-${nomeSeguro(nomeOriginal)}`;
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: chave, Body: conteudo, ContentType: mime }));
  } else {
    const destino = path.join(pastaLocal, chave);
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    await fs.promises.writeFile(destino, conteudo);
  }
  return chave;
}

// Le o arquivo inteiro (usado para montar o PDF de impressao com anexos)
export async function lerArquivo(chave: string): Promise<Buffer> {
  if (s3) {
    const r = await s3.send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: chave }));
    const bytes = await r.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  return fs.promises.readFile(caminhoLocal(chave));
}

export async function apagarArquivo(chave: string): Promise<void> {
  try {
    if (s3) {
      await s3.send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: chave }));
    } else {
      await fs.promises.unlink(caminhoLocal(chave));
    }
  } catch (err) {
    console.warn("[storage] nao foi possivel apagar", chave, err);
  }
}

// Caminho no disco, impedindo "../" para sair da pasta de uploads
export function caminhoLocal(chave: string): string {
  const destino = path.resolve(pastaLocal, chave);
  if (!destino.startsWith(pastaLocal + path.sep)) throw new Error("Caminho de arquivo invalido");
  return destino;
}

// Link temporario (5 min) para baixar do S3
export async function urlTemporariaS3(chave: string, nomeDownload: string, inline: boolean): Promise<string> {
  if (!s3) throw new Error("S3 nao configurado");
  const disposicao = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(nomeDownload)}`;
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.s3.bucket, Key: chave, ResponseContentDisposition: disposicao }),
    { expiresIn: 300 }
  );
}
