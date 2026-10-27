import { useEffect, useState } from "react";
import { urlDaApi } from "../api/http";

// Iniciais para quando nao ha foto: "Ana Maria Souza" -> "AS"
function iniciais(nome: string) {
  const p = nome.split(/\s+/).filter((x) => x.length > 2 && !/^(de|da|do|das|dos)$/i.test(x));
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

const TAMANHOS = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-10 w-10 text-sm",
  md: "h-14 w-14 text-lg",
  lg: "h-24 w-24 text-3xl",
};

/** Foto redonda do vereador (iniciais se nao tiver foto) */
export function FotoVereador({ url, nome, tamanho = "sm" }: { url?: string | null; nome: string; tamanho?: keyof typeof TAMANHOS }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [url]);
  const classe = `${TAMANHOS[tamanho]} shrink-0 overflow-hidden rounded-full border border-slate-200`;
  if (url && !falhou) {
    return <img src={urlDaApi(url)} alt={`Foto de ${nome}`} className={`${classe} fundo-imagem object-cover`} loading="lazy" onError={() => setFalhou(true)} />;
  }
  return (
    <span className={`${classe} flex items-center justify-center bg-blue-50 font-bold text-blue-800`} aria-hidden="true">
      {iniciais(nome)}
    </span>
  );
}

/** Foto em retrato (3x4), ocupando a largura do cartao */
export function FotoRetrato({ url, nome }: { url?: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [url]);
  return (
    <div className={`aspect-[3/4] w-full overflow-hidden ${url && !falhou ? "fundo-imagem" : "bg-slate-100"}`}>
      {url && !falhou ? (
        <img src={urlDaApi(url)} alt={`Foto de ${nome}`} className="h-full w-full object-cover" loading="lazy" onError={() => setFalhou(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-blue-50 text-5xl font-bold text-blue-800" aria-hidden="true">
          {iniciais(nome)}
        </div>
      )}
    </div>
  );
}
