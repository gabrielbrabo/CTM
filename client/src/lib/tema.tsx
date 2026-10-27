import { ReactElement, useEffect, useState } from "react";

/**
 * Tema claro/escuro escolhido pelo usuario.
 * - "sistema": segue a configuracao do celular/computador
 * - a escolha fica salva no navegador (localStorage)
 * - a classe "dark" no <html> liga as cores escuras (ver tema.css)
 */
export type PreferenciaTema = "claro" | "escuro" | "sistema";

const CHAVE = "ctm-tema";
const midiaEscura = () => window.matchMedia?.("(prefers-color-scheme: dark)");

function lerPreferencia(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === "claro" || v === "escuro" || v === "sistema") return v;
  } catch {
    // navegador sem acesso ao localStorage (modo privado etc.)
  }
  return "sistema";
}

function aplicar(pref: PreferenciaTema) {
  const escuro = pref === "escuro" || (pref === "sistema" && Boolean(midiaEscura()?.matches));
  document.documentElement.classList.toggle("dark", escuro);
}

export function useTema() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(lerPreferencia);

  useEffect(() => {
    aplicar(preferencia);
    try {
      localStorage.setItem(CHAVE, preferencia);
    } catch {
      // ignora
    }
    // No modo "sistema", acompanha a troca de tema do aparelho
    if (preferencia !== "sistema") return;
    const m = midiaEscura();
    const ouvir = () => aplicar("sistema");
    m?.addEventListener?.("change", ouvir);
    return () => m?.removeEventListener?.("change", ouvir);
  }, [preferencia]);

  return { preferencia, setPreferencia };
}

const ICONES: Record<PreferenciaTema, ReactElement> = {
  claro: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  escuro: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  sistema: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
};

const ROTULOS: Record<PreferenciaTema, string> = { claro: "Claro", escuro: "Escuro", sistema: "Automático" };

// Seletor compacto (3 botoes) para o cabecalho
export function SeletorTema() {
  const { preferencia, setPreferencia } = useTema();
  return (
    <div role="radiogroup" aria-label="Tema" className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5">
      {(Object.keys(ROTULOS) as PreferenciaTema[]).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={preferencia === p}
          title={`Tema ${ROTULOS[p].toLowerCase()}`}
          onClick={() => setPreferencia(p)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
            preferencia === p ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {ICONES[p]}
          <span className="sr-only sm:not-sr-only">{ROTULOS[p]}</span>
        </button>
      ))}
    </div>
  );
}
