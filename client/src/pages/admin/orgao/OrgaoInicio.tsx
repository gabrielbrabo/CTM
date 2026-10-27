import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { mensagemErro } from "../../../api/http";
import { ContatosOrgaoPainel, orgaoApi } from "../../../api/orgao";
import { Carregando, Erro } from "../../../components/Estado";
import { Aviso, Botao, Campo, SeloSituacao, Secao } from "../../../components/ui";
import { useAvisos } from "../../../lib/avisos";
import { NOME_PAPEL } from "../../../lib/formato";
import { EditorLogo, Logo } from "../../../components/Logo";

// Nome do plenario da Camara (aparece no portal e preenche o local das sessoes)
function CampoPlenario({ atual, desabilitado, onSalvar }: { atual: string; desabilitado: boolean; onSalvar: (v: string) => Promise<unknown> }) {
  const [valor, setValor] = useState(atual);
  const { avisar } = useAvisos();
  useEffect(() => setValor(atual), [atual]);
  return (
    <form
      className="mt-5 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSalvar(valor.trim());
        avisar("sucesso", valor.trim() ? "Nome do plenário salvo." : "Nome do plenário removido.");
      }}
    >
      <div className="min-w-[16rem] flex-1">
        <Campo
          label="Nome do plenário"
          placeholder="ex.: Plenário Vereador José da Silva"
          dica="Aparece no portal e já preenche o local das sessões e audiências."
          value={valor}
          disabled={desabilitado}
          onChange={(e) => setValor(e.target.value)}
        />
      </div>
      <Botao type="submit" disabled={desabilitado || valor.trim() === atual}>
        Salvar
      </Botao>
    </form>
  );
}

// Contato do orgao para a populacao (aparece no portal em "Fale com...")
function ContatoParaPopulacao({
  atual,
  recebe,
  desabilitado,
  onSalvar,
}: {
  atual: ContatosOrgaoPainel;
  recebe: boolean;
  desabilitado: boolean;
  onSalvar: (d: { contatos: ContatosOrgaoPainel; recebeMensagens: boolean }) => Promise<unknown>;
}) {
  const [c, setC] = useState<ContatosOrgaoPainel>(atual);
  const [recebeMensagens, setRecebe] = useState(recebe);
  const { avisar } = useAvisos();
  const set = (k: keyof ContatosOrgaoPainel) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value });
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onSalvar({ contatos: c, recebeMensagens });
          avisar("sucesso", "Contato para a população salvo.");
        } catch (err) {
          avisar("erro", mensagemErro(err));
        }
      }}
    >
      <p className="text-sm text-slate-600">Aparece no portal, na página do órgão, em “Fale com...”.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Telefone" value={c.telefone ?? ""} disabled={desabilitado} onChange={set("telefone")} />
        <Campo label="WhatsApp" value={c.whatsapp ?? ""} placeholder="(38) 99999-0000" disabled={desabilitado} onChange={set("whatsapp")} />
        <Campo label="E-mail" type="email" value={c.email ?? ""} disabled={desabilitado} onChange={set("email")} />
        <Campo label="Site" value={c.site ?? ""} placeholder="https://" disabled={desabilitado} onChange={set("site")} />
        <Campo label="Endereço" className="sm:col-span-2" value={c.endereco ?? ""} disabled={desabilitado} onChange={set("endereco")} />
        <Campo
          label="Horário de atendimento"
          className="sm:col-span-2"
          placeholder="Segunda a sexta, das 8h às 17h"
          value={c.horario ?? ""}
          disabled={desabilitado}
          onChange={set("horario")}
        />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={recebeMensagens} disabled={desabilitado} onChange={(e) => setRecebe(e.target.checked)} />
        <span>
          <span className="font-medium">Receber mensagens da população pelo portal</span>
          <span className="block text-slate-600">O cidadão precisa ter conta no portal para enviar; as mensagens chegam no menu “Mensagens”.</span>
        </span>
      </label>
      <Botao type="submit" disabled={desabilitado}>
        Salvar contato
      </Botao>
    </form>
  );
}

