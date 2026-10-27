import JSZip from "jszip";
import mammoth from "mammoth";
import { createWorker } from "tesseract.js";
import WordExtractor from "word-extractor";
import { HttpError } from "./httpError";

/**
 * Extrai o TEXTO de um arquivo para preencher uma publicacao.
 * - PDF com texto: pdfjs-dist (o mesmo leitor de PDF do Firefox)
 * - Word .docx: mammoth | Word .doc (antigo): word-extractor
 * - ODT (LibreOffice): le o content.xml de dentro do arquivo
 * - Imagem (foto/escaneado): OCR em portugues com tesseract.js
 * - TXT/CSV: leitura direta
 */

export const MIMES_EXTRACAO: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (.docx)",
  "application/msword": "Word (.doc)",
  "application/vnd.oasis.opendocument.text": "ODT",
  "image/jpeg": "Imagem JPG",
  "image/png": "Imagem PNG",
  "image/webp": "Imagem WEBP",
  "text/plain": "TXT",
  "text/csv": "CSV",
};

// Arruma espacos e linhas em branco repetidas
function limpar(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function textoDoPdf(buffer: Buffer): Promise<string> {
  // pdfjs-dist e um modulo ESM: carregado com import() dinamico
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false }).promise;
  const paginas: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 300); n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    // Junta os pedacos respeitando as quebras de linha do PDF
    let texto = "";
    for (const item of conteudo.items) {
      if ("str" in item) texto += item.str + (item.hasEOL ? "\n" : "");
    }
    paginas.push(texto);
  }
  await doc.destroy();
  return paginas.join("\n\n");
}

async function textoDoOdt(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) throw new HttpError(400, "Arquivo ODT inválido");
  return xml
    .replace(/<text:line-break\/>/g, "\n")
    .replace(/<text:tab\/>/g, "\t")
    .replace(/<\/text:(p|h)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// O OCR e pesado: um "trabalhador" reaproveitado e criado so na primeira imagem
let workerOcr: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;
function obterWorkerOcr() {
  if (!workerOcr) {
    // Dados do idioma portugues vem do pacote npm (funciona sem internet)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const por = require("@tesseract.js-data/por") as { langPath: string; gzip: boolean };
    workerOcr = createWorker("por", 1, { langPath: por.langPath, gzip: por.gzip, cacheMethod: "none" }).catch((err) => {
      workerOcr = null;
      throw err;
    });
  }
  return workerOcr;
}

async function textoDaImagem(buffer: Buffer): Promise<string> {
  const worker = await obterWorkerOcr();
  const r = await worker.recognize(buffer);
  return r.data.text;
}

export async function extrairTexto(buffer: Buffer, mime: string): Promise<{ texto: string; metodo: string; semTexto: boolean }> {
  let texto = "";
  let metodo = MIMES_EXTRACAO[mime] ?? mime;

  try {
    switch (mime) {
      case "application/pdf":
        texto = await textoDoPdf(buffer);
        break;
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        texto = (await mammoth.extractRawText({ buffer })).value;
        break;
      case "application/msword":
        texto = (await new WordExtractor().extract(buffer)).getBody();
        break;
      case "application/vnd.oasis.opendocument.text":
        texto = await textoDoOdt(buffer);
        break;
      case "image/jpeg":
      case "image/png":
      case "image/webp":
        texto = await textoDaImagem(buffer);
        metodo = `${metodo} (leitura de imagem / OCR)`;
        break;
      case "text/plain":
      case "text/csv":
        texto = buffer.toString("utf8");
        break;
      default:
        throw new HttpError(400, "Formato não suportado para extrair texto");
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error("[extrairTexto]", err);
    throw new HttpError(400, "Não foi possível ler o texto deste arquivo. Ele pode estar danificado ou protegido por senha.");
  }

  texto = limpar(texto);
  // PDF escaneado (so imagem): nao e erro, o arquivo pode ser mostrado no lugar do texto
  if (!texto && mime === "application/pdf") return { texto: "", metodo, semTexto: true };
  if (!texto) throw new HttpError(400, "Nenhum texto encontrado no arquivo.");
  return { texto: texto.slice(0, 100_000), metodo, semTexto: false };
}

// Sugere um titulo: primeira linha "com cara de titulo"
export function sugerirTitulo(texto: string): string {
  const linha = texto
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 8 && l.length <= 200);
  return linha ? linha.slice(0, 250) : "";
}
