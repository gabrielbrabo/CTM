import { useEffect, useState } from "react";

/**
 * Tamanho da letra escolhido pelo usuario (A- / A / A+).
 * Muda o tamanho base da pagina (todo o site acompanha) e fica salvo no navegador.
 * O index.html aplica o tamanho salvo antes de desenhar a pagina.
 */

const CHAVE = "ctm-fonte";
const PASSOS = [87.5, 100, 112.5, 125, 137.5, 150]; // % do tamanho normal
const NORMAL = 100;

function lerSalvo(): number {
  try {
    const v = Number(localStorage.getItem(CHAVE));
    return PASSOS.includes(v) ? v : NORMAL;
  } catch {
    return NORMAL;
  }
}

export function SeletorFonte() {
  const [tamanho, setTamanho] = useState(lerSalvo);

  useEffect(() => {
    document.documentElement.style.fontSize = tamanho === NORMAL ? "" : `${tamanho}%`;
    try {
      localStorage.setItem(CHAVE, String(tamanho));
    } catch {
      // navegador sem armazenamento: so nao guarda
    }
  }, [tamanho]);

  const i = PASSOS.indexOf(tamanho);
  const classe = "flex h-7 min-w-[2rem] items-center justify-center rounded-md px-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40";

  return (
    <div role="group" aria-label="Tamanho da letra" className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5">
      <button type="button" className={`${classe} text-xs`} disabled={i <= 0} onClick={() => setTamanho(PASSOS[i - 1])} title="Diminuir a letra" aria-label="Diminuir a letra">
        A−
      </button>
      <button
        type="button"
        className={`${classe} text-sm ${tamanho !== NORMAL ? "text-blue-700" : ""}`}
        onClick={() => setTamanho(NORMAL)}
        title="Tamanho normal"
        aria-label={`Tamanho normal (atual: ${tamanho}%)`}
      >
        A
      </button>
      <button
        type="button"
        className={`${classe} text-base`}
        disabled={i >= PASSOS.length - 1}
        onClick={() => setTamanho(PASSOS[i + 1])}
        title="Aumentar a letra"
        aria-label="Aumentar a letra"
      >
        A+
      </button>
    </div>
  );
}
