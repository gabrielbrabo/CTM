import { Link, Outlet } from "react-router-dom";
import { SeletorTema } from "../lib/tema";
import { SeletorFonte } from "../lib/fonte";
import { ContaCidadao } from "./ContaCidadao";

// Moldura do portal publico: cabecalho, conteudo e rodape
export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="text-lg font-bold leading-tight text-blue-800">
            {/* Nome curto no celular para nao quebrar em varias linhas */}
            <span className="sm:hidden">Diário Digital</span>
            <span className="hidden sm:inline">Diário Digital de Transparência</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <SeletorFonte />
            <SeletorTema />
            <ContaCidadao />
            <Link to="/admin" className="whitespace-nowrap text-xs text-slate-500 hover:text-slate-900 sm:text-sm">
              Área do servidor
            </Link>
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-500">
          Este portal complementa os canais oficiais do município e não substitui as publicações exigidas por lei.
        </p>
      </footer>
    </div>
  );
}
