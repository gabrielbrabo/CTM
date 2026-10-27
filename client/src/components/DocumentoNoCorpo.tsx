import { useEffect, useRef, useState } from "react";
import { urlDaApi } from "../api/http";

/**
 * Mostra no lugar do texto da publicacao um documento escaneado ou uma imagem.
 * - Imagem (JPG/PNG/WEBP): aparece inteira, na largura da pagina
 * - PDF: cada pagina e desenhada como imagem (pdf.js), funciona tambem no celular
 */

export interface ArquivoNoCorpo {
  id: string;
  nome: string;
  mime: string;
  url: string;
}

const MAX_PAGINAS = 40;

// Desenha as paginas de um PDF (carrega o pdf.js so quando precisa)
function PaginasPdf({ url, nome }: { url: string; nome: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelado = false;
    // Cada execucao desenha numa lista propria (removida ao sair)
    const alvo = document.createElement("div");
    alvo.className = "space-y-4";
    caixa.current?.appendChild(alvo);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

        const doc = await pdfjs.getDocument({ url: urlDaApi(url) }).promise;
        if (cancelado) return;
        setTotal(doc.numPages);
        const paginas = Math.min(doc.numPages, MAX_PAGINAS);
        for (let n = 1; n <= paginas; n++) {
          const pagina = await doc.getPage(n);
          if (cancelado) return;
          // Boa definicao para ler (inclusive em telas de celular)
          const base = pagina.getViewport({ scale: 1 });
          const escala = Math.min(2.5, 1400 / base.width);
          const viewport = pagina.getViewport({ scale: escala });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "block h-auto w-full rounded-lg border border-slate-200 fundo-imagem shadow-sm";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${nome} — página ${n} de ${doc.numPages}`);
          alvo.appendChild(canvas);
          await pagina.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        }
        if (!cancelado) setEstado("ok");
      } catch (err) {
        console.error("[pdf]", err);
        if (!cancelado) setEstado("erro");
      }
    })();
    return () => {
      cancelado = true;
      alvo.remove();
    };
  }, [url, nome]);

  return (
    <div>
      {estado === "carregando" && <p className="text-sm text-slate-500">Carregando o documento...</p>}
      {estado === "erro" && (
        <p className="text-sm text-slate-600">
          Não foi possível mostrar o documento aqui.{" "}
          <a href={urlDaApi(url)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
            Abrir o arquivo
          </a>
        </p>
      )}
      <div ref={caixa} />
      {estado === "ok" && total > MAX_PAGINAS && (
        <p className="mt-3 text-sm text-slate-600">
          Mostrando {MAX_PAGINAS} de {total} páginas.{" "}
          <a href={urlDaApi(url)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
            Abrir o documento completo
          </a>
        </p>
      )}
    </div>
  );
}

export function DocumentoNoCorpo({ arquivos }: { arquivos: ArquivoNoCorpo[] }) {
  if (!arquivos.length) return null;
  return (
    <section className="space-y-4" aria-label="Documento">
      {arquivos.map((a) =>
        a.mime === "application/pdf" ? (
          <PaginasPdf key={a.id} url={a.url} nome={a.nome} />
        ) : (
          <a key={a.id} href={urlDaApi(a.url)} target="_blank" rel="noreferrer" title="Abrir a imagem em tamanho real">
            <img
              src={urlDaApi(a.url)}
              alt={a.nome}
              loading="lazy"
              className="block h-auto w-full rounded-lg border border-slate-200 fundo-imagem shadow-sm"
            />
          </a>
        )
      )}
    </section>
  );
}
