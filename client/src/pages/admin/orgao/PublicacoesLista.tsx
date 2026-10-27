import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { abrirArquivoProtegido, mensagemErro } from "../../../api/http";
import { orgaoApi } from "../../../api/orgao";
import { Carregando, Erro, Vazio } from "../../../components/Estado";
import { Compartilhar } from "../../../components/Compartilhar";
import { BotoesImprimir, urlImpressao } from "../../../components/Imprimir";
import { Aviso, Botao, Selecao } from "../../../components/ui";
import { COR_ESTADO, NOME_ESTADO, formatarDataHora } from "../../../lib/formato";
import { useAvisos } from "../../../lib/avisos";
import { EtiquetaTipo, OpcoesTipo, useTiposPublicacao, SeloSituacaoPublicacao, valorDestaque } from "../../../lib/tiposPublicacao";
import { BotoesBaixar, FiltroTipos } from "../../../components/FiltroTipos";

// Lista de publicacoes do orgao, com filtros por estado/tipo e busca
export default function PublicacoesLista() {
  const { orgaoId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const estado = params.get("estado") ?? "";
  const tipo = params.get("tipo") ?? "";
  const q = params.get("q") ?? "";
  const pagina = Number(params.get("pagina") || 1);
  const [busca, setBusca] = useState(q);
  const location = useLocation();
  const navigate = useNavigate();
  // Aviso vindo do editor logo depois de publicar
  const publicada = (
    location.state as { publicada?: { id: string; titulo: string; link: string | null; temAnexos?: boolean } } | null
  )?.publicada;
  const { avisar } = useAvisos();
  const tipos = useTiposPublicacao();
  const painel = useQuery({ queryKey: ["orgao", orgaoId, "painel"], queryFn: () => orgaoApi(orgaoId).painel() });

  // Atualiza um filtro na URL (e volta para a pagina 1)
  function filtrar(chave: string, valor: string) {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    if (chave !== "pagina") novo.delete("pagina");
    setParams(novo, { replace: true });
  }

  // Busca depois que a pessoa para de digitar
  useEffect(() => {
    const t = setTimeout(() => {
      if (busca.trim() !== q) filtrar("q", busca.trim());
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["orgao", orgaoId, "publicacoes", { estado, tipo, q, pagina }],
    queryFn: () => orgaoApi(orgaoId).publicacoes({ estado, tipo, q, pagina }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      {publicada && (
        <Aviso tipo="sucesso">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              <strong>“{publicada.titulo}”</strong> foi publicada e já está disponível no portal.
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {publicada.link && (
                <a
                  href={publicada.link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-green-200 bg-white px-3 py-1.5 font-medium text-green-800 hover:bg-green-50"
                >
                  Ver no portal
                </a>
              )}
              <BotoesImprimir
                compacto
                temAnexos={publicada.temAnexos ?? true}
                onImprimir={(parte) =>
                  abrirArquivoProtegido(urlImpressao(`/api/admin/o/${orgaoId}/publicacoes/${publicada.id}/impressao.pdf`, parte)).catch(
                    (e) => avisar("erro", mensagemErro(e))
                  )
                }
              />
              <button
                type="button"
                aria-label="Fechar aviso"
                className="px-2 text-green-800"
                onClick={() => navigate(location.pathname + location.search, { replace: true, state: null })}
              >
                ✕
              </button>
            </span>
          </div>
          {publicada.link && (
            <div className="mt-3 border-t border-green-200 pt-3">
              <Compartilhar titulo={publicada.titulo} url={`${window.location.origin}${publicada.link}`} />
            </div>
          )}
        </Aviso>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Publicações</h1>
        <Link
          to={`/admin/o/${orgaoId}/publicacoes/nova`}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          + Nova publicação
        </Link>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_11rem_11rem]">
        <div>
          <label htmlFor="busca-pub" className="block text-sm font-medium text-slate-700">
            Buscar
          </label>
          <input
            id="busca-pub"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Título, número ou texto"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <Selecao label="Situação" value={estado} onChange={(e) => filtrar("estado", e.target.value)}>
          <option value="">Todas</option>
          {Object.entries(NOME_ESTADO).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </Selecao>
        <Selecao label="Tipo" value={tipo} onChange={(e) => filtrar("tipo", e.target.value)}>
          <option value="">Todos</option>
          <OpcoesTipo tipos={painel.data ? tipos.doOrgao(painel.data.orgao.tipo) : []} />
        </Selecao>
      </div>

      {isLoading && <Carregando />}
      {error && <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />}
      {data && data.itens.length === 0 && (
        <Vazio texto={estado || tipo || q ? "Nenhuma publicação com esses filtros." : "Nenhuma publicação ainda."} />
      )}

      {data && data.itens.length > 0 && (
        <>
          {/* Quantidade por tipo (cores); clicar filtra */}
          <FiltroTipos porTipo={data.porTipo ?? []} tipoAtual={tipo} nome={tipos.nome} cor={tipos.cor} onEscolher={(t) => filtrar("tipo", t)} />
          <ul className="space-y-2">
            {data.itens.map((p) => (
              <li
                key={p.id}
                className="overflow-hidden rounded-xl border border-l-[6px] border-slate-200 bg-white hover:shadow-sm"
                style={{ borderLeftColor: tipos.cor(p.tipo) }}
              >
                <Link to={`/admin/o/${orgaoId}/publicacoes/${p.id}`} className="block px-4 pb-2 pt-3 hover:bg-slate-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <EtiquetaTipo nome={tipos.nome(p.tipo)} cor={tipos.cor(p.tipo)} />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_ESTADO[p.estado]}`}>
                      {NOME_ESTADO[p.estado]}
                    </span>
                    {valorDestaque(tipos.porId(p.tipo), p.detalhes) && (
                      <SeloSituacaoPublicacao texto={valorDestaque(tipos.porId(p.tipo), p.detalhes)!} />
                    )}
                    {p.numero && <span className="text-xs font-medium text-slate-600">nº {p.numero}</span>}
                  </div>
                  <p className="mt-1 font-medium text-blue-800">{p.titulo}</p>
                  <p className="text-xs text-slate-500">
                    Atualizado em {formatarDataHora(p.atualizadoEm)}
                    {p.publicadoEm && ` · publicado em ${formatarDataHora(p.publicadoEm)}`}
                  </p>
                </Link>
                {p.anexos && p.anexos.length > 0 && (
                  <div className="px-4 pb-3">
                    <BotoesBaixar
                      anexos={p.anexos}
                      onBaixar={(u) => abrirArquivoProtegido(u).catch((e) => avisar("erro", mensagemErro(e)))}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {data.paginas > 1 && (
            <div className="flex items-center justify-between text-sm">
              <Botao variante="secundario" disabled={pagina <= 1} onClick={() => filtrar("pagina", String(pagina - 1))}>
                Anterior
              </Botao>
              <span>
                Página {data.pagina} de {data.paginas}
              </span>
              <Botao
                variante="secundario"
                disabled={pagina >= data.paginas}
                onClick={() => filtrar("pagina", String(pagina + 1))}
              >
                Próxima
              </Botao>
            </div>
          )}
        </>
      )}
    </div>
  );
}
