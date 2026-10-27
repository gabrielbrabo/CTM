import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cidadaoApi } from "../api/cidadao";
import { mensagemErro } from "../api/http";
import { useCidadao } from "../context/CidadaoContext";
import { useAvisos } from "../lib/avisos";

/**
 * "Ativar notificações" de um municipio. Sem conta, leva para entrar/cadastrar.
 * Ler o portal continua liberado para todos.
 */
export function BotaoNotificacoes({ slug, nome }: { slug: string; nome: string }) {
  const { conta, segue, atualizar } = useCidadao();
  const { avisar } = useAvisos();
  const navigate = useNavigate();
  const location = useLocation();
  const [ocupado, setOcupado] = useState(false);
  const ativo = segue(slug);

  async function alternar() {
    if (!conta) {
      navigate(`/entrar?voltar=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setOcupado(true);
    try {
      if (ativo) await cidadaoApi.deixarDeSeguir(slug);
      else await cidadaoApi.seguir(slug);
      atualizar();
      avisar("sucesso", ativo ? `Notificações de ${nome} desativadas.` : `Pronto! Você será avisado(a) das publicações de ${nome}.`);
    } catch (e) {
      avisar("erro", mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={ocupado}
      aria-pressed={ativo}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
        ativo ? "border border-green-300 bg-green-50 text-green-900" : "border border-blue-600 bg-white text-blue-700 hover:bg-blue-50"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={ativo ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {ativo ? "Notificações ativas" : "Ativar notificações"}
    </button>
  );
}
