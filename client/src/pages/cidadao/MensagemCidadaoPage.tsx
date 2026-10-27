import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { cidadaoApi } from "../../api/cidadao";
import { mensagemErro } from "../../api/http";
import { Conversa } from "../../components/Conversa";
import { Carregando, Erro } from "../../components/Estado";
import { BotaoVoltar, Logo } from "../../components/Logo";
import { AreaTexto, Botao } from "../../components/ui";
import { useCidadao } from "../../context/CidadaoContext";
import { useAvisos } from "../../lib/avisos";
import { COR_SITUACAO_MSG, NOME_SITUACAO_MSG } from "./MinhaContaPage";

// Conversa do cidadao com o orgao
export default function MensagemCidadaoPage() {
  const { id = "" } = useParams();
  const { conta, carregando, atualizar } = useCidadao();
  const { avisar } = useAvisos();
  const [texto, setTexto] = useState("");
  const q = useQuery({ queryKey: ["cidadao", "mensagem", id], queryFn: () => cidadaoApi.mensagem(id), enabled: Boolean(conta) });

  // Abriu a conversa: atualiza o sininho
  useEffect(() => {
    if (q.data) atualizar();
  }, [q.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const responder = useMutation({
    mutationFn: () => cidadaoApi.responder(id, texto.trim()),
    onSuccess: () => {
      setTexto("");
      avisar("sucesso", "Resposta enviada.");
      q.refetch();
    },
    onError: (e) => avisar("erro", mensagemErro(e)),
  });

  if (carregando) return <Carregando />;
  if (!conta) return <Navigate to={`/entrar?voltar=/minha-conta/mensagens/${id}`} replace />;
  if (q.isLoading) return <Carregando />;
  if (q.error || !q.data) return <Erro texto={mensagemErro(q.error)} onTentar={() => q.refetch()} />;
  const m = q.data;

  return (
    <div className="space-y-5">
      <BotaoVoltar para="/minha-conta#mensagens" rotulo="Minhas mensagens" />
      <div className="flex items-center gap-3">
        <Logo url={m.orgao?.logoUrl} nome={m.orgao?.nome ?? "Órgão"} tamanho="md" />
        <div>
          <h1 className="text-xl font-bold">{m.assunto}</h1>
          <p className="text-sm text-slate-600">
            Para: {m.orgao?.nome} · protocolo <strong>{m.protocolo}</strong>
          </p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COR_SITUACAO_MSG[m.situacao]}`}>{NOME_SITUACAO_MSG[m.situacao]}</span>
        </div>
      </div>

      <Conversa respostas={m.respostas ?? []} ladoDireito="cidadao" />

      {m.situacao === "encerrada" ? (
        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Esta conversa foi encerrada pelo órgão. Se precisar, envie uma nova mensagem.</p>
      ) : (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (texto.trim().length >= 2) responder.mutate();
          }}
          className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
        >
          <AreaTexto label="Escrever resposta" rows={3} required value={texto} onChange={(e) => setTexto(e.target.value)} />
          <Botao type="submit" disabled={responder.isPending || texto.trim().length < 2}>
            {responder.isPending ? "Enviando..." : "Enviar"}
          </Botao>
        </form>
      )}
    </div>
  );
}
