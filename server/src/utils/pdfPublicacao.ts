import { PDFDocument as PdfLib } from "pdf-lib";
import PDFDocument from "pdfkit";
import { tipoPorId } from "../config/tiposPublicacao";
import { lerArquivo } from "./storage";

/**
 * PDFs de impressao de uma publicacao (dois caminhos):
 * - "publicacao": so a publicacao (logo do orgao, ficha, resumo, texto, fonte, historico)
 * - "anexos": so os anexos, juntando os PDFs e as imagens JPG/PNG
 *   (Word/Excel/etc. nao da para juntar: abra pelo portal)
 */

interface Anexo {
  nome: string;
  chave: string;
  mime: string;
  tamanho: number;
  noCorpo?: boolean; // mostrado no lugar do texto
}

export interface DadosImpressao {
  municipio: { nome: string; uf: string };
  orgao: { nome: string; logo?: Buffer | null }; // logo PNG/JPG do orgao (opcional)
  publicacao: {
    tipo: string;
    titulo: string;
    numero?: string | null;
    dataReferencia?: Date | null;
    resumo?: string | null;
    conteudo?: string | null;
    detalhes?: Record<string, unknown>;
    fonte?: { nome?: string | null; url?: string | null } | null;
    estado: string;
    publicadoEm?: Date | null;
    corrigidoEm?: Date | null;
    anexos: Anexo[];
    historico: { evento: string; data: Date; motivo?: string | null }[];
    // Vereadores ligados (Camara)
    vereadores?: {
      autores: { nome: string; partido: string | null }[];
      relator: { nome: string; partido: string | null } | null;
      votos: { vereador: { nome: string; partido: string | null }; voto: string }[];
      presencas: { vereador: { nome: string; partido: string | null }; situacao: string }[];
    };
  };
  link?: string; // endereco publico da publicacao
}

