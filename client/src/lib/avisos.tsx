import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Avisos flutuantes ("pop-up") no topo da tela.
 * Aparecem por 5 segundos e somem sozinhos, em qualquer ponto da pagina
 * (mesmo se o usuario estiver la embaixo).
 *
 * Uso: const { avisar } = useAvisos(); avisar("sucesso", "Alterações salvas.");
 */

export type TipoAviso = "sucesso" | "erro" | "info";
type Aviso = { id: number; tipo: TipoAviso; texto: string };

const DURACAO_MS = 5000;

const AvisosContext = createContext<{ avisar: (tipo: TipoAviso, texto: string) => void } | null>(null);

const CORES: Record<TipoAviso, string> = {
  sucesso: "border-green-300 bg-green-50 text-green-900",
  erro: "border-red-300 bg-red-50 text-red-900",
  info: "border-blue-300 bg-blue-50 text-blue-900",
};
const ICONES: Record<TipoAviso, string> = { sucesso: "✓", erro: "!", info: "i" };
const CORES_ICONE: Record<TipoAviso, string> = {
  sucesso: "bg-green-600",
  erro: "bg-red-600",
  info: "bg-blue-600",
};

function ItemAviso({ aviso, fechar }: { aviso: Aviso; fechar: (id: number) => void }) {
  // Some sozinho depois de 5 segundos
  useEffect(() => {
    const t = setTimeout(() => fechar(aviso.id), DURACAO_MS);
    return () => clearTimeout(t);
  }, [aviso.id, fechar]);

  return (
    <div
      role={aviso.tipo === "erro" ? "alert" : "status"}
      className={`aviso-entrada pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-3 shadow-lg ${CORES[aviso.tipo]}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${CORES_ICONE[aviso.tipo]}`}
      >
        {ICONES[aviso.tipo]}
      </span>
      <p className="flex-1 pt-0.5 text-sm font-medium">{aviso.texto}</p>
      <button type="button" onClick={() => fechar(aviso.id)} aria-label="Fechar aviso" className="rounded px-1 text-lg leading-none opacity-60 hover:opacity-100">
        ×
      </button>
    </div>
  );
}

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const proximoId = useRef(1);

  const fechar = useCallback((id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

  const avisar = useCallback((tipo: TipoAviso, texto: string) => {
    const id = proximoId.current++;
    // No maximo 3 na tela; o mais novo fica por cima
    setAvisos((lista) => [{ id, tipo, texto }, ...lista].slice(0, 3));
  }, []);

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <AvisosContext.Provider value={valor}>
      {children}
      {/* Fixo no topo: aparece onde quer que o usuario esteja na pagina */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 px-4"
      >
        {avisos.map((a) => (
          <ItemAviso key={a.id} aviso={a} fechar={fechar} />
        ))}
      </div>
    </AvisosContext.Provider>
  );
}

export function useAvisos() {
  const ctx = useContext(AvisosContext);
  if (!ctx) throw new Error("useAvisos precisa estar dentro de <AvisosProvider>");
  return ctx;
}
