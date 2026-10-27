import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { mensagemErro } from "../../../api/http";
import { DadosVereador, Vereador, orgaoApi } from "../../../api/orgao";
import { Carregando, Erro, Vazio } from "../../../components/Estado";
import { FotoRetrato, FotoVereador } from "../../../components/FotoVereador";
import { EditorLogo } from "../../../components/Logo";
import { AreaTexto, Botao, Campo, Selecao } from "../../../components/ui";
import { useAvisos } from "../../../lib/avisos";
import { paraInputData } from "../../../lib/formato";
import { NOME_CARGO_MESA, NOME_SITUACAO_VEREADOR, nomeVereador } from "../../../lib/vereadores";

const formVazio: DadosVereador = {
  nome: "",
  nomeParlamentar: "",
  partido: "",
  cargoMesa: "vereador",
  situacao: "exercicio",
  legislatura: "",
  mandatoInicio: "",
  mandatoFim: "",
  email: "",
  telefone: "",
  gabinete: "",
  redeSocial: "",
  biografia: "",
  ordem: 0,
  mostrarNoPortal: true,
};

function paraForm(v: Vereador): DadosVereador {
  return {
    nome: v.nome,
    nomeParlamentar: v.nomeParlamentar ?? "",
    partido: v.partido ?? "",
    cargoMesa: v.cargoMesa,
    situacao: v.situacao,
    legislatura: v.legislatura ?? "",
    mandatoInicio: paraInputData(v.mandatoInicio),
    mandatoFim: paraInputData(v.mandatoFim),
    email: v.email ?? "",
    telefone: v.telefone ?? "",
    gabinete: v.gabinete ?? "",
    redeSocial: v.redeSocial ?? "",
    biografia: v.biografia ?? "",
    ordem: v.ordem ?? 0,
    mostrarNoPortal: v.mostrarNoPortal,
  };
}

/**
 * Janela para cadastrar ou editar um vereador.
 * vereador = null -> novo cadastro. Depois de salvar o novo, ja permite enviar a foto.
 */