const FUSO = "America/Sao_Paulo";
const data = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: FUSO });
const dataHora = (d: Date | string) =>
  new Date(d).toLocaleString("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "short" });
// Datas simples ("2026-10-20") sem conversao de fuso
const dataSimples = (v: string) => {
  const [a, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

const ANEXAVEIS = ["application/pdf", "image/jpeg", "image/png"];
const EVENTOS: Record<string, string> = {
  publicado: "Publicado",
  corrigido: "Atualizado",
  anexo_adicionado: "Anexo adicionado",
  anexo_removido: "Anexo removido",
};

function formatarCampo(tipo: string, nome: string, v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  switch (tipo) {
    case "data":
      return dataSimples(String(v));
    case "datahora":
      return dataHora(String(v));
    case "moeda":
      return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "numero":
      return nome === "percentual" ? `${v}%` : String(v);
    default:
      return String(v);
  }
}

// Monta a parte "texto" da publicacao com pdfkit
function gerarBase(d: DadosImpressao): Promise<Buffer> {
  const p = d.publicacao;
  const def = tipoPorId(p.tipo);
  const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 64, left: 56, right: 56 }, bufferPages: true });
  const partes: Buffer[] = [];
  doc.on("data", (c: Buffer) => partes.push(c));
  const fim = new Promise<Buffer>((ok) => doc.on("end", () => ok(Buffer.concat(partes))));

  const largura = doc.page.width - 112;
  const cinza = "#475569";

  // Cabecalho: logo do orgao + nome
  const topo = doc.y;
  let xTexto = 56;
  if (d.orgao.logo) {
    try {
      doc.image(d.orgao.logo, 56, topo, { fit: [52, 52], align: "center", valign: "center" });
      xTexto = 56 + 64;
    } catch {
      // logo em formato nao suportado: segue sem ela
    }
  }
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1e3a8a").text(d.orgao.nome.toUpperCase(), xTexto, topo + (xTexto > 56 ? 12 : 0), {
    width: largura - (xTexto - 56),
  });
  doc.font("Helvetica").fontSize(9).fillColor(cinza).text(`${d.municipio.nome} / ${d.municipio.uf}`, xTexto);
  doc.x = 56;
  doc.y = Math.max(doc.y, xTexto > 56 ? topo + 56 : doc.y);
  doc.moveDown(0.4);
  doc.moveTo(56, doc.y).lineTo(56 + largura, doc.y).strokeColor("#cbd5e1").stroke();
  doc.moveDown(0.8);

  if (p.estado !== "publicado") {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#b45309").text("RASCUNHO / NÃO PUBLICADO — documento para conferência");
    doc.moveDown(0.5);
  }

  doc.font("Helvetica").fontSize(10).fillColor(cinza).text(`${def?.nome ?? p.tipo}${p.numero ? ` nº ${p.numero}` : ""}`);
  doc.font("Helvetica-Bold").fontSize(17).fillColor("#0f172a").text(p.titulo, { width: largura });
  doc.moveDown(0.3);
  const linhaDatas = [
    p.publicadoEm ? `Publicado em ${dataHora(p.publicadoEm)}` : null,
    p.dataReferencia ? `Data do documento: ${data(p.dataReferencia)}` : null,
    p.corrigidoEm ? `Última atualização: ${dataHora(p.corrigidoEm)}` : null,
  ].filter(Boolean);
  if (linhaDatas.length) doc.font("Helvetica").fontSize(9).fillColor(cinza).text(linhaDatas.join("   ·   "));
  doc.moveDown(0.8);

  // Ficha com os campos especificos do tipo
  const campos = (def?.campos ?? [])
    .map((c) => ({ rotulo: c.rotulo, valor: formatarCampo(c.tipo, c.nome, p.detalhes?.[c.nome]) }))
    .filter((c) => c.valor);
  if (campos.length) {
    for (const c of campos) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(cinza).text(c.rotulo.toUpperCase());
      doc.font("Helvetica").fontSize(10.5).fillColor("#0f172a").text(c.valor, { width: largura });
      doc.moveDown(0.35);
    }
    doc.moveDown(0.5);
  }

  // Vereadores: autores, relator, votacao nominal e presenca
  const vv = p.vereadores;
  const comPartido = (x: { nome: string; partido: string | null }) => (x.partido ? `${x.nome} (${x.partido})` : x.nome);
  if (vv?.autores.length) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(cinza).text(vv.autores.length > 1 ? "AUTORES" : "AUTOR(A)");
    doc.font("Helvetica").fontSize(10.5).fillColor("#0f172a").text(vv.autores.map(comPartido).join(", "), { width: largura });
    doc.moveDown(0.5);
  }
  if (vv?.relator) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(cinza).text("RELATOR(A)");
    doc.font("Helvetica").fontSize(10.5).fillColor("#0f172a").text(comPartido(vv.relator), { width: largura });
    doc.moveDown(0.5);
  }
  if (vv?.votos.length) {
    const NOME_VOTO: Record<string, string> = { sim: "Favorável", nao: "Contrário", abstencao: "Abstenção", ausente: "Ausente" };
    const conta = (v: string) => vv.votos.filter((x) => x.voto === v).length;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a8a").text("Votação nominal");
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(cinza)
      .text(`Favoráveis: ${conta("sim")}   Contrários: ${conta("nao")}   Abstenção: ${conta("abstencao")}   Ausente: ${conta("ausente")}`);
    for (const x of vv.votos) {
      doc.font("Helvetica").fontSize(9.5).fillColor("#0f172a").text(`${comPartido(x.vereador)} — ${NOME_VOTO[x.voto] ?? x.voto}`, { width: largura });
    }
    doc.moveDown(0.6);
  }
  if (vv?.presencas.length) {
    const NOME_P: Record<string, string> = { presente: "Presente", ausente: "Ausente", justificada: "Ausência justificada" };
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a8a").text("Presença dos vereadores");
    for (const x of vv.presencas) {
      doc.font("Helvetica").fontSize(9.5).fillColor("#0f172a").text(`${comPartido(x.vereador)} — ${NOME_P[x.situacao] ?? x.situacao}`, { width: largura });
    }
    doc.moveDown(0.6);
  }

  if (p.resumo) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a8a").text("Resumo");
    doc.font("Helvetica").fontSize(10.5).fillColor("#0f172a").text(p.resumo, { width: largura });
    doc.moveDown(0.8);
  }

  // Documento (imagem/PDF escaneado) no lugar do texto: vai nas paginas seguintes
  const noCorpo = p.anexos.filter((a) => a.noCorpo && ANEXAVEIS.includes(a.mime));
  if (noCorpo.length) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .fillColor(cinza)
      .text(`Documento: ${noCorpo.map((a) => a.nome).join(", ")} — veja nas páginas seguintes.`, { width: largura });
    doc.moveDown(0.8);
  }

  if (p.conteudo) {
    doc.font("Helvetica").fontSize(10.5).fillColor("#0f172a").text(p.conteudo, { width: largura, lineGap: 2 });
    doc.moveDown(0.8);
  }

  if (p.fonte?.nome || p.fonte?.url) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(cinza).text("Fonte oficial: ", { continued: true });
    doc.font("Helvetica").text([p.fonte.nome, p.fonte.url].filter(Boolean).join(" — "));
    doc.moveDown(0.6);
  }

  if (p.anexos.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a8a").text("Documentos anexos");
    for (const a of p.anexos) {
      doc.font("Helvetica").fontSize(9.5).fillColor("#0f172a").text(`•  ${a.nome}`, { width: largura });
    }
    doc.moveDown(0.6);
  }

  const historico = p.historico.filter((h) => EVENTOS[h.evento]);
  if (historico.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a8a").text("Histórico");
    for (const h of historico) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(cinza)
        .text(`${dataHora(h.data)} — ${EVENTOS[h.evento]}${h.motivo ? `: ${h.motivo}` : ""}`, { width: largura });
    }
  }

  // Rodape em todas as paginas
  const paginas = doc.bufferedPageRange();
  const gerado = `Gerado em ${dataHora(new Date())} pelo Diário Digital de Transparência Municipal${d.link ? ` — ${d.link}` : ""}`;
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(i);
    // Zera a margem de baixo enquanto escreve o rodape (senao o pdfkit cria uma pagina nova)
    const margemInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 44;
    doc.font("Helvetica").fontSize(7.5).fillColor("#64748b");
    doc.text(gerado, 56, y, { width: largura - 70, lineBreak: false, height: 12, ellipsis: true });
    doc.text(`Página ${i + 1} de ${paginas.count}`, 56, y, { width: largura, align: "right", lineBreak: false });
    doc.page.margins.bottom = margemInferior;
  }

  doc.end();
  return fim;
}

