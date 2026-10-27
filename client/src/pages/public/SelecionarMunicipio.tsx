import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { mensagemErro } from "../../api/http";
import { publicApi } from "../../api/public";
import { Carregando, Erro, Vazio } from "../../components/Estado";
import { Logo } from "../../components/Logo";
import { nomeEstado } from "../../lib/estados";

// Remove acentos para a busca ("sao" encontra "São")
const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Tela 1: lista de municipios (uma linha inteira por municipio, com brasao), busca e filtro por estado
export default function SelecionarMunicipio() {
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState("");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["municipios"], queryFn: publicApi.municipios });

  // So mostra no seletor os estados que tem municipio cadastrado
  const estados = useMemo(() => {
    const ufs = Array.from(new Set((data || []).map((m) => m.uf)));
    return ufs.sort((a, b) => nomeEstado(a).localeCompare(nomeEstado(b), "pt-BR"));
  }, [data]);

  // A API ja devolve em ordem de cadastro; aqui so filtra
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (data || []).filter((m) => (!uf || m.uf === uf) && (!termo || normalizar(m.nome).includes(termo)));
  }, [data, busca, uf]);

  const filtrando = Boolean(busca.trim() || uf);

  return (
    <section>
      <h1 className="text-2xl font-bold">Escolha o município</h1>
      <p className="mt-1 text-slate-600">Acompanhe as publicações da Prefeitura e da Câmara Municipal.</p>

      <div className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_16rem]">
        <div>
          <label htmlFor="busca-municipio" className="block text-sm font-medium">
            Nome do município
          </label>
          <input
            id="busca-municipio"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite o nome do município"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="filtro-estado" className="block text-sm font-medium">
            Estado
          </label>
          <select
            id="filtro-estado"
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">Todos os estados</option>
            {estados.map((sigla) => (
              <option key={sigla} value={sigla}>
                {nomeEstado(sigla)} ({sigla})
              </option>
            ))}
          </select>
        </div>
        {filtrando && (
          <button
            type="button"
            onClick={() => {
              setBusca("");
              setUf("");
            }}
            className="justify-self-start text-sm font-medium text-blue-700 hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="mt-6">
        {isLoading && <Carregando />}
        {error && <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />}
        {data && data.length === 0 && <Vazio texto="Nenhum município cadastrado ainda." />}
        {data && data.length > 0 && filtrados.length === 0 && <Vazio texto="Nenhum município encontrado com esses filtros." />}

        {filtrados.length > 0 && (
          <>
            <p className="mb-3 text-sm text-slate-500" aria-live="polite">
              {filtrados.length} município{filtrados.length > 1 ? "s" : ""}
            </p>
            {/* Um municipio por linha, ocupando a largura toda */}
            <ul className="flex flex-col gap-3">
              {filtrados.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/${m.slug}`}
                    className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-400 hover:shadow sm:p-4"
                  >
                    <Logo url={m.brasaoUrl} nome={m.nome} tamanho="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">{m.nome}</span>
                      <span className="text-sm text-slate-500">{nomeEstado(m.uf)}</span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white sm:px-4">
                      Acessar <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
