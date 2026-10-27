import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { mensagemErro, urlDaApi } from "../../api/http";
import { feedApi, publicApi } from "../../api/public";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { BotaoVoltar, Logo, LogoLinha } from "../../components/Logo";
import { formatarData } from "../../lib/formato";
import { EtiquetaTipo, OpcoesTipo, useTiposPublicacao, SeloSituacaoPublicacao, valorDestaque } from "../../lib/tiposPublicacao";
import { BotoesBaixar, FiltroTipos } from "../../components/FiltroTipos";
import { BotaoNotificacoes } from "../../components/BotaoNotificacoes";
import { FaleComOrgao } from "../../components/FaleComOrgao";

// Tela 3: diario/feed de publicacoes do orgao, com busca e filtros
export default function OrgaoPage() {
  const { slug = "", orgao = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const tipo = params.get("tipo") ?? "";
  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";
  const pagina = Number(params.get("pagina") || 1);
  const [form, setForm] = useState({ q, tipo, de, ate });
  const tipos = useTiposPublicacao();

  const municipio = useQuery({ queryKey: ["municipio", slug], queryFn: () => publicApi.municipio(slug) });
  const feed = useQuery({
    queryKey: ["feed", slug, orgao, { q, tipo, de, ate, pagina }],
    queryFn: () => feedApi.feed(slug, { orgao, q, tipo, de, ate, pagina }),
    placeholderData: keepPreviousData,
  });

  function aplicar(e: FormEvent) {
    e.preventDefault();
    const novo = new URLSearchParams();
    Object.entries(form).forEach(([k, v]) => v && novo.set(k, v));
    setParams(novo);
  }

  function irPara(p: number) {
    const novo = new URLSearchParams(params);
    novo.set("pagina", String(p));
    setParams(novo);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (municipio.isLoading) return <Carregando />;
  if (municipio.error || !municipio.data) return <Erro texto={mensagemErro(municipio.error)} onTentar={() => municipio.refetch()} />;

  const orgaoAtual = municipio.data.orgaos.find((o) => o.tipo === orgao);
  if (!orgaoAtual) return <Erro texto="Órgão não encontrado neste município." />;
  const filtrando = Boolean(q || tipo || de || ate);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <BotaoVoltar para={`/${slug}`} rotulo={`Voltar para ${municipio.data.municipio.nome}`} />
        <Link to="/" className="px-2 text-sm text-slate-600 hover:underline">
          Trocar de município
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Logo url={orgaoAtual.logoUrl} nome={orgaoAtual.nome} tamanho="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{orgaoAtual.nome}</h1>
          <p className="text-slate-600">
            {municipio.data.municipio.nome} / {municipio.data.municipio.uf}
          </p>
          {orgaoAtual.plenario && <p className="text-sm text-slate-600">{orgaoAtual.plenario}</p>}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <BotaoNotificacoes slug={slug} nome={municipio.data.municipio.nome} />
          <a href="#contato" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Fale conosco
          </a>
        </div>
        {/* Camara: conhecer os vereadores */}
        {orgao === "camara" && (
          <Link
            to={`/${slug}/camara/vereadores`}
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-center font-medium text-white hover:bg-blue-800 sm:w-auto"
          >
            Conheça os vereadores →
          </Link>
        )}
      </div>

      <form onSubmit={aplicar} className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_13rem_9.5rem_9.5rem_auto]">
        <div>
          <label htmlFor="f-q" className="block text-sm font-medium">
            Buscar
          </label>
          <input
            id="f-q"
            type="search"
            value={form.q}
            onChange={(e) => setForm({ ...form, q: e.target.value })}
            placeholder="Palavra, número ou assunto"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="f-tipo" className="block text-sm font-medium">
            Tipo
          </label>
          <select
            id="f-tipo"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <OpcoesTipo tipos={tipos.doOrgao(orgao)} />
          </select>
        </div>
        <div>
          <label htmlFor="f-de" className="block text-sm font-medium">
            De
          </label>
          <input id="f-de" type="date" value={form.de} onChange={(e) => setForm({ ...form, de: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="f-ate" className="block text-sm font-medium">
            Até
          </label>
          <input id="f-ate" type="date" value={form.ate} onChange={(e) => setForm({ ...form, ate: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
            Filtrar
          </button>
          {filtrando && (
            <button
              type="button"
              onClick={() => {
                setForm({ q: "", tipo: "", de: "", ate: "" });
                setParams(new URLSearchParams());
              }}
              className="px-2 py-2 text-sm text-slate-600 hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      </form>

      <div className="mt-6">
        {feed.isLoading && <Carregando />}
        {feed.error && <Erro texto={mensagemErro(feed.error)} onTentar={() => feed.refetch()} />}
        {feed.data && feed.data.itens.length === 0 && (
          <Vazio texto={filtrando ? "Nenhuma publicação encontrada com esses filtros." : "Nenhuma publicação ainda."} />
        )}

        {feed.data && feed.data.itens.length > 0 && (
          <>
            {/* Quantidade por tipo (cores); clicar filtra */}
            <div className="mb-4">
              <FiltroTipos
                porTipo={feed.data.porTipo ?? []}
                tipoAtual={tipo}
                nome={tipos.nome}
                cor={tipos.cor}
                onEscolher={(t) => {
                  const novo = new URLSearchParams(params);
                  if (t) novo.set("tipo", t);
                  else novo.delete("tipo");
                  novo.delete("pagina");
                  setParams(novo);
                  setForm((f) => ({ ...f, tipo: t }));
                }}
              />
            </div>
            <ol className="space-y-3">
              {feed.data.itens.map((p) => (
                <li
                  key={p.slug}
                  className="flex min-h-[7rem] overflow-hidden rounded-xl border border-l-[6px] border-slate-200 bg-white shadow-sm transition hover:shadow"
                  style={{ borderLeftColor: tipos.cor(p.tipo) }}
                >
                  {/* Logo do orgao na frente de cada publicacao, com a altura da linha */}
                  <Link to={`/${slug}/p/${p.slug}`} className="flex self-stretch" tabIndex={-1} aria-hidden="true">
                    <LogoLinha url={p.orgao?.logoUrl ?? orgaoAtual.logoUrl} nome={p.orgao?.nome ?? orgaoAtual.nome} />
                  </Link>
                  <div className="min-w-0 flex-1 p-4">
                    <Link to={`/${slug}/p/${p.slug}`} className="group block">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <EtiquetaTipo nome={tipos.nome(p.tipo)} cor={tipos.cor(p.tipo)} />
                        {p.numero && <span className="font-medium text-slate-700">nº {p.numero}</span>}
                        <time dateTime={p.publicadoEm}>{formatarData(p.publicadoEm)}</time>
                        {valorDestaque(tipos.porId(p.tipo), p.detalhes) && (
                          <SeloSituacaoPublicacao texto={valorDestaque(tipos.porId(p.tipo), p.detalhes)!} />
                        )}
                        {p.corrigidoEm && <span className="rounded bg-amber-100 px-1.5 text-amber-800">atualizado</span>}
                        {p.confiabilidade === "pendente_confirmacao" && (
                          <span className="rounded bg-amber-100 px-1.5 text-amber-800">pendente de confirmação</span>
                        )}
                      </div>
                      <h2 className="mt-1 text-lg font-semibold text-blue-800 group-hover:underline">{p.titulo}</h2>
                      {p.autores && p.autores.length > 0 && (
                        <p className="mt-1 text-sm text-slate-600">
                          Autoria: <span className="font-medium text-slate-800">{p.autores.map((a) => a.nome).join(", ")}</span>
                        </p>
                      )}
                      {p.resumo && <p className="mt-1 line-clamp-2 text-sm text-slate-700">{p.resumo}</p>}
                    </Link>
                    {/* Documentos para baixar direto da lista */}
                    {p.anexos && p.anexos.length > 0 && (
                      <div className="mt-3">
                        <BotoesBaixar anexos={p.anexos} hrefDe={(u) => urlDaApi(`${u}?download=1`)} />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {feed.data.paginas > 1 && (
              <nav aria-label="Paginação" className="mt-6 flex items-center justify-between text-sm">
                <button
                  disabled={pagina <= 1}
                  onClick={() => irPara(pagina - 1)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 disabled:opacity-50"
                >
                  ← Mais recentes
                </button>
                <span>
                  Página {feed.data.pagina} de {feed.data.paginas}
                </span>
                <button
                  disabled={pagina >= feed.data.paginas}
                  onClick={() => irPara(pagina + 1)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 disabled:opacity-50"
                >
                  Mais antigas →
                </button>
              </nav>
            )}
          </>
        )}
      </div>
      <FaleComOrgao
        orgaoId={orgaoAtual.id}
        orgaoNome={orgaoAtual.nome}
        contatos={orgaoAtual.contatos ?? {}}
        recebeMensagens={orgaoAtual.recebeMensagens !== false}
      />
    </section>
  );
}
