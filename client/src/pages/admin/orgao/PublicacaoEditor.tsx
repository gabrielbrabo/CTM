import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { abrirArquivoProtegido, mensagemErro } from "../../../api/http";
import { DadosPublicacao, Publicacao, orgaoApi } from "../../../api/orgao";
import { Carregando, Erro } from "../../../components/Estado";
import { Compartilhar } from "../../../components/Compartilhar";
import { BotoesImprimir, anexoImprimivel, urlImpressao } from "../../../components/Imprimir";
import CamposVereadores from "./CamposVereadores";
import ImportarArquivo, { TextoImportado } from "./ImportarArquivo";
import { AreaTexto, Botao, Campo, Secao, Selecao } from "../../../components/ui";
import { CamposDetalhes, OpcoesTipo, useTiposPublicacao } from "../../../lib/tiposPublicacao";
import {
  COR_ESTADO,
  NOME_ESTADO,
  NOME_EVENTO,
  formatarDataHora,
  formatarTamanho,
  paraInputData,
} from "../../../lib/formato";
import { useAvisos } from "../../../lib/avisos";

// Arquivos que podem aparecer no lugar do texto (imagem ou PDF escaneado)
const PODE_NO_CORPO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

type Msg = { tipo: "erro" | "sucesso"; texto: string } | null;

const formVazio: DadosPublicacao = {
  tipo: "",
  detalhes: {},
  titulo: "",
  numero: "",
  dataReferencia: "",
  resumo: "",
  conteudo: "",
  fonte: { nome: "", url: "" },
  confiabilidade: "oficial",
  autoresIds: [],
  relatorId: null,
  votos: [],
  presencas: [],
};

function paraForm(p: Publicacao): DadosPublicacao {
  return {
    tipo: p.tipo,
    detalhes: { ...(p.detalhes ?? {}) },
    titulo: p.titulo,
    numero: p.numero ?? "",
    dataReferencia: paraInputData(p.dataReferencia),
    resumo: p.resumo ?? "",
    conteudo: p.conteudo ?? "",
    fonte: { nome: p.fonte?.nome ?? "", url: p.fonte?.url ?? "" },
    confiabilidade: p.confiabilidade,
    autoresIds: [...(p.autoresIds ?? [])],
    relatorId: p.relatorId ?? null,
    votos: [...(p.votos ?? [])],
    presencas: [...(p.presencas ?? [])],
  };
}

// Caixa para acoes que exigem motivo (devolver, despublicar, corrigir, remover anexo)
function CaixaMotivo({
  titulo,
  botao,
  onConfirmar,
  onCancelar,
  ocupado,
}: {
  titulo: string;
  botao: string;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
  ocupado: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <AreaTexto label={titulo} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
      <div className="mt-2 flex gap-2">
        <Botao type="button" disabled={ocupado || motivo.trim().length < 3} onClick={() => onConfirmar(motivo.trim())}>
          {botao}
        </Botao>
        <Botao type="button" variante="secundario" onClick={onCancelar}>
          Cancelar
        </Botao>
      </div>
    </div>
  );
}

