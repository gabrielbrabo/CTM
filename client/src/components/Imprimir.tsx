import { useEffect, useRef, useState } from "react";

const IconeImpressora = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

export type ParteImpressao = "publicacao" | "anexos";

// Anexos que entram no PDF de impressao (PDF e imagens JPG/PNG)
export const anexoImprimivel = (a: { mime: string }) => ["application/pdf", "image/jpeg", "image/png"].includes(a.mime);

// Endereco do PDF: ".../impressao.pdf" ou ".../impressao.pdf?parte=anexos"
export const urlImpressao = (base: string, parte: ParteImpressao) => (parte === "anexos" ? `${base}?parte=anexos` : base);

/**
 * Botao "Imprimir" com dois caminhos: somente a publicacao ou somente os anexos.
 * Abre um PDF pronto para imprimir ou salvar.
 * - Portal: passe hrefBase (link publico do impressao.pdf)
 * - Painel: passe onImprimir (precisa do login)
 */
export function BotoesImprimir({
  temAnexos,
  hrefBase,
  onImprimir,
  compacto = false,
}: {
  temAnexos: boolean; // tem anexo em PDF ou imagem?
  hrefBase?: string;
  onImprimir?: (parte: ParteImpressao) => void;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const classeBotao = `inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 ${
    compacto ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm"
  }`;
  const classeItem = "block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50";

  const opcao = (parte: ParteImpressao, rotulo: string, dica: string) =>
    onImprimir ? (
      <button
        type="button"
        role="menuitem"
        className={classeItem}
        onClick={() => {
          setAberto(false);
          onImprimir(parte);
        }}
      >
        {rotulo}
        <span className="block text-xs text-slate-500">{dica}</span>
      </button>
    ) : (
      <a
        role="menuitem"
        href={urlImpressao(hrefBase ?? "", parte)}
        target="_blank"
        rel="noreferrer"
        className={classeItem}
        onClick={() => setAberto(false)}
      >
        {rotulo}
        <span className="block text-xs text-slate-500">{dica}</span>
      </a>
    );

  // Sem anexos: botao direto
  if (!temAnexos) {
    return onImprimir ? (
      <button type="button" className={classeBotao} onClick={() => onImprimir("publicacao")}>
        <IconeImpressora /> Imprimir
      </button>
    ) : (
      <a href={hrefBase} target="_blank" rel="noreferrer" className={classeBotao}>
        <IconeImpressora /> Imprimir
      </a>
    );
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        className={classeBotao}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <IconeImpressora /> Imprimir ▾
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
          {opcao("publicacao", "Imprimir somente a publicação", "Texto, dados e lista de anexos")}
          {opcao("anexos", "Imprimir somente os anexos", "Os PDFs e imagens anexados")}
        </div>
      )}
    </div>
  );
}