// Caminho 1: somente a publicacao (+ o documento que esta no lugar do texto, se houver)
export async function gerarPdfPublicacao(d: DadosImpressao): Promise<Buffer> {
  const base = await gerarBase(d);
  const noCorpo = d.publicacao.anexos.filter((a) => a.noCorpo);
  if (!noCorpo.length) return base;
  const documento = await gerarPdfAnexos(noCorpo);
  if (!documento) return base;
  const final = await PdfLib.load(base);
  const origem = await PdfLib.load(documento);
  (await final.copyPages(origem, origem.getPageIndices())).forEach((pg) => final.addPage(pg));
  return Buffer.from(await final.save());
}

// Anexos que podem ser juntados num PDF de impressao
export const anexosImprimiveis = <T extends { mime: string }>(anexos: T[]) => anexos.filter((a) => ANEXAVEIS.includes(a.mime));

// Caminho 2: somente os anexos (PDFs e imagens juntados num unico arquivo). null = nada para imprimir
export async function gerarPdfAnexos(anexos: Anexo[]): Promise<Buffer | null> {
  const lista = anexosImprimiveis(anexos);
  if (!lista.length) return null;

  const final = await PdfLib.create();
  for (const a of lista) {
    try {
      const bytes = await lerArquivo(a.chave);
      if (a.mime === "application/pdf") {
        const origem = await PdfLib.load(bytes, { ignoreEncryption: true });
        const paginas = await final.copyPages(origem, origem.getPageIndices());
        paginas.forEach((pg) => final.addPage(pg));
      } else {
        // Imagem numa pagina A4, centralizada e sem distorcer
        const img = a.mime === "image/png" ? await final.embedPng(bytes) : await final.embedJpg(bytes);
        const pagina = final.addPage([595.28, 841.89]);
        const margem = 36;
        const escala = Math.min((595.28 - margem * 2) / img.width, (841.89 - margem * 2) / img.height, 1);
        const w = img.width * escala;
        const h = img.height * escala;
        pagina.drawImage(img, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h });
      }
    } catch (err) {
      // Anexo protegido/danificado: segue sem ele
      console.warn("[pdf] anexo nao incluido:", a.nome, err instanceof Error ? err.message : err);
    }
  }
  if (final.getPageCount() === 0) return null;
  return Buffer.from(await final.save());
}

// Le a logo do orgao para o PDF (pdfkit aceita so PNG e JPG)
export async function logoParaPdf(o: { logoKey?: string | null; logoMime?: string | null }): Promise<Buffer | null> {
  if (!o.logoKey || !["image/png", "image/jpeg"].includes(o.logoMime ?? "")) return null;
  try {
    return await lerArquivo(o.logoKey);
  } catch {
    return null;
  }
}

// Nome do arquivo para download: "decreto-15-2026.pdf"
export function nomeArquivoPdf(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "publicacao"}.pdf`;
}

// Envia o PDF de impressao (abre no navegador, pronto para imprimir ou salvar)
export function enviarPdf(res: import("express").Response, pdf: Buffer, titulo: string) {
  res.removeHeader("Content-Security-Policy");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${nomeArquivoPdf(titulo)}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(pdf);
}

// Converte o documento do banco para os dados de impressao
export function dadosDaPublicacao(pub: {
  tipo: string;
  titulo: string;
  numero?: string | null;
  dataReferencia?: Date | null;
  resumo?: string | null;
  conteudo?: string | null;
  detalhes?: unknown;
  fonte?: { nome?: string | null; url?: string | null } | null;
  estado: string;
  publicadoEm?: Date | null;
  corrigidoEm?: Date | null;
  anexos: (Anexo & { noCorpo?: boolean | null })[];
  historico: { evento: string; data: Date; motivo?: string | null }[];
}): DadosImpressao["publicacao"] {
  return {
    tipo: pub.tipo,
    titulo: pub.titulo,
    numero: pub.numero,
    dataReferencia: pub.dataReferencia,
    resumo: pub.resumo,
    conteudo: pub.conteudo,
    detalhes: (pub.detalhes as Record<string, unknown>) ?? {},
    fonte: pub.fonte,
    estado: pub.estado,
    publicadoEm: pub.publicadoEm,
    corrigidoEm: pub.corrigidoEm,
    anexos: pub.anexos.map((a) => ({ nome: a.nome, chave: a.chave, mime: a.mime, tamanho: a.tamanho, noCorpo: Boolean(a.noCorpo) })),
    historico: pub.historico.map((h) => ({ evento: h.evento, data: h.data, motivo: h.motivo })),
  };
}