function JanelaVereador({ orgaoId, vereador, onFechar }: { orgaoId: string; vereador: Vereador | null; onFechar: () => void }) {
  const api = orgaoApi(orgaoId);
  const qc = useQueryClient();
  const { avisar } = useAvisos();
  const [atual, setAtual] = useState<Vereador | null>(vereador);
  const [form, setForm] = useState<DadosVereador>(vereador ? paraForm(vereador) : formVazio);
  const set = <K extends keyof DadosVereador>(k: K, v: DadosVereador[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  const atualizarLista = () => qc.invalidateQueries({ queryKey: ["orgao", orgaoId, "vereadores"] });

  const salvar = useMutation({
    mutationFn: () => (atual ? api.editarVereador(atual.id, form) : api.criarVereador(form)),
    onSuccess: (v) => {
      const novo = !atual;
      setAtual(v);
      atualizarLista();
      avisar("sucesso", novo ? `${nomeVereador(v)} cadastrado(a). Agora você pode enviar a foto.` : `Dados de ${nomeVereador(v)} salvos.`);
      if (!novo) onFechar(); // volta para a lista para ver a alteracao
    },
    onError: (e) => avisar("erro", mensagemErro(e)),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    salvar.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4"
    >
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-vereador" className="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-200 p-4">
          <FotoVereador url={atual?.fotoUrl} nome={form.nome || "Novo"} tamanho="md" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{atual ? "Editando vereador(a)" : "Novo vereador(a)"}</p>
            <h2 id="titulo-vereador" className="truncate text-lg font-bold">
              {form.nomeParlamentar || form.nome || "Cadastro"}
            </h2>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <div className="space-y-6 p-4">
          {/* Foto (so depois de cadastrar) */}
          <section>
            <h3 className="mb-2 font-semibold">Foto</h3>
            {atual ? (
              <EditorLogo
                url={atual.fotoUrl}
                nome={nomeVereador(atual)}
                oQue="foto"
                dica="Foto de rosto, de preferência em pé (retrato). PNG, JPG ou WEBP até 2 MB."
                onEnviar={async (arquivo) => {
                  setAtual(await api.enviarFotoVereador(atual.id, arquivo));
                  atualizarLista();
                  avisar("sucesso", "Foto atualizada.");
                }}
                onRemover={async () => {
                  setAtual(await api.removerFotoVereador(atual.id));
                  atualizarLista();
                  avisar("sucesso", "Foto removida.");
                }}
              />
            ) : (
              <p className="text-sm text-slate-500">Salve o cadastro primeiro; depois envie a foto aqui mesmo.</p>
            )}
          </section>

          <form id="form-vereador" onSubmit={enviar} className="space-y-4">
            <h3 className="font-semibold">Dados</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nome completo" required value={form.nome} onChange={(e) => set("nome", e.target.value)} />
              <Campo
                label="Nome parlamentar"
                dica="Como é conhecido(a). Aparece no portal."
                value={form.nomeParlamentar ?? ""}
                onChange={(e) => set("nomeParlamentar", e.target.value)}
              />
              <Campo label="Partido (sigla)" value={form.partido ?? ""} onChange={(e) => set("partido", e.target.value.toUpperCase())} />
              <Selecao label="Cargo na Mesa Diretora" value={form.cargoMesa} onChange={(e) => set("cargoMesa", e.target.value as DadosVereador["cargoMesa"])}>
                {Object.entries(NOME_CARGO_MESA).map(([v, n]) => (
                  <option key={v} value={v}>
                    {v === "vereador" ? "Não faz parte da Mesa" : n}
                  </option>
                ))}
              </Selecao>
              <Selecao label="Situação" value={form.situacao} onChange={(e) => set("situacao", e.target.value as DadosVereador["situacao"])}>
                {Object.entries(NOME_SITUACAO_VEREADOR).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </Selecao>
              <Campo label="Legislatura" placeholder="ex.: 2025-2028" value={form.legislatura ?? ""} onChange={(e) => set("legislatura", e.target.value)} />
              <Campo label="Início do mandato" type="date" value={form.mandatoInicio ?? ""} onChange={(e) => set("mandatoInicio", e.target.value)} />
              <Campo label="Fim do mandato" type="date" value={form.mandatoFim ?? ""} onChange={(e) => set("mandatoFim", e.target.value)} />
            </div>

            <h3 className="pt-2 font-semibold">Contato (público)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="E-mail" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              <Campo label="Telefone" value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
              <Campo label="Gabinete" placeholder="ex.: Sala 3 — 1º andar" value={form.gabinete ?? ""} onChange={(e) => set("gabinete", e.target.value)} />
              <Campo label="Rede social / site" placeholder="https://" value={form.redeSocial ?? ""} onChange={(e) => set("redeSocial", e.target.value)} />
            </div>
            <AreaTexto label="Biografia" rows={5} value={form.biografia ?? ""} onChange={(e) => set("biografia", e.target.value)} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                label="Ordem na lista"
                type="number"
                min={0}
                dica="Menor aparece primeiro (depois da Mesa)."
                value={String(form.ordem ?? 0)}
                onChange={(e) => set("ordem", Number(e.target.value))}
              />
              <label className="flex items-center gap-2 self-center text-sm">
                <input type="checkbox" checked={form.mostrarNoPortal !== false} onChange={(e) => set("mostrarNoPortal", e.target.checked)} />
                Mostrar no portal
              </label>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <Botao variante="secundario" onClick={onFechar}>
            {atual ? "Concluir" : "Cancelar"}
          </Botao>
          <Botao type="submit" form="form-vereador" disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : atual ? "Salvar dados" : "Cadastrar"}
          </Botao>
        </div>
      </div>
    </div>
  );
}

// Cadastro de vereadores da Camara (para o portal e para ligar nas publicacoes)
export default function VereadoresOrgao() {
  const { orgaoId = "" } = useParams();
  const api = orgaoApi(orgaoId);
  const qc = useQueryClient();
  const { avisar } = useAvisos();
  const painel = useQuery({ queryKey: ["orgao", orgaoId, "painel"], queryFn: () => api.painel() });
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["orgao", orgaoId, "vereadores"], queryFn: () => api.vereadores() });
  // undefined = fechada; null = novo; Vereador = editando
  const [aberto, setAberto] = useState<Vereador | null | undefined>(undefined);
  const ehAdmin = painel.data?.papel === "admin_orgao";

  const excluir = useMutation({
    mutationFn: (v: Vereador) => api.excluirVereador(v.id),
    onSuccess: () => {
      avisar("sucesso", "Vereador(a) excluído(a).");
      qc.invalidateQueries({ queryKey: ["orgao", orgaoId, "vereadores"] });
    },
    onError: (e) => avisar("erro", mensagemErro(e)),
  });

  if (painel.data && painel.data.orgao.tipo !== "camara") return <Vazio texto="O cadastro de vereadores é só da Câmara." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vereadores</h1>
          <p className="text-sm text-slate-600">
            Aparecem no portal para a população e podem ser escolhidos como autores, relator, votos e presença nas publicações.
            Eles não acessam o sistema.
          </p>
        </div>
        {ehAdmin && <Botao onClick={() => setAberto(null)}>+ Novo vereador(a)</Botao>}
      </div>

      {isLoading && <Carregando />}
      {error && <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />}
      {data && data.length === 0 && <Vazio texto="Nenhum vereador cadastrado ainda." />}
      {data && data.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((v) => (
            <li key={v.id} className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white ${v.situacao === "ex" ? "opacity-70" : ""}`}>
              <FotoRetrato url={v.fotoUrl} nome={nomeVereador(v)} />
              <div className="flex flex-1 flex-col p-3 text-center">
                <p className="font-semibold leading-snug">{nomeVereador(v)}</p>
                <p className="text-sm text-slate-600">
                  {v.partido ?? "Sem partido"}
                  {v.cargoMesa !== "vereador" && ` · ${NOME_CARGO_MESA[v.cargoMesa]}`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {NOME_SITUACAO_VEREADOR[v.situacao]}
                  {!v.mostrarNoPortal && " · oculto no portal"}
                </p>
                {ehAdmin && (
                  <div className="mt-auto flex justify-center gap-2 pt-3">
                    <Botao variante="secundario" className="px-3 py-1.5" onClick={() => setAberto(v)} aria-label={`Editar ${nomeVereador(v)}`}>
                      Editar
                    </Botao>
                    <button
                      type="button"
                      className="px-2 text-sm text-red-700 hover:underline"
                      disabled={excluir.isPending}
                      onClick={() => confirm(`Excluir ${nomeVereador(v)}?`) && excluir.mutate(v)}
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {aberto !== undefined && (
        <JanelaVereador key={aberto?.id ?? "novo"} orgaoId={orgaoId} vereador={aberto} onFechar={() => setAberto(undefined)} />
      )}
    </div>
  );
}
