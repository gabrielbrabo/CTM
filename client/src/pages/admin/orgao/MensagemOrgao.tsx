import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mensagemErro } from "../../../api/http";
import { orgaoApi } from "../../../api/orgao";
import { Conversa } from "../../../components/Conversa";
import { Carregando, Erro } from "../../../components/Estado";
import { BotaoVoltar } from "../../../components/Logo";
import { AreaTexto, Botao } from "../../../components/ui";
import { useAvisos } from "../../../lib/avisos";
import { COR_SITUACAO_MSG, NOME_SITUACAO_MSG } from "../../cidadao/MinhaContaPage";

// Conversa com o cidadao: ler, responder, encerrar ou reabrir
export default function MensagemOrgaoPage() {
  const { orgaoId = "", id = "" } = useParams();
  const api = orgaoApi(orgaoId);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { avisar } = useAvisos();
  const [texto, setTexto] = useState("");
  const q = useQuery({ queryKey: ["orgao", orgaoId, "mensagem", id], queryFn: () => api.mensagem(id) });

  // Abriu: atualiza contadores (menu e sininho)
  useEffect(() => {
    if (q.data) {
      qc.invalidateQueries({ queryKey: ["orgao", orgaoId, "painel"] });
      qc.invalidateQueries({ queryKey: ["avisos"] });
    }
  }, [q.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["orgao", orgaoId, "mensagens"] });
    qc.invalidateQueries({ queryKey: ["orgao", orgaoId, "painel"] });
  };

  const responder = useMutation({
    mutationFn: (encerrar: boolean) => api.responderMensagem(id, texto.trim(), encerrar),
    onSuccess: (m) => {
      setTexto("");
      atualizar();
      avisar("sucesso", m.situacao === "encerrada" ? "Resposta enviada e conversa encerrada." : "Resposta enviada. O cidadão foi avisado.");
      navigate(`/admin/o/${orgaoId}/mensagens`);
    },
    onError: (e) => avisar("erro", mensagemErro(e)),
  });

  const mudar = useMutation({
    mutationFn: (s: "aberta" | "encerrada") => api.situacaoMensagem(id, s),
    onSuccess: (m) => {
      qc.setQueryData(["orgao", orgaoId, "mensagem", id], m);
      atualizar();
      avisar("sucesso", m.situacao === "encerrada" ? "Conversa encerrada." : "Conversa reaberta.");
    },
    onError: (e) => avisar("erro", mensagemErro(e)),
  });

  if (q.isLoading) return <Carregando />;
  if (q.error || !q.data) return <Erro texto={mensagemErro(q.error)} onTentar={() => q.refetch()} />;
  const m = q.data;
  const pode = texto.trim().length >= 2 && !responder.isPending;

  return (
    <div className="space-y-5">
      <BotaoVoltar para={`/admin/o/${orgaoId}/mensagens`} rotulo="Mensagens" />
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_SITUACAO_MSG[m.situacao]}`}>{NOME_SITUACAO_MSG[m.situacao]}</span>
          <span className="text-sm text-slate-500">protocolo {m.protocolo}</span>
        </div>
        <h1 className="mt-1 text-xl font-bold">{m.assunto}</h1>
        {m.cidadao && (
          <p className="mt-1 text-sm text-slate-600">
            De: <strong className="text-slate-800">{m.cidadao.nome}</strong> ·{" "}
            <a href={`mailto:${m.cidadao.email}`} className="text-blue-700 hover:underline">
              {m.cidadao.email}
            </a>
            {m.cidadao.telefone && <> · {m.cidadao.telefone}</>}
          </p>
        )}
      </div>

      <Conversa respostas={m.respostas ?? []} ladoDireito="servidor" />

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <AreaTexto label="Resposta ao cidadão" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Botao disabled={!pode} onClick={() => responder.mutate(false)}>
            {responder.isPending ? "Enviando..." : "Responder"}
          </Botao>
          <Botao variante="secundario" disabled={!pode} onClick={() => responder.mutate(true)}>
            Responder e encerrar
          </Botao>
          {m.situacao === "encerrada" ? (
            <Botao variante="secundario" disabled={mudar.isPending} onClick={() => mudar.mutate("aberta")}>
              Reabrir conversa
            </Botao>
          ) : (
            <Botao variante="secundario" disabled={mudar.isPending} onClick={() => mudar.mutate("encerrada")}>
              Encerrar sem responder
            </Botao>
          )}
        </div>
        <p className="text-xs text-slate-500">A resposta aparece para o cidadão na conta dele no portal, com aviso no sininho.</p>
      </div>
    </div>
  );
}
