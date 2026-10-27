import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { mensagemErro } from "../../api/http";
import { feedApi, vereadoresApi } from "../../api/public";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { BotaoVoltar } from "../../components/Logo";
import { FotoRetrato } from "../../components/FotoVereador";
import { formatarData } from "../../lib/formato";
import { SeloSituacaoPublicacao, useTiposPublicacao } from "../../lib/tiposPublicacao";
import { COR_PRESENCA, COR_VOTO, NOME_PRESENCA, NOME_SITUACAO_VEREADOR, NOME_VOTO, nomeVereador } from "../../lib/vereadores";

// Proposicoes de autoria do vereador (lista paginada do feed)
function Proposicoes({ slug, id }: { slug: string; id: string }) {
  const tipos = useTiposPublicacao();
  const [pagina, setPagina] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["feed", slug, "vereador", id, pagina],
    queryFn: () => feedApi.feed(slug, { orgao: "camara", vereador: id, pagina }),
    placeholderData: keepPreviousData,
  });
  if (isLoading) return <Carregando />;
  if (!data || data.itens.length === 0) return <Vazio texto="Nenhuma proposição de autoria publicada." />;
  return (
    <>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {data.itens.map((p) => (
          <li key={p.slug}>
            <Link to={`/${slug}/p/${p.slug}`} className="block px-4 py-3 hover:bg-slate-50">
              <span className="text-xs text-slate-500">
                {formatarData(p.publicadoEm)} · {tipos.nome(p.tipo)}
                {p.numero && ` nº ${p.numero}`}
              </span>
              <span className="block font-medium text-blue-800">{p.titulo}</span>
            </Link>
          </li>
        ))}
      </ul>
      {data.paginas > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-50">
            ← Mais recentes
          </button>
          <span>
            Página {data.pagina} de {data.paginas}
          </span>
          <button
            disabled={pagina >= data.paginas}
            onClick={() => setPagina(pagina + 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-50"
          >
            Mais antigas →
          </button>
        </div>
      )}
    </>
  );
}

function Numero({ valor, rotulo }: { valor: string | number; rotulo: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <p className="text-2xl font-bold text-blue-800">{valor}</p>
      <p className="text-xs text-slate-600">{rotulo}</p>
    </div>
  );
}

// Portal: perfil de um vereador (dados, proposicoes, votos e presenca)
export default function VereadorPage() {
  const { slug = "", id = "" } = useParams();
  const tipos = useTiposPublicacao();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["vereador", slug, id], queryFn: () => vereadoresApi.perfil(slug, id) });

  if (isLoading) return <Carregando />;
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    return (
      <div className="space-y-4">
        <BotaoVoltar para={`/${slug}/camara/vereadores`} rotulo="Voltar para os vereadores" />
        <Erro texto="Vereador não encontrado." />
      </div>
    );
  }
  if (error || !data) return <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />;

  const { vereador: v, autorias, votos, presencas } = data;
  const nome = nomeVereador(v);
  const percPresenca = presencas.total ? Math.round((presencas.presente / presencas.total) * 100) : null;
  const mandato =
    v.mandatoInicio || v.mandatoFim
      ? `${v.mandatoInicio ? formatarData(v.mandatoInicio) : "?"} a ${v.mandatoFim ? formatarData(v.mandatoFim) : "?"}`
      : null;

  return (
    <article>
      <BotaoVoltar para={`/${slug}/camara/vereadores`} rotulo="Voltar para os vereadores" />

      <div className="mt-5 grid gap-6 sm:grid-cols-[14rem_1fr]">
        <div className="mx-auto w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:w-full">
          <FotoRetrato url={v.fotoUrl} nome={nome} />
        </div>
        <div>
          <p className="text-sm text-slate-600">{data.camara.nome}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{nome}</h1>
          {v.nomeParlamentar && v.nomeParlamentar !== v.nome && <p className="text-slate-600">{v.nome}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {v.partido && <span className="rounded-full bg-slate-200 px-3 py-0.5 font-medium text-slate-800">{v.partido}</span>}
            <span className="rounded-full bg-blue-100 px-3 py-0.5 font-medium text-blue-900">{v.cargoNome}</span>
            {v.situacao !== "exercicio" && (
              <span className="rounded-full bg-amber-100 px-3 py-0.5 font-medium text-amber-900">{NOME_SITUACAO_VEREADOR[v.situacao]}</span>
            )}
          </div>

          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {v.legislatura && (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Legislatura</dt>
                <dd>{v.legislatura}</dd>
              </div>
            )}
            {mandato && (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Mandato</dt>
                <dd>{mandato}</dd>
              </div>
            )}
            {v.email && (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">E-mail</dt>
                <dd>
                  <a href={`mailto:${v.email}`} className="text-blue-700 hover:underline">
                    {v.email}
                  </a>
                </dd>
              </div>
            )}
            {v.telefone && (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Telefone</dt>
                <dd>{v.telefone}</dd>
              </div>
            )}
            {v.gabinete && (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Gabinete</dt>
                <dd>{v.gabinete}</dd>
              </div>
            )}
            {v.redeSocial && (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Rede social / site</dt>
                <dd>
                  <a href={v.redeSocial} target="_blank" rel="noreferrer" className="break-all text-blue-700 hover:underline">
                    {v.redeSocial}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {v.biografia && <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-800">{v.biografia}</p>}
        </div>
      </div>

      {/* Numeros do mandato */}
      <div className="mt-8 grid grid-cols-3 gap-3">
        <Numero valor={autorias.total} rotulo="Proposições" />
        <Numero valor={votos.length} rotulo="Votações nominais" />
        <Numero valor={percPresenca === null ? "—" : `${percPresenca}%`} rotulo="Presença nas sessões" />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Proposições de autoria</h2>
        {autorias.porTipo.length > 0 && (
          <p className="mt-1 text-sm text-slate-600">{autorias.porTipo.map((t) => `${t.total} ${tipos.nome(t.tipo)}`).join(" · ")}</p>
        )}
        <div className="mt-3">
          <Proposicoes slug={slug} id={id} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Como votou</h2>
        {votos.length === 0 ? (
          <div className="mt-3">
            <Vazio texto="Nenhuma votação nominal publicada." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {votos.map((x) => (
              <li key={x.slug} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <Link to={`/${slug}/p/${x.slug}`} className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {formatarData(x.data)}
                    {x.resultado && <SeloSituacaoPublicacao texto={x.resultado} />}
                  </span>
                  <span className="block font-medium text-blue-800 hover:underline">{x.titulo}</span>
                </Link>
                {x.voto && <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${COR_VOTO[x.voto]}`}>{NOME_VOTO[x.voto]}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Presença nas sessões</h2>
        {presencas.total === 0 ? (
          <div className="mt-3">
            <Vazio texto="Nenhuma presença registrada." />
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              {presencas.presente} presença(s) · {presencas.ausente} falta(s) · {presencas.justificada} justificada(s) — de {presencas.total} sessão(ões)
            </p>
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {presencas.ultimas.map((x) => (
                <li key={x.slug} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <Link to={`/${slug}/p/${x.slug}`} className="text-blue-800 hover:underline">
                    {x.titulo}
                  </Link>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COR_PRESENCA[x.situacao]}`}>{NOME_PRESENCA[x.situacao]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </article>
  );
}
