import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Link, useParams } from "react-router-dom";
import { mensagemErro, urlDaApi } from "../../api/http";
import { VereadorResumo, VinculosPublicos, feedApi } from "../../api/public";
import { Carregando, Erro } from "../../components/Estado";
import { NOME_EVENTO, formatarData, formatarDataHora, formatarTamanho } from "../../lib/formato";
import { Compartilhar } from "../../components/Compartilhar";
import { DocumentoNoCorpo } from "../../components/DocumentoNoCorpo";
import { FotoVereador } from "../../components/FotoVereador";
import { COR_PRESENCA, COR_VOTO, NOME_PRESENCA, NOME_VOTO } from "../../lib/vereadores";
import { BotoesImprimir, anexoImprimivel } from "../../components/Imprimir";
import { BotaoVoltar, Logo } from "../../components/Logo";
import { EtiquetaTipo, FichaDetalhes, useTiposPublicacao, SeloSituacaoPublicacao, valorDestaque } from "../../lib/tiposPublicacao";

// Chip de um vereador (foto + nome + partido), leva ao perfil
function ChipVereador({ slug, v }: { slug: string; v: VereadorResumo }) {
  return (
    <Link
      to={`/${slug}/vereadores/${v.id}`}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-sm hover:border-blue-400"
    >
      <FotoVereador url={v.fotoUrl} nome={v.nome} tamanho="xs" />
      <span className="font-medium">{v.nome}</span>
      {v.partido && <span className="text-slate-500">{v.partido}</span>}
    </Link>
  );
}

