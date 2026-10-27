import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { mensagemErro } from "../../../api/http";
import { UsuarioDoOrgao, orgaoApi } from "../../../api/orgao";
import { Papel } from "../../../api/types";
import { Carregando, Erro } from "../../../components/Estado";
import { Botao, Campo, Secao, Selecao } from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { NOME_PAPEL, formatarData } from "../../../lib/formato";
import { useAvisos } from "../../../lib/avisos";

const DESCRICAO_PAPEL: Record<Papel, string> = {
  admin_orgao: "gerencia usuários e configurações, publica e despublica",
  editor: "cria e edita publicações",
  revisor: "revisa, aprova e publica",
};

type Msg = { tipo: "erro" | "sucesso"; texto: string } | null;

function SeletorPapel({ value, onChange, label = "Papel" }: { value: Papel; onChange: (p: Papel) => void; label?: string }) {
  return (
    <Selecao label={label} value={value} onChange={(e) => onChange(e.target.value as Papel)}>
      {(Object.keys(NOME_PAPEL) as Papel[]).map((p) => (
        <option key={p} value={p}>
          {NOME_PAPEL[p]} — {DESCRICAO_PAPEL[p]}
        </option>
      ))}
    </Selecao>
  );
}

function LinhaUsuario({ orgaoId, u, souEu }: { orgaoId: string; u: UsuarioDoOrgao; souEu: boolean }) {
  const api = orgaoApi(orgaoId);
  const qc = useQueryClient();
  const [abrirSenha, setAbrirSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const { avisar } = useAvisos();
  const setMsg = (m: Msg) => m && avisar(m.tipo, m.texto);
  const recarregar = () => qc.invalidateQueries({ queryKey: ["orgao", orgaoId, "usuarios"] });

  const editar = useMutation({
    mutationFn: (d: { papel?: Papel; novaSenha?: string }) => api.editarUsuario(u.id, d),
    onSuccess: (_r, d) => {
      setMsg({ tipo: "sucesso", texto: d.novaSenha ? "Senha alterada." : "Papel alterado." });
      setAbrirSenha(false);
      setNovaSenha("");
      recarregar();
    },
    onError: (e) => setMsg({ tipo: "erro", texto: mensagemErro(e) }),
  });

  const remover = useMutation({
    mutationFn: () => api.removerUsuario(u.id),
    onSuccess: recarregar,
    onError: (e) => setMsg({ tipo: "erro", texto: mensagemErro(e) }),
  });

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-medium">
            {u.nome} {souEu && <span className="text-xs text-slate-500">(você)</span>}{" "}
            {!u.ativo && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">Desativado</span>}
          </p>
          <p className="text-sm text-slate-600">
            {u.email} · último acesso: {formatarData(u.ultimoLogin)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <Selecao
              label="Papel"
              value={u.papel ?? "editor"}
              disabled={editar.isPending}
              onChange={(e) => editar.mutate({ papel: e.target.value as Papel })}
            >
              {(Object.keys(NOME_PAPEL) as Papel[]).map((p) => (
                <option key={p} value={p}>
                  {NOME_PAPEL[p]}
                </option>
              ))}
            </Selecao>
          </div>
          {!u.outrosOrgaos && (
            <Botao variante="secundario" onClick={() => setAbrirSenha((v) => !v)}>
              Trocar senha
            </Botao>
          )}
          {!souEu && (
            <Botao
              variante="perigo"
              disabled={remover.isPending}
              onClick={() => {
                if (confirm(`Remover o acesso de ${u.nome} a este órgão?`)) remover.mutate();
              }}
            >
              Remover
            </Botao>
          )}
        </div>
      </div>
      {abrirSenha && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            editar.mutate({ novaSenha });
          }}
        >
          <Campo label="Nova senha" type="text" minLength={8} required value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          <Botao type="submit" disabled={editar.isPending}>
            Salvar senha
          </Botao>
        </form>
      )}
    </li>
  );
}

// Usuarios do orgao (so o administrador do orgao ve esta tela)
export default function UsuariosOrgao() {
  const { orgaoId = "" } = useParams();
  const { usuario } = useAuth();
  const api = orgaoApi(orgaoId);
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["orgao", orgaoId, "usuarios"], queryFn: api.usuarios });

  const vazio = { nome: "", email: "", senha: "", papel: "editor" as Papel };
  const [form, setForm] = useState(vazio);
  const { avisar } = useAvisos();
  const setMsg = (m: Msg) => m && avisar(m.tipo, m.texto);

  const criar = useMutation({
    mutationFn: () => api.criarUsuario(form),
    onSuccess: (u) => {
      setMsg({
        tipo: "sucesso",
        texto: u.criado
          ? `Usuário criado. Envie para ${u.email} a senha inicial.`
          : `${u.email} já tinha conta no sistema e ganhou acesso a este órgão (com a senha que já usa).`,
      });
      setForm(vazio);
      qc.invalidateQueries({ queryKey: ["orgao", orgaoId, "usuarios"] });
    },
    onError: (e) => setMsg({ tipo: "erro", texto: mensagemErro(e) }),
  });

  if (isLoading) return <Carregando />;
  if (error || !data) return <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuários do órgão</h1>

      <Secao titulo={`Equipe (${data.length})`}>
        <ul className="divide-y divide-slate-100">
          {data.map((u) => (
            <LinhaUsuario key={u.id} orgaoId={orgaoId} u={u} souEu={u.id === usuario?.id} />
          ))}
        </ul>
      </Secao>

      <Secao titulo="Adicionar usuário">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            criar.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <Campo
              label="E-mail"
              type="email"
              required
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Campo
              label="Senha inicial"
              type="text"
              minLength={8}
              autoComplete="new-password"
              dica="Mínimo 8 caracteres."
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
            />
          </div>
          <SeletorPapel value={form.papel} onChange={(papel) => setForm({ ...form, papel })} />
          <Botao type="submit" disabled={criar.isPending}>
            {criar.isPending ? "Adicionando..." : "Adicionar"}
          </Botao>
        </form>
      </Secao>
    </div>
  );
}
