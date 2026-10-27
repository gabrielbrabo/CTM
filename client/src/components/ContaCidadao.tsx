import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cidadaoApi } from "../api/cidadao";
import { useCidadao } from "../context/CidadaoContext";
import { formatarDataHora } from "../lib/formato";
import { Sino } from "./Sino";

// Lista curta das ultimas notificacoes (dentro do sininho)
function UltimasNotificacoes({ fechar }: { fechar: () => void }) {
  const { atualizar } = useCidadao();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["cidadao", "notificacoes", 1], queryFn: () => cidadaoApi.notificacoes(1) });
  const itens = (data?.itens ?? []).slice(0, 6);

  async function abrir(id: string, link: string) {
    fechar();
    await cidadaoApi.marcarLidas([id]).catch(() => undefined);
    atualizar();
    navigate(link);
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <p className="text-sm font-semibold">Notificações</p>
        {Boolean(data?.naoLidas) && (
          <button
            type="button"
            className="text-xs font-medium text-blue-700 hover:underline"
            onClick={async () => {
              await cidadaoApi.marcarLidas();
              atualizar();
            }}
          >
            Marcar todas como lidas
          </button>
        )}
      </div>
      {isLoading && <p className="p-4 text-sm text-slate-500">Carregando...</p>}
      {!isLoading && itens.length === 0 && (
        <p className="p-4 text-sm text-slate-600">Nenhuma notificação. Ative as notificações na página de um município.</p>
      )}
      <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {itens.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => abrir(n.id, n.link)} className={`block w-full px-4 py-2.5 text-left hover:bg-slate-50 ${n.lida ? "" : "bg-blue-50"}`}>
              <span className="flex items-start gap-2">
                {!n.lida && <span aria-label="não lida" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-snug text-slate-800">{n.titulo}</span>
                  <span className="block text-xs text-slate-500">{formatarDataHora(n.criadaEm)}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Link to="/minha-conta" onClick={fechar} className="block border-t border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-blue-700 hover:bg-slate-50">
        Ver tudo na minha conta
      </Link>
    </div>
  );
}

/**
 * Canto do cabecalho do portal: "Entrar" ou sininho + nome do cidadao.
 */
export function ContaCidadao() {
  const { conta, carregando, sair } = useCidadao();
  const location = useLocation();
  const [menu, setMenu] = useState(false);

  if (carregando) return null;
  if (!conta) {
    return (
      <Link
        to={`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`}
        className="whitespace-nowrap rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
      >
        Entrar
      </Link>
    );
  }

  const total = conta.notificacoesNaoLidas + conta.mensagensNaoLidas;
  const primeiroNome = conta.cidadao.nome.split(" ")[0];

  return (
    <div className="flex items-center gap-2">
      <Sino total={total} rotulo="Notificações">
        {(fechar) => (
          <>
            {conta.mensagensNaoLidas > 0 && (
              <Link to="/minha-conta#mensagens" onClick={fechar} className="block border-b border-slate-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-900">
                {conta.mensagensNaoLidas} resposta(s) nova(s) nas suas mensagens →
              </Link>
            )}
            <UltimasNotificacoes fechar={fechar} />
          </>
        )}
      </Sino>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          onBlur={() => setTimeout(() => setMenu(false), 150)}
          className="max-w-[8rem] truncate rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-expanded={menu}
        >
          {primeiroNome} ▾
        </button>
        {menu && (
          <div className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <Link to="/minha-conta" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Minha conta
            </Link>
            <Link to="/minha-conta#mensagens" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Minhas mensagens
            </Link>
            <button type="button" onClick={() => sair()} className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50">
              Sair
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
