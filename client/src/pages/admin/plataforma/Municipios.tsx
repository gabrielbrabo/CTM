import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { mensagemErro } from "../../../api/http";
import { MunicipioPlataforma, platformApi } from "../../../api/platform";
import { Carregando, Erro, Vazio } from "../../../components/Estado";
import { EditorLogo, Logo } from "../../../components/Logo";
import { Botao, Campo, SeloSituacao, Selecao } from "../../../components/ui";
import { ESTADOS, nomeEstado } from "../../../lib/estados";
import { NOME_TIPO } from "../../../lib/formato";
import { useAvisos } from "../../../lib/avisos";

/**
 * Janela de edicao de UM municipio.
 * Mostra sempre o nome e o brasao do municipio que esta sendo editado,
 * para nao haver duvida de qual e.
 */
function EditarMunicipio({ m, onFechar }: { m: MunicipioPlataforma; onFechar: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: m.nome, uf: m.uf });
  const { avisar } = useAvisos();
  const setAviso = (m: { tipo: "erro" | "sucesso"; texto: string } | null) => m && avisar(m.tipo, m.texto);

  // Fecha com a tecla Esc
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  const atualizarLista = () => qc.invalidateQueries({ queryKey: ["plataforma"] });

  const salvar = useMutation({
    mutationFn: (d: { nome?: string; uf?: string; ativo?: boolean }) => platformApi.editarMunicipio(m.id, d),
    onSuccess: () => {
      setAviso({ tipo: "sucesso", texto: `Alterações de ${m.nome} salvas.` });
      atualizarLista();
      onFechar(); // volta para a lista para ver a alteracao
    },
    onError: (e) => setAviso({ tipo: "erro", texto: mensagemErro(e) }),
  });

  const mudou = form.nome.trim() !== m.nome || form.uf !== m.uf;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
    >
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-editar-municipio" className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* Cabecalho: qual municipio esta sendo editado */}
        <div className="flex items-center gap-3 border-b border-slate-200 p-4">
          <Logo url={m.brasaoUrl} nome={m.nome} tamanho="md" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Editando município</p>
            <h2 id="titulo-editar-municipio" className="truncate text-lg font-bold">
              {m.nome} / {m.uf}
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 p-4">

          {/* 1. Brasao */}
          <section>
            <h3 className="mb-2 font-semibold">Brasão / logo</h3>
            <EditorLogo
              url={m.brasaoUrl}
              nome={m.nome}
              dica="Aparece na lista de municípios do portal. PNG, JPG ou WEBP até 2 MB."
              onEnviar={async (arquivo) => {
                await platformApi.enviarBrasao(m.id, arquivo);
                setAviso({ tipo: "sucesso", texto: `Brasão de ${m.nome} atualizado.` });
                await atualizarLista();
              }}
              onRemover={async () => {
                await platformApi.removerBrasao(m.id);
                setAviso({ tipo: "sucesso", texto: `Brasão de ${m.nome} removido.` });
                await atualizarLista();
              }}
            />
          </section>

          {/* 2. Dados */}
          <section>
            <h3 className="mb-2 font-semibold">Dados</h3>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                salvar.mutate({ nome: form.nome.trim(), uf: form.uf });
              }}
            >
              <Campo label="Nome do município" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <Selecao label="Estado" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })}>
                {Object.entries(ESTADOS).map(([uf, nome]) => (
                  <option key={uf} value={uf}>
                    {nome} ({uf})
                  </option>
                ))}
              </Selecao>
              <p className="text-xs text-slate-500">Endereço no portal: /{m.slug}</p>
              <Botao type="submit" disabled={salvar.isPending || !mudou}>
                {salvar.isPending ? "Salvando..." : "Salvar dados"}
              </Botao>
            </form>
          </section>

          {/* 3. Visibilidade */}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
            <div>
              <h3 className="font-semibold">Visível no portal</h3>
              <p className="text-sm text-slate-600">{m.ativo ? "Sim, os cidadãos encontram este município." : "Não, está oculto do portal."}</p>
            </div>
            <Botao variante="secundario" disabled={salvar.isPending} onClick={() => salvar.mutate({ ativo: !m.ativo })}>
              {m.ativo ? "Ocultar do portal" : "Mostrar no portal"}
            </Botao>
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-200 p-4">
          <Botao variante="secundario" onClick={onFechar}>
            Concluir
          </Botao>
        </div>
      </div>
    </div>
  );
}

// Municipios: em geral sao criados junto com o primeiro orgao; aqui da para corrigir nome/UF e brasao
export default function Municipios() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["plataforma", "municipios"],
    queryFn: platformApi.municipios,
  });
  // Guarda so o ID do municipio aberto; os dados vem sempre da lista atualizada
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const aberto = data?.find((m) => m.id === abertoId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Municípios</h1>
          <p className="text-sm text-slate-600">
            O município aparece no portal quando tem pelo menos um órgão ativo. Para cadastrar, use “Novo órgão”.
          </p>
        </div>
        <Link to="/admin/orgaos/novo" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
          + Novo órgão
        </Link>
      </div>

      {isLoading && <Carregando />}
      {error && <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />}
      {data && data.length === 0 && <Vazio texto="Nenhum município cadastrado." />}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((m) => (
            <li key={m.id} data-municipio={m.slug} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <Logo url={m.brasaoUrl} nome={m.nome} tamanho="md" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {m.nome} <span className="font-normal text-slate-500">— {nomeEstado(m.uf)}</span>{" "}
                  {!m.ativo && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">Oculto</span>}
                </p>
                <p className="text-xs text-slate-500">Endereço no portal: /{m.slug}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-sm">
                  {m.orgaos.length === 0 && <span className="text-slate-500">Nenhum órgão</span>}
                  {m.orgaos.map((o) => (
                    <Link key={o.id} to={`/admin/orgaos/${o.id}`} className="flex items-center gap-1 text-blue-700 hover:underline">
                      {NOME_TIPO[o.tipo] ?? o.tipo} <SeloSituacao situacao={o.situacao} />
                    </Link>
                  ))}
                </div>
              </div>
              <Botao onClick={() => setAbertoId(m.id)} aria-label={`Editar ${m.nome}`}>
                Editar
              </Botao>
            </li>
          ))}
        </ul>
      )}

      {/* key: ao trocar de municipio, a janela comeca do zero */}
      {aberto && <EditarMunicipio key={aberto.id} m={aberto} onFechar={() => setAbertoId(null)} />}
    </div>
  );
}