// Criar/editar publicacao + fluxo (revisao, publicar...) + anexos + historico
export default function PublicacaoEditor() {
  const { orgaoId = "", id } = useParams();
  const nova = !id;
  const api = orgaoApi(orgaoId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const tipos = useTiposPublicacao();
  // Tipo do orgao (camara/prefeitura) vem do painel
  const painel = useQuery({ queryKey: ["orgao", orgaoId, "painel"], queryFn: () => api.painel() });
  const tiposDoOrgao = painel.data ? tipos.doOrgao(painel.data.orgao.tipo) : [];

  const { data: pub, isLoading, error, refetch } = useQuery({
    queryKey: ["orgao", orgaoId, "publicacao", id],
    queryFn: () => api.publicacao(id!),
    enabled: !nova,
  });

  const [form, setForm] = useState<DadosPublicacao>(formVazio);
  const { avisar } = useAvisos();
  const setMsg = (m: Msg) => m && avisar(m.tipo, m.texto);
  // Qual acao com motivo esta aberta
  // Arquivo importado que sera anexado quando o rascunho for criado
  const [anexoPendente, setAnexoPendente] = useState<{ arquivo: File; noCorpo: boolean } | null>(null);
  // Marcar "mostrar no lugar do texto" ao adicionar um anexo
  const [novoNoCorpo, setNovoNoCorpo] = useState(false);
  const [pedindoMotivo, setPedindoMotivo] = useState<null | "salvar" | "devolver" | "despublicar" | { anexoId: string }>(null);

  // Preenche o formulario so quando a publicacao carrega (ou troca).
  // Depois disso o formulario e do usuario: enviar anexo ou publicar nao apaga o que ele digitou.
  const carregadaRef = useRef<string | null>(null);
  useEffect(() => {
    if (pub && carregadaRef.current !== pub.id) {
      carregadaRef.current = pub.id;
      setForm(paraForm(pub));
    }
  }, [pub]);

  const atualizarCache = (p: Publicacao) => {
    qc.setQueryData(["orgao", orgaoId, "publicacao", p.id], p);
    qc.invalidateQueries({ queryKey: ["orgao", orgaoId, "publicacoes"] });
    qc.invalidateQueries({ queryKey: ["orgao", orgaoId, "painel"] });
  };
  const falhou = (e: unknown) => setMsg({ tipo: "erro", texto: mensagemErro(e) });

  // Publicacao repetida: guarda o id da que ja existe para oferecer o link
  const [duplicada, setDuplicada] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: (motivo?: string) => (nova ? api.criar(form) : api.editar(id!, { ...form, motivo })),
    onSuccess: async (p) => {
      setPedindoMotivo(null);
      if (nova) {
        // Anexa o arquivo original que foi usado para extrair o texto
        if (anexoPendente) {
          try {
            await api.enviarAnexo(p.id, anexoPendente.arquivo, anexoPendente.noCorpo);
          } catch (e) {
            alert(`O rascunho foi criado, mas o anexo não foi enviado: ${mensagemErro(e)}`);
          }
        }
        qc.invalidateQueries({ queryKey: ["orgao", orgaoId] });
        navigate(`/admin/o/${orgaoId}/publicacoes/${p.id}`, { replace: true });
        return;
      }
      atualizarCache(p);
      setMsg({ tipo: "sucesso", texto: p.estado === "publicado" ? `Atualização de “${p.titulo}” publicada.` : `Alterações de “${p.titulo}” salvas.` });
      // Volta para a lista para ver a alteracao (a mais recente fica no topo)
      navigate(`/admin/o/${orgaoId}/publicacoes`);
      window.scrollTo(0, 0);
    },
    onError: (e) => {
      const existente = (e as { response?: { status?: number; data?: { existenteId?: string } } }).response;
      if (existente?.status === 409 && existente.data?.existenteId) setDuplicada(existente.data.existenteId);
      falhou(e);
    },
  });

  const acao = useMutation({
    mutationFn: ({ nome, motivo }: { nome: "enviar-revisao" | "publicar" | "devolver" | "despublicar"; motivo?: string }) =>
      api.acao(id!, nome, motivo),
    onSuccess: (p, { nome }) => {
      setPedindoMotivo(null);
      atualizarCache(p);
      // Depois de publicar, vai para a lista de publicadas para ver o resultado
      if (nome === "publicar") {
        const slugMunicipio = (qc.getQueryData(["orgao", orgaoId, "painel"]) as { municipio?: { slug: string } } | undefined)
          ?.municipio?.slug;
        avisar("sucesso", "Publicado! Já aparece no portal.");
        navigate(`/admin/o/${orgaoId}/publicacoes?estado=publicado`, {
          state: {
            publicada: {
              id: p.id,
              titulo: p.titulo,
              link: slugMunicipio ? `/${slugMunicipio}/p/${p.slug}` : null,
              temAnexos: p.anexos.some(anexoImprimivel),
            },
          },
        });
        window.scrollTo(0, 0);
        return;
      }
      const textos = {
        "enviar-revisao": "Enviado para revisão.",
        publicar: "Publicado! Já aparece no portal.",
        devolver: "Devolvido para correção.",
        despublicar: "Publicação retirada do portal.",
      };
      setMsg({ tipo: "sucesso", texto: textos[nome] });
      // Volta para a lista para ver a alteracao
      navigate(`/admin/o/${orgaoId}/publicacoes`);
      window.scrollTo(0, 0);
    },
    onError: falhou,
  });

  const excluir = useMutation({
    mutationFn: () => api.excluir(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgao", orgaoId] });
      navigate(`/admin/o/${orgaoId}/publicacoes`, { replace: true });
    },
    onError: falhou,
  });

  const anexar = useMutation({
    mutationFn: ({ arquivo, noCorpo = false }: { arquivo: File; noCorpo?: boolean }) => api.enviarAnexo(id!, arquivo, noCorpo),
    onSuccess: (p, { noCorpo }) => {
      atualizarCache(p);
      setMsg({ tipo: "sucesso", texto: noCorpo ? "Documento adicionado no lugar do texto." : "Anexo enviado." });
      if (arquivoRef.current) arquivoRef.current.value = "";
    },
    onError: falhou,
  });

  // Nomes dos arquivos que aparecem no lugar do texto
  const documentosNoCorpo = [
    ...(pub?.anexos.filter((a) => a.noCorpo).map((a) => a.nome) ?? []),
    ...(anexoPendente?.noCorpo ? [anexoPendente.arquivo.name] : []),
  ];

  const trocarNoCorpo = useMutation({
    mutationFn: ({ anexoId, noCorpo }: { anexoId: string; noCorpo: boolean }) => api.anexoNoCorpo(id!, anexoId, noCorpo),
    onSuccess: (p, { noCorpo }) => {
      atualizarCache(p);
      setMsg({ tipo: "sucesso", texto: noCorpo ? "O arquivo agora aparece no lugar do texto." : "O arquivo voltou a ser só um anexo." });
    },
    onError: falhou,
  });

  const removerAnexo = useMutation({
    mutationFn: ({ anexoId, motivo }: { anexoId: string; motivo?: string }) => api.removerAnexo(id!, anexoId, motivo),
    onSuccess: (p) => {
      setPedindoMotivo(null);
      atualizarCache(p);
      setMsg({ tipo: "sucesso", texto: "Anexo removido." });
    },
    onError: falhou,
  });

  if (!nova && isLoading) return <Carregando />;
  if (!nova && (error || !pub)) return <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />;

  const perm = pub?.permissoes;
  const podeEditar = nova || Boolean(perm?.editar);
  const publicada = pub?.estado === "publicado";
  const ocupado = salvar.isPending || acao.isPending || excluir.isPending;

  function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (publicada) setPedindoMotivo("salvar");
    else salvar.mutate(undefined);
  }

  const set = <K extends keyof DadosPublicacao>(campo: K, v: DadosPublicacao[K]) => setForm({ ...form, [campo]: v });
  const defTipo = tipos.porId(form.tipo);

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/admin/o/${orgaoId}/publicacoes`} className="text-sm text-slate-600 hover:underline">
          ← Publicações
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{nova ? "Nova publicação" : pub!.titulo}</h1>
          {pub && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_ESTADO[pub.estado]}`}>
              {NOME_ESTADO[pub.estado]}
            </span>
          )}
        </div>
        {pub?.publicadoEm && (
          <p className="text-sm text-slate-600">
            Publicado em {formatarDataHora(pub.publicadoEm)}
            {pub.corrigidoEm && ` · corrigido em ${formatarDataHora(pub.corrigidoEm)}`}
          </p>
        )}
      </div>

      {/* Acoes do fluxo editorial */}
      {pub && perm && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4">
          {perm.enviarRevisao && (
            <Botao disabled={ocupado} onClick={() => acao.mutate({ nome: "enviar-revisao" })}>
              Enviar para revisão
            </Botao>
          )}
          {perm.publicar && (
            <Botao
              disabled={ocupado}
              onClick={() => {
                // Materia votada (aprovada/rejeitada) sem a votacao dos vereadores: confirma antes
                const det = (pub.detalhes ?? {}) as Record<string, unknown>;
                const situacao = String(det.resultado ?? det.situacao ?? det.conclusao ?? "");
                const temVotacao = Boolean(tipos.porId(pub.tipo)?.vinculos?.votacao);
                if (temVotacao && pub.votos.length === 0 && /aprovad|rejeitad/i.test(situacao)) {
                  const ok = confirm(
                    `Esta matéria está como “${situacao}”, mas a votação dos vereadores não foi preenchida.\n\n` +
                      "Cancele para preencher a votação (seção Vereadores) ou OK para publicar assim mesmo."
                  );
                  if (!ok) return;
                }
                acao.mutate({ nome: "publicar" });
              }}
            >
              {pub.estado === "em_revisao" ? "Aprovar e publicar" : pub.estado === "despublicado" ? "Republicar" : "Publicar"}
            </Botao>
          )}
          {perm.devolver && (
            <Botao variante="secundario" disabled={ocupado} onClick={() => setPedindoMotivo("devolver")}>
              Devolver para correção
            </Botao>
          )}
          {publicada && (
            <a
              href={`/${(qc.getQueryData(["orgao", orgaoId, "painel"]) as { municipio?: { slug: string } } | undefined)?.municipio?.slug ?? ""}/p/${pub.slug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ver no portal
            </a>
          )}
          <BotoesImprimir
            onImprimir={(parte) =>
              abrirArquivoProtegido(urlImpressao(`/api/admin/o/${orgaoId}/publicacoes/${pub.id}/impressao.pdf`, parte)).catch(falhou)
            }
            temAnexos={pub.anexos.some(anexoImprimivel)}
          />
          {perm.despublicar && (
            <Botao variante="perigo" disabled={ocupado} onClick={() => setPedindoMotivo("despublicar")}>
              Despublicar
            </Botao>
          )}
          {perm.excluir && (
            <Botao
              variante="perigo"
              disabled={ocupado}
              onClick={() => {
                if (confirm("Excluir este rascunho? Não dá para desfazer.")) excluir.mutate();
              }}
            >
              Excluir rascunho
            </Botao>
          )}
          {!perm.publicar && !perm.enviarRevisao && pub.estado === "em_revisao" && (
            <p className="self-center text-sm text-slate-600">Aguardando um revisor ou administrador.</p>
          )}
          {/* Compartilhar somente a publicacao (link do portal) */}
          {publicada && (
            <div className="w-full border-t border-slate-100 pt-3">
              <Compartilhar
                titulo={pub.titulo}
                url={`${window.location.origin}/${(qc.getQueryData(["orgao", orgaoId, "painel"]) as { municipio?: { slug: string } } | undefined)?.municipio?.slug ?? ""}/p/${pub.slug}`}
              />
            </div>
          )}
        </div>
      )}

      {pedindoMotivo === "devolver" && (
        <CaixaMotivo
          titulo="O que precisa ser corrigido?"
          botao="Devolver"
          ocupado={acao.isPending}
          onCancelar={() => setPedindoMotivo(null)}
          onConfirmar={(motivo) => acao.mutate({ nome: "devolver", motivo })}
        />
      )}
      {pedindoMotivo === "despublicar" && (
        <CaixaMotivo
          titulo="Motivo para retirar do portal (fica registrado)"
          botao="Despublicar"
          ocupado={acao.isPending}
          onCancelar={() => setPedindoMotivo(null)}
          onConfirmar={(motivo) => acao.mutate({ nome: "despublicar", motivo })}
        />
      )}

      {podeEditar && (
        <ImportarArquivo
          orgaoId={orgaoId}
          temTexto={Boolean(form.conteudo?.trim())}
          onImportar={(r: TextoImportado) => {
            // Documento escaneado/imagem: vai no lugar do texto; o usuario so preenche titulo e dados
            if (r.comoDocumento) {
              setForm((f) => ({ ...f, titulo: f.titulo.trim() ? f.titulo : r.tituloSugerido }));
              if (nova) setAnexoPendente({ arquivo: r.arquivo, noCorpo: true });
              else anexar.mutate({ arquivo: r.arquivo, noCorpo: true });
              setMsg({
                tipo: "sucesso",
                texto: `${r.escaneado ? "Este PDF é escaneado (não tem texto). " : ""}“${r.arquivo.name}” será mostrado no lugar do texto${
                  nova ? " ao criar o rascunho" : ""
                }. Preencha o título e os outros dados.`,
              });
              return;
            }
            setForm((f) => ({
              ...f,
              titulo: f.titulo.trim() ? f.titulo : r.tituloSugerido,
              conteudo: r.modo === "adicionar" && f.conteudo ? `${f.conteudo}\n\n${r.texto}` : r.texto,
            }));
            if (r.anexarOriginal) {
              if (nova) setAnexoPendente({ arquivo: r.arquivo, noCorpo: false });
              else anexar.mutate({ arquivo: r.arquivo });
            }
            setMsg({
              tipo: "sucesso",
              texto: `Texto de “${r.arquivo.name}” colocado no formulário. Revise antes de salvar${
                r.anexarOriginal ? (nova ? "; o arquivo será anexado ao criar o rascunho" : "; arquivo anexado") : ""
              }.`,
            });
          }}
        />
      )}

      <form onSubmit={enviar} className="space-y-4">
        <fieldset disabled={!podeEditar} className="space-y-4">
          <Secao titulo="Conteúdo">
            <div className="grid gap-4 sm:grid-cols-3">
              <Selecao
                label="Tipo"
                required
                value={form.tipo}
                onChange={(e) => {
                  const novoTipo = e.target.value;
                  // Sessao, ata, audiencia: o local ja vem com o nome do plenario da Camara
                  const temLocal = tipos.porId(novoTipo)?.campos.some((c) => c.nome === "local");
                  const plenario = painel.data?.orgao.plenario;
                  setForm((f) => ({
                    ...f,
                    tipo: novoTipo,
                    detalhes: temLocal && plenario && !f.detalhes?.local ? { ...(f.detalhes ?? {}), local: plenario } : f.detalhes,
                  }));
                }}
              >
                <option value="">{tipos.carregando || painel.isLoading ? "Carregando..." : "Selecione o tipo"}</option>
                <OpcoesTipo tipos={tiposDoOrgao} />
              </Selecao>
              <Campo label="Número" placeholder="ex.: 012/2026" value={form.numero ?? ""} onChange={(e) => set("numero", e.target.value)} />
              <Campo
                label="Data do documento/fato"
                type="date"
                value={form.dataReferencia ?? ""}
                onChange={(e) => set("dataReferencia", e.target.value)}
              />
              <Campo
                label="Título"
                required
                maxLength={250}
                className="sm:col-span-3"
                value={form.titulo}
                onChange={(e) => set("titulo", e.target.value)}
              />
              <AreaTexto
                label="Resumo em linguagem simples (aparece na lista do portal)"
                className="sm:col-span-3"
                maxLength={1000}
                value={form.resumo ?? ""}
                onChange={(e) => set("resumo", e.target.value)}
              />
              <div className="sm:col-span-3">
                {/* Aviso: ha documento/imagem no lugar do texto */}
                {documentosNoCorpo.length > 0 && (
                  <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    <p>
                      <strong>No lugar do texto:</strong> {documentosNoCorpo.join(", ")}. No portal o documento aparece como está.
                      O texto abaixo é opcional.
                    </p>
                  </div>
                )}
                <label htmlFor="conteudo" className="block text-sm font-medium text-slate-700">
                  Texto completo{documentosNoCorpo.length > 0 && <span className="font-normal text-slate-500"> (opcional)</span>}
                </label>
                <textarea
                  id="conteudo"
                  rows={12}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={form.conteudo ?? ""}
                  onChange={(e) => set("conteudo", e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">As quebras de linha são mantidas no portal.</p>
              </div>
            </div>
          </Secao>

          {defTipo && defTipo.campos.length > 0 && (
            <Secao titulo={`Dados específicos — ${defTipo.nome}`}>
              <p className="-mt-2 mb-4 text-sm text-slate-600">{defTipo.descricao}</p>
              <CamposDetalhes def={defTipo} valor={form.detalhes ?? {}} onChange={(d) => set("detalhes", d)} />
            </Secao>
          )}

          {/* Vereadores: autores, relator, votacao nominal, presenca (Camara) */}
          {defTipo?.vinculos && (
            <CamposVereadores
              orgaoId={orgaoId}
              def={defTipo}
              desabilitado={!podeEditar}
              valor={{
                autoresIds: form.autoresIds ?? [],
                relatorId: form.relatorId ?? null,
                votos: form.votos ?? [],
                presencas: form.presencas ?? [],
              }}
              onChange={(v) => setForm((f) => ({ ...f, ...v }))}
            />
          )}

          <Secao titulo="Fonte e confiabilidade">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                label="Fonte oficial (nome)"
                placeholder="ex.: Diário Oficial do Município"
                value={form.fonte?.nome ?? ""}
                onChange={(e) => set("fonte", { ...form.fonte, nome: e.target.value })}
              />
              <Campo
                label="Link da fonte oficial"
                type="url"
                placeholder="https://"
                value={form.fonte?.url ?? ""}
                onChange={(e) => set("fonte", { ...form.fonte, url: e.target.value })}
              />
              <Selecao
                label="Situação da informação"
                value={form.confiabilidade}
                onChange={(e) => set("confiabilidade", e.target.value as DadosPublicacao["confiabilidade"])}
              >
                <option value="oficial">Oficial</option>
                <option value="pendente_confirmacao">Pendente de confirmação (aparece um aviso)</option>
              </Selecao>
            </div>
          </Secao>
        </fieldset>

        {duplicada && (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              <strong>Esta publicação já existe.</strong> Para mudar a situação (ex.: de “em pauta” para “aprovado”) ou lançar a votação,
              edite a publicação existente — assim a população vê tudo no mesmo lugar.
            </p>
            <Link
              to={`/admin/o/${orgaoId}/publicacoes/${duplicada}`}
              onClick={() => setDuplicada(null)}
              className="mt-2 inline-block rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
            >
              Abrir a publicação existente →
            </Link>
          </div>
        )}

        {pedindoMotivo === "salvar" ? (
          <CaixaMotivo
            titulo="Esta publicação já está no portal. Descreva o que mudou (ex.: “Aprovado na sessão de 20/10” ou “Correção do número”). Fica visível para o cidadão:"
            botao="Publicar atualização"
            ocupado={salvar.isPending}
            onCancelar={() => setPedindoMotivo(null)}
            onConfirmar={(motivo) => salvar.mutate(motivo)}
          />
        ) : (
          podeEditar && (
            <Botao type="submit" disabled={ocupado}>
              {salvar.isPending ? "Salvando..." : nova ? "Criar rascunho" : publicada ? "Salvar atualização..." : "Salvar"}
            </Botao>
          )
        )}
      </form>

      {pub && (
        <Secao titulo={`Anexos (${pub.anexos.length})`}>
          {pub.anexos.length === 0 && <p className="text-sm text-slate-500">Nenhum anexo.</p>}
          <ul className="divide-y divide-slate-100">
            {pub.anexos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <button
                  type="button"
                  className="text-left font-medium text-blue-700 hover:underline"
                  onClick={() => abrirArquivoProtegido(a.url).catch(falhou)}
                >
                  {a.nome}
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  {PODE_NO_CORPO.includes(a.mime) && (
                    <label className="flex items-center gap-1.5 text-slate-700" title="Mostra o arquivo no portal no lugar do texto">
                      <input
                        type="checkbox"
                        checked={Boolean(a.noCorpo)}
                        disabled={!podeEditar || trocarNoCorpo.isPending}
                        onChange={(e) => trocarNoCorpo.mutate({ anexoId: a.id, noCorpo: e.target.checked })}
                      />
                      No lugar do texto
                    </label>
                  )}
                  <span className="text-slate-500">{formatarTamanho(a.tamanho)}</span>
                  {podeEditar && (
                    <button
                      type="button"
                      className="text-red-700 hover:underline"
                      disabled={removerAnexo.isPending}
                      onClick={() => {
                        if (publicada) setPedindoMotivo({ anexoId: a.id });
                        else if (confirm(`Remover o anexo "${a.nome}"?`)) removerAnexo.mutate({ anexoId: a.id });
                      }}
                    >
                      Remover
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {typeof pedindoMotivo === "object" && pedindoMotivo !== null && (
            <div className="mt-3">
              <CaixaMotivo
                titulo="Motivo para remover o anexo de uma publicação já publicada"
                botao="Remover anexo"
                ocupado={removerAnexo.isPending}
                onCancelar={() => setPedindoMotivo(null)}
                onConfirmar={(motivo) => removerAnexo.mutate({ anexoId: pedindoMotivo.anexoId, motivo })}
              />
            </div>
          )}
          {podeEditar && (
            <div className="mt-4">
              <label htmlFor="arquivo" className="block text-sm font-medium text-slate-700">
                Adicionar anexo
              </label>
              <input
                id="arquivo"
                ref={arquivoRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.odt,.ods,.csv,.txt"
                disabled={anexar.isPending}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) {
                    setMsg(null);
                    anexar.mutate({ arquivo, noCorpo: novoNoCorpo && PODE_NO_CORPO.includes(arquivo.type) });
                  }
                }}
                className="mt-1 block text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                {anexar.isPending ? "Enviando..." : "PDF, imagem, Word, Excel, ODT, CSV ou TXT — até 20 MB."}
              </p>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={novoNoCorpo} onChange={(e) => setNovoNoCorpo(e.target.checked)} />
                Mostrar no lugar do texto (imagem ou PDF escaneado)
              </label>
            </div>
          )}
        </Secao>
      )}

      {nova && (
        <p className="text-sm text-slate-500">
          {anexoPendente
            ? anexoPendente.noCorpo
              ? `O documento “${anexoPendente.arquivo.name}” será mostrado no lugar do texto ao criar o rascunho.`
              : `O arquivo “${anexoPendente.arquivo.name}” será anexado ao criar o rascunho.`
            : "Depois de criar o rascunho você poderá anexar arquivos."}
        </p>
      )}

      {pub && (
        <Secao titulo="Histórico">
          <ol className="space-y-2 text-sm">
            {[...pub.historico].reverse().map((h, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="text-slate-500">{formatarDataHora(h.data)}</span>
                <span className="font-medium">{NOME_EVENTO[h.evento] ?? h.evento}</span>
                {h.usuarioNome && <span className="text-slate-600">por {h.usuarioNome}</span>}
                {h.motivo && <span className="w-full text-slate-600">“{h.motivo}”</span>}
              </li>
            ))}
          </ol>
        </Secao>
      )}
    </div>
  );
}
