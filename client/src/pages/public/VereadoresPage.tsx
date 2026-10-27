import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Link, useParams } from "react-router-dom";
import { mensagemErro } from "../../api/http";
import { VereadorPublico, vereadoresApi } from "../../api/public";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { FotoRetrato } from "../../components/FotoVereador";
import { BotaoVoltar, Logo } from "../../components/Logo";
import { NOME_SITUACAO_VEREADOR, nomeVereador } from "../../lib/vereadores";

function Cartao({ slug, v }: { slug: string; v: VereadorPublico }) {
  return (
    <li>
      <Link
        to={`/${slug}/vereadores/${v.id}`}
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-sm transition hover:border-blue-400 hover:shadow"
      >
        <FotoRetrato url={v.fotoUrl} nome={nomeVereador(v)} />
        <span className="flex flex-1 flex-col p-3">
          <span className="font-semibold leading-snug">{nomeVereador(v)}</span>
          <span className="text-sm text-slate-600">{v.partido ?? "Sem partido"}</span>
          {v.cargoMesa !== "vereador" && (
            <span className="mx-auto mt-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900">{v.cargoNome}</span>
          )}
          {v.situacao !== "exercicio" && <span className="mt-1 text-xs text-slate-500">{NOME_SITUACAO_VEREADOR[v.situacao]}</span>}
        </span>
      </Link>
    </li>
  );
}

// Portal: quem sao os vereadores da Camara
export default function VereadoresPage() {
  const { slug = "" } = useParams();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["vereadores", slug], queryFn: () => vereadoresApi.lista(slug) });

  if (isLoading) return <Carregando />;
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    return (
      <div className="space-y-4">
        <BotaoVoltar para={`/${slug}`} rotulo="Voltar" />
        <Erro texto="Este município não tem Câmara no portal." />
      </div>
    );
  }
  if (error || !data) return <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />;

  const emExercicio = data.vereadores.filter((v) => v.situacao === "exercicio");
  const outros = data.vereadores.filter((v) => v.situacao !== "exercicio");

  return (
    <section>
      <BotaoVoltar para={`/${slug}/camara`} rotulo={`Voltar para ${data.camara.nome}`} />
      <div className="mt-5 flex items-center gap-4">
        <Logo url={data.camara.logoUrl} nome={data.camara.nome} tamanho="lg" />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Vereadores</h1>
          <p className="text-slate-600">{data.camara.nome}</p>
        </div>
      </div>

      {data.vereadores.length === 0 && (
        <div className="mt-6">
          <Vazio texto="Os vereadores ainda não foram cadastrados." />
        </div>
      )}
      {emExercicio.length > 0 && (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {emExercicio.map((v) => (
            <Cartao key={v.id} slug={slug} v={v} />
          ))}
        </ul>
      )}
      {outros.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-semibold">Licenciados, suplentes e ex-vereadores</h2>
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {outros.map((v) => (
              <Cartao key={v.id} slug={slug} v={v} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
