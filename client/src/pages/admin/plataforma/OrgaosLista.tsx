import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../../../components/Logo";
import { mensagemErro } from "../../../api/http";
import { platformApi } from "../../../api/platform";
import { SituacaoOrgao } from "../../../api/types";
import { Carregando, Erro, Vazio } from "../../../components/Estado";
import { SeloSituacao, Selecao } from "../../../components/ui";
import { NOME_TIPO, diasAte, formatarData } from "../../../lib/formato";

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Lista de todos os orgaos contratantes (Prefeituras e Camaras)
export default function OrgaosLista() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["plataforma", "orgaos"], queryFn: platformApi.orgaos });
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [situacao, setSituacao] = useState<"" | SituacaoOrgao>("");

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (data || []).filter(
      (o) =>
        (!tipo || o.tipo === tipo) &&
        (!situacao || o.situacao === situacao) &&
        (!termo || normalizar(`${o.nome} ${o.municipio?.nome} ${o.municipio?.uf} ${o.cnpj ?? ""}`).includes(termo))
    );
  }, [data, busca, tipo, situacao]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Órgãos</h1>
        <Link to="/admin/orgaos/novo" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
          + Novo órgão
        </Link>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_10rem_10rem]">
        <div>
          <label htmlFor="busca-orgao" className="block text-sm font-medium text-slate-700">
            Buscar
          </label>
          <input
            id="busca-orgao"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, município ou CNPJ"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <Selecao label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos</option>
          <option value="prefeitura">Prefeitura</option>
          <option value="camara">Câmara</option>
        </Selecao>
        <Selecao label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value as "" | SituacaoOrgao)}>
          <option value="">Todas</option>
          <option value="ativo">Ativo</option>
          <option value="suspenso">Suspenso</option>
          <option value="encerrado">Encerrado</option>
        </Selecao>
      </div>

      {isLoading && <Carregando />}
      {error && <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />}
      {data && data.length === 0 && <Vazio texto="Nenhum órgão cadastrado. Clique em “Novo órgão” para começar." />}
      {data && data.length > 0 && filtrados.length === 0 && <Vazio texto="Nenhum órgão com esses filtros." />}

      {filtrados.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Órgão</th>
                <th className="px-4 py-3 font-medium">Município</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium">Fim do contrato</th>
                <th className="px-4 py-3 font-medium">Usuários</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((o) => {
                const dias = diasAte(o.contrato?.fim);
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Logo url={o.logoUrl} nome={o.nome} tamanho="sm" />
                        <div>
                          <Link to={`/admin/orgaos/${o.id}`} className="font-medium text-blue-700 hover:underline">
                            {o.nome}
                          </Link>
                          <Link to={`/admin/o/${o.id}`} className="block text-xs text-slate-500 hover:text-blue-700 hover:underline">
                            Entrar no painel do órgão →
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.municipio?.nome}/{o.municipio?.uf}
                    </td>
                    <td className="px-4 py-3">{NOME_TIPO[o.tipo]}</td>
                    <td className="px-4 py-3">
                      <SeloSituacao situacao={o.situacao} />
                    </td>
                    <td className={`px-4 py-3 ${dias !== null && dias < 0 ? "text-red-700" : ""}`}>
                      {formatarData(o.contrato?.fim)}
                    </td>
                    <td className="px-4 py-3">{o.totalUsuarios ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
