import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { mensagemErro } from "../../../api/http";
import { OrgaoPlataforma, platformApi } from "../../../api/platform";
import { Carregando, Erro } from "../../../components/Estado";
import { Secao } from "../../../components/ui";
import { diasAte, formatarData } from "../../../lib/formato";

function Cartao({ titulo, valor, detalhe }: { titulo: string; valor: number; detalhe?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">{titulo}</p>
      <p className="mt-1 text-3xl font-bold">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

function ListaContratos({ itens, vazio }: { itens: OrgaoPlataforma[]; vazio: string }) {
  if (itens.length === 0) return <p className="text-sm text-slate-500">{vazio}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {itens.map((o) => {
        const dias = diasAte(o.contrato?.fim);
        return (
          <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <Link to={`/admin/orgaos/${o.id}`} className="font-medium text-blue-700 hover:underline">
              {o.nome}
              <span className="font-normal text-slate-500">
                {" "}
                — {o.municipio?.nome}/{o.municipio?.uf}
              </span>
            </Link>
            <span className={dias !== null && dias < 0 ? "text-red-700" : "text-amber-700"}>
              {formatarData(o.contrato?.fim)}
              {dias !== null && (dias < 0 ? ` (venceu há ${-dias} dias)` : ` (${dias} dias)`)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Painel inicial do superadmin: numeros gerais + contratos que pedem atencao
export default function PainelPlataforma() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["plataforma", "resumo"], queryFn: platformApi.resumo });

  if (isLoading) return <Carregando />;
  if (error || !data) return <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Painel</h1>
        <Link to="/admin/orgaos/novo" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
          + Novo órgão
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          titulo="Órgãos ativos"
          valor={data.orgaos.ativo}
          detalhe={`${data.orgaos.prefeituras} prefeitura(s) · ${data.orgaos.camaras} câmara(s)`}
        />
        <Cartao titulo="Suspensos / encerrados" valor={data.orgaos.suspenso + data.orgaos.encerrado} />
        <Cartao titulo="Municípios" valor={data.municipios} />
        <Cartao titulo="Usuários dos órgãos" valor={data.usuarios} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Contratos vencidos (órgão ainda ativo)">
          <ListaContratos itens={data.contratosVencidos} vazio="Nenhum contrato vencido." />
        </Secao>
        <Secao titulo="Contratos vencendo em 30 dias">
          <ListaContratos itens={data.contratosVencendo} vazio="Nenhum contrato vencendo nos próximos 30 dias." />
        </Secao>
      </div>
    </div>
  );
}