// Pagina inicial do painel do orgao: resumo + configuracoes
export default function OrgaoInicio() {
  const { orgaoId = "" } = useParams();
  const api = orgaoApi(orgaoId);
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["orgao", orgaoId, "painel"], queryFn: api.painel });
  const [erro, setErro] = useState<string | null>(null);

  const config = useMutation({
    mutationFn: api.config,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orgao", orgaoId] }),
    onError: (e) => setErro(mensagemErro(e)),
  });

  if (isLoading) return <Carregando />;
  if (error || !data) return <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />;

  const { orgao, municipio, papel, publicacoes } = data;
  const base = `/admin/o/${orgaoId}/publicacoes`;
  const cartoes = [
    { rotulo: "Rascunhos", valor: publicacoes.rascunho, estado: "rascunho" },
    { rotulo: "Em revisão", valor: publicacoes.em_revisao, estado: "em_revisao" },
    { rotulo: "Publicadas", valor: publicacoes.publicado, estado: "publicado" },
    { rotulo: "Despublicadas", valor: publicacoes.despublicado, estado: "despublicado" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Logo url={orgao.logoUrl} nome={orgao.nome} tamanho="md" />
          <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{orgao.nome}</h1>
            <SeloSituacao situacao={orgao.situacao} />
          </div>
          <p className="text-sm text-slate-600">
            {municipio.nome}/{municipio.uf} · Você é {papel ? NOME_PAPEL[papel] : "—"} ·{" "}
            <a href={`/${municipio.slug}/${orgao.tipo}`} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
              ver no portal
            </a>
          </p>
          </div>
        </div>
        {orgao.situacao === "ativo" && (
          <Link to={`${base}/nova`} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
            + Nova publicação
          </Link>
        )}
      </div>

      {orgao.situacao !== "ativo" && (
        <Aviso tipo="erro">
          Este órgão está {orgao.situacao === "suspenso" ? "suspenso" : "encerrado"}: as publicações não aparecem no portal e
          o painel está somente para consulta. Fale com a GADZ.
        </Aviso>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cartoes.map((c) => (
          <Link
            key={c.estado}
            to={`${base}?estado=${c.estado}`}
            className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-400"
          >
            <p className="text-sm text-slate-600">{c.rotulo}</p>
            <p className="mt-1 text-3xl font-bold">{c.valor}</p>
          </Link>
        ))}
      </div>

      {papel === "admin_orgao" && (
        <Secao titulo="Logo do órgão (aparece no portal)">
          <EditorLogo
            url={orgao.logoUrl}
            nome={orgao.nome}
            onEnviar={async (arquivo) => {
              await api.enviarLogo(arquivo);
              qc.invalidateQueries({ queryKey: ["orgao", orgaoId] });
            }}
            onRemover={async () => {
              await api.removerLogo();
              qc.invalidateQueries({ queryKey: ["orgao", orgaoId] });
            }}
          />
        </Secao>
      )}

      {papel === "admin_orgao" && (
        <Secao titulo="Contato para a população">
          <ContatoParaPopulacao
            atual={orgao.contatos ?? {}}
            recebe={orgao.recebeMensagens}
            desabilitado={config.isPending || orgao.situacao !== "ativo"}
            onSalvar={(d) => config.mutateAsync(d)}
          />
        </Secao>
      )}

      {papel === "admin_orgao" && (
        <Secao titulo="Configurações do órgão">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={orgao.exigeRevisao}
              disabled={config.isPending || orgao.situacao !== "ativo"}
              onChange={(e) => config.mutate({ exigeRevisao: e.target.checked })}
            />
            <span>
              <span className="font-medium">Exigir revisão antes de publicar</span>
              <span className="block text-sm text-slate-600">
                Ligado: o editor envia para revisão e só um revisor ou administrador publica. Desligado: o editor publica direto.
              </span>
            </span>
          </label>
          {orgao.tipo === "camara" && (
            <CampoPlenario
              atual={orgao.plenario ?? ""}
              desabilitado={config.isPending || orgao.situacao !== "ativo"}
              onSalvar={(plenario) => config.mutateAsync({ plenario })}
            />
          )}
          {erro && (
            <div className="mt-3">
              <Aviso tipo="erro">{erro}</Aviso>
            </div>
          )}
        </Secao>
      )}
    </div>
  );
}