// Autores, relator, votacao nominal e presenca (Camara)
function VereadoresDaPublicacao({ slug, v }: { slug: string; v: VinculosPublicos }) {
  const conta = (voto: string) => v.votos.filter((x) => x.voto === voto).length;
  const contaP = (s: string) => v.presencas.filter((x) => x.situacao === s).length;
  if (!v.autores.length && !v.relator && !v.votos.length && !v.presencas.length) return null;
  return (
    <div className="mt-6 space-y-6">
      {v.autores.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700">{v.autores.length > 1 ? "Autores" : "Autor(a)"}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {v.autores.map((a) => (
              <ChipVereador key={a.id} slug={slug} v={a} />
            ))}
          </div>
        </section>
      )}
      {v.relator && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700">Relator(a)</h2>
          <div className="mt-2">
            <ChipVereador slug={slug} v={v.relator} />
          </div>
        </section>
      )}
      {v.votos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Votação dos vereadores</h2>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center">
            {(["sim", "nao", "abstencao", "ausente"] as const).map((x) => (
              <div key={x} className={`rounded-lg p-2 ${COR_VOTO[x]}`}>
                <p className="text-xl font-bold">{conta(x)}</p>
                <p className="text-xs">{NOME_VOTO[x]}</p>
              </div>
            ))}
          </div>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {v.votos.map((x) => (
              <li key={x.vereador.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <Link to={`/${slug}/vereadores/${x.vereador.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                  <FotoVereador url={x.vereador.fotoUrl} nome={x.vereador.nome} tamanho="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{x.vereador.nome}</span>
                    {x.vereador.partido && <span className="block text-xs text-slate-500">{x.vereador.partido}</span>}
                  </span>
                </Link>
                <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${COR_VOTO[x.voto]}`}>{NOME_VOTO[x.voto]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {v.presencas.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Presença dos vereadores</h2>
          <p className="mt-1 text-sm text-slate-600">
            {contaP("presente")} presente(s) · {contaP("ausente")} ausente(s) · {contaP("justificada")} justificada(s)
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {v.presencas.map((x) => (
              <li key={x.vereador.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <Link to={`/${slug}/vereadores/${x.vereador.id}`} className="flex min-w-0 items-center gap-2 text-sm font-medium hover:underline">
                  <FotoVereador url={x.vereador.fotoUrl} nome={x.vereador.nome} tamanho="xs" />
                  <span className="truncate">{x.vereador.nome}</span>
                </Link>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COR_PRESENCA[x.situacao]}`}>{NOME_PRESENCA[x.situacao]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Pagina de detalhe de uma publicacao (link compartilhavel)
export default function PublicacaoPage() {
  const { slug = "", pubSlug = "" } = useParams();
  const tipos = useTiposPublicacao();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["publicacao", slug, pubSlug],
    queryFn: () => feedApi.publicacao(slug, pubSlug),
  });

  if (isLoading) return <Carregando />;
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    return (
      <div className="space-y-4">
        <BotaoVoltar para={`/${slug}`} rotulo="Voltar" />
        <Erro texto="Publicação não encontrada. Ela pode ter sido retirada do portal." />
      </div>
    );
  }
  if (error || !data) return <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />;

  const { municipio, orgao, publicacao: p } = data;
  const def = tipos.porId(p.tipo);
  const destaque = valorDestaque(def, p.detalhes);

  return (
    <article>
      <div className="flex flex-wrap items-center gap-2">
        <BotaoVoltar para={`/${municipio.slug}/${orgao.tipo}`} rotulo={`Voltar para ${orgao.nome}`} />
        <Link to={`/${municipio.slug}`} className="px-2 text-sm text-slate-600 hover:underline">
          {municipio.nome}
        </Link>
      </div>

      {/* Logo do orgao na frente da publicacao (como um timbre) */}
      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <Logo url={orgao.logoUrl} nome={orgao.nome} tamanho="lg" />
        <div className="min-w-0">
          <p className="text-lg font-bold leading-snug text-blue-900 sm:text-xl">{orgao.nome}</p>
          <p className="text-sm text-slate-600">
            {municipio.nome} / {municipio.uf}
          </p>
        </div>
      </div>

      <header className="mt-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <EtiquetaTipo nome={tipos.nome(p.tipo)} cor={tipos.cor(p.tipo)} grande />
          {p.numero && <span className="font-semibold text-slate-800">nº {p.numero}</span>}
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{p.titulo}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Publicado em {formatarDataHora(p.publicadoEm)}
          {p.dataReferencia && ` · data do documento: ${formatarData(p.dataReferencia)}`}
          {p.corrigidoEm && ` · última atualização em ${formatarDataHora(p.corrigidoEm)}`}
        </p>
        {destaque && (
          <div className="mt-2">
            <SeloSituacaoPublicacao texto={destaque} grande />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Compartilhar titulo={p.titulo} url={`${window.location.origin}/${municipio.slug}/p/${p.slug}`} />
          <BotoesImprimir
            compacto
            temAnexos={p.anexos.some(anexoImprimivel)}
            hrefBase={urlDaApi(`/api/public/m/${municipio.slug}/p/${p.slug}/impressao.pdf`)}
          />
        </div>
      </header>

      {/* Documentos para baixar, logo no topo */}
      {p.anexos.length > 0 && (
        <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <h2 className="text-sm font-semibold text-blue-900">
            {p.anexos.length > 1 ? `Documentos para baixar (${p.anexos.length})` : "Documento para baixar"}
          </h2>
          <ul className="mt-2 space-y-2">
            {p.anexos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                <a href={urlDaApi(a.url)} target="_blank" rel="noreferrer" className="min-w-0 break-words font-medium text-blue-700 hover:underline">
                  {a.nome}
                </a>
                <span className="flex items-center gap-3 text-slate-500">
                  {formatarTamanho(a.tamanho)}
                  <a
                    href={urlDaApi(`${a.url}?download=1`)}
                    className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    ⬇ Baixar
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.confiabilidade === "pendente_confirmacao" && (
        <div role="note" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Informação <strong>pendente de confirmação</strong> pelo órgão. Pode ser atualizada.
        </div>
      )}
      {p.corrigidoEm && (
        <div role="note" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Esta publicação foi <strong>atualizada</strong>. Veja o que mudou no histórico, no fim da página.
        </div>
      )}

      {def && def.campos.length > 0 && (
        <section className="mt-6">
          <h2 className="sr-only">Dados</h2>
          <FichaDetalhes def={def} detalhes={p.detalhes ?? {}} />
        </section>
      )}

      {p.vereadores && <VereadoresDaPublicacao slug={municipio.slug} v={p.vereadores} />}

      {p.resumo && (
        <section className="mt-6 rounded-xl bg-blue-50 p-4">
          <h2 className="text-sm font-semibold text-blue-900">Resumo</h2>
          <p className="mt-1 whitespace-pre-line text-slate-800">{p.resumo}</p>
        </section>
      )}

      {/* Documento escaneado / imagem no lugar do texto */}
      {p.anexos.some((a) => a.noCorpo) && (
        <div className="mt-6">
          <DocumentoNoCorpo arquivos={p.anexos.filter((a) => a.noCorpo)} />
        </div>
      )}

      {p.conteudo && <div className="mt-6 whitespace-pre-line leading-relaxed text-slate-800">{p.conteudo}</div>}



      {(p.fonte?.nome || p.fonte?.url) && (
        <p className="mt-6 text-sm text-slate-600">
          Fonte oficial:{" "}
          {p.fonte.url ? (
            <a href={p.fonte.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
              {p.fonte.nome || p.fonte.url}
            </a>
          ) : (
            p.fonte.nome
          )}
        </p>
      )}

      {p.historico.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Histórico</h2>
          <ol className="mt-2 space-y-1 text-sm text-slate-700">
            {p.historico.map((h, i) => (
              <li key={i}>
                <span className="text-slate-500">{formatarDataHora(h.data)}</span> — {NOME_EVENTO[h.evento] ?? h.evento}
                {h.motivo && <>: {h.motivo}</>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
