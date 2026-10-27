import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { mensagemErro } from "../../../api/http";
import { orgaoApi } from "../../../api/orgao";
import { Carregando, Erro, Vazio } from "../../../components/Estado";
import { Botao } from "../../../components/ui";
import { formatarDataHora } from "../../../lib/formato";
import { COR_SITUACAO_MSG, NOME_SITUACAO_MSG } from "../../cidadao/MinhaContaPage";

const ABAS = [
  ["", "Todas"],
  ["aberta", "Aguardando resposta"],
  ["respondida", "Respondidas"],
  ["encerrada", "Encerradas"],
] as const;

// Mensagens da populacao recebidas pelo orgao
export default function MensagensOrgao() {
  const { orgaoId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const situacao = params.get("situacao") ?? "";
  const pagina = Number(params.get("pagina") || 1);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["orgao", orgaoId, "mensagens", { situacao, pagina }],
    queryFn: () => orgaoApi(orgaoId).mensagens({ situacao: situacao || undefined, pagina }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const ir = (s: string, p = 1) => {
    const novo = new URLSearchParams();
    if (s) novo.set("situacao", s);
    if (p > 1) novo.set("pagina", String(p));
    setParams(novo, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mensagens da população</h1>
        <p className="text-sm text-slate-600">
          Enviadas pelo portal (“Fale com...”). O cidadão é avisado no sininho quando você responde.
          {data && data.naoLidas > 0 && <strong className="text-red-700"> {data.naoLidas} não lida(s).</strong>}
        </p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {ABAS.map(([v, r]) => {
          const n = v ? data?.porSituacao[v] : undefined;
          return (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={situacao === v}
              onClick={() => ir(v)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                situacao === v ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {r}
              {n ? <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-700">{n}</span> : null}
            </button>
          );
        })}
      </div>

      {isLoading && <Carregando />}
      {error && <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />}
      {data && data.itens.length === 0 && <Vazio texto="Nenhuma mensagem." />}
      {data && data.itens.length > 0 && (
        <ul className="space-y-2">
          {data.itens.map((m) => (
            <li key={m.id}>
              <Link
                to={`/admin/o/${orgaoId}/mensagens/${m.id}`}
                className={`block rounded-xl border px-4 py-3 hover:shadow-sm ${m.lida ? "border-slate-200 bg-white" : "border-blue-300 bg-blue-50"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {!m.lida && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">Nova</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_SITUACAO_MSG[m.situacao]}`}>{NOME_SITUACAO_MSG[m.situacao]}</span>
                  <span className="text-xs text-slate-500">protocolo {m.protocolo}</span>
                </div>
                <p className="mt-1 font-semibold text-blue-800">{m.assunto}</p>
                <p className="line-clamp-1 text-sm text-slate-600">{m.previa}</p>
                <p className="text-xs text-slate-500">
                  {m.cidadao?.nome} · {formatarDataHora(m.ultimaAtividade)} · {m.total} mensagem(ns)
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && data.paginas > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Botao variante="secundario" disabled={pagina <= 1} onClick={() => ir(situacao, pagina - 1)}>
            Anterior
          </Botao>
          <span>
            Página {data.pagina} de {data.paginas}
          </span>
          <Botao variante="secundario" disabled={pagina >= data.paginas} onClick={() => ir(situacao, pagina + 1)}>
            Próxima
          </Botao>
        </div>
      )}
    </div>
  );
}
