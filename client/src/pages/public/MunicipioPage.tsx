import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Link, useParams } from "react-router-dom";
import { mensagemErro } from "../../api/http";
import { publicApi } from "../../api/public";
import { OrgaoResumo } from "../../api/types";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { BotaoVoltar, Logo, LogoQuadro } from "../../components/Logo";
import { nomeEstado } from "../../lib/estados";
import { BotaoNotificacoes } from "../../components/BotaoNotificacoes";

const DESCRICAO: Record<string, string> = {
  prefeitura: "Decretos, obras, licitações, comunicados e serviços.",
  camara: "Projetos de lei, indicações, requerimentos, sessões e votações.",
};

// Ordem fixa: Prefeitura primeiro, depois Camara
const ordem = (o: OrgaoResumo) => (o.tipo === "prefeitura" ? 0 : o.tipo === "camara" ? 1 : 2);

// Tela 2: dentro do municipio, escolher Prefeitura ou Camara (lado a lado, com logo em quadro)
export default function MunicipioPage() {
  const { slug = "" } = useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["municipio", slug],
    queryFn: () => publicApi.municipio(slug),
  });

  if (isLoading) return <Carregando />;
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    return (
      <div className="space-y-4">
        <BotaoVoltar para="/" rotulo="Voltar para os municípios" />
        <Erro texto="Município não encontrado." />
      </div>
    );
  }
  if (error || !data) return <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />;

  const { municipio, orgaos } = data;
  const principais = orgaos.filter((o) => o.tipo === "prefeitura" || o.tipo === "camara").sort((a, b) => ordem(a) - ordem(b));

  return (
    <section>
      <BotaoVoltar para="/" rotulo="Voltar para os municípios" />

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Logo url={municipio.brasaoUrl} nome={municipio.nome} tamanho="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{municipio.nome}</h1>
          <p className="text-slate-600">{nomeEstado(municipio.uf)}</p>
        </div>
        {/* Avisos no sininho quando a Prefeitura ou a Camara publicarem */}
        <BotaoNotificacoes slug={municipio.slug} nome={municipio.nome} />
      </div>
      <p className="mt-4 text-slate-600">Escolha o órgão para ver as publicações e documentos:</p>

      {principais.length === 0 ? (
        <div className="mt-6">
          <Vazio texto="Nenhum órgão disponível neste município no momento." />
        </div>
      ) : (
        // Computador: lado a lado e centralizados. Celular: um embaixo do outro, largura toda
        <ul className={`mx-auto mt-6 grid grid-cols-1 gap-4 sm:gap-6 ${principais.length > 1 ? "sm:max-w-3xl sm:grid-cols-2" : "sm:max-w-sm"}`}>
          {principais.map((o) => (
            <li key={o.id}>
              <Link
                to={`/${municipio.slug}/${o.tipo}`}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-sm transition hover:border-blue-400 hover:shadow"
              >
                {/* Logo ocupa o quadro todo; embaixo so nome, legenda e botao */}
                <LogoQuadro url={o.logoUrl} nome={o.nome} />
                <span className="flex flex-1 flex-col items-center p-3 sm:p-5">
                  <span className="text-base font-semibold leading-snug sm:text-lg">{o.nome}</span>
                  <span className="mt-1 hidden text-sm text-slate-600 sm:block">{DESCRICAO[o.tipo]}</span>
                  <span className="mt-auto w-full pt-3">
                    <span className="block w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white">
                      Ver publicações
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
