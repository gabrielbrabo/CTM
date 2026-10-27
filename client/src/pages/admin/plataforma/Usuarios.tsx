import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { mensagemErro } from "../../../api/http";
import { UsuarioPlataforma, platformApi } from "../../../api/platform";
import { Carregando, Erro, Vazio } from "../../../components/Estado";
import { Botao, Campo } from "../../../components/ui";
import { NOME_PAPEL, formatarData } from "../../../lib/formato";
import { useAvisos } from "../../../lib/avisos";

function LinhaUsuario({ u }: { u: UsuarioPlataforma }) {
  const qc = useQueryClient();
  const [abrirSenha, setAbrirSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const { avisar } = useAvisos();
  const setMsg = (m: { tipo: "erro" | "sucesso"; texto: string } | null) => m && avisar(m.tipo, m.texto);

  const editar = useMutation({
    mutationFn: (d: { ativo?: boolean; novaSenha?: string }) => platformApi.editarUsuario(u.id, d),
    onSuccess: (_r, d) => {
      setMsg({ tipo: "sucesso", texto: d.novaSenha ? "Senha alterada." : "Usuário atualizado." });
      setAbrirSenha(false);
      setNovaSenha("");
      qc.invalidateQueries({ queryKey: ["plataforma"] });
    },
    onError: (e) => setMsg({ tipo: "erro", texto: mensagemErro(e) }),
  });

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {u.nome}{" "}
            {u.plataformaAdmin && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Administração GADZ</span>
            )}{" "}
            {!u.ativo && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">Desativado</span>}
          </p>
          <p className="text-sm text-slate-600">
            {u.email} · último acesso: {formatarData(u.ultimoLogin)}
          </p>
          <ul className="mt-1 text-sm">
            {u.acessos.map((a) => (
              <li key={a.orgaoId}>
                <Link to={`/admin/orgaos/${a.orgaoId}`} className="text-blue-700 hover:underline">
                  {a.orgaoNome}
                </Link>{" "}
                <span className="text-slate-500">
                  ({a.municipio}) · {NOME_PAPEL[a.papel]}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={() => setAbrirSenha((v) => !v)}>
            Trocar senha
          </Botao>
          <Botao variante="secundario" disabled={editar.isPending} onClick={() => editar.mutate({ ativo: !u.ativo })}>
            {u.ativo ? "Desativar" : "Reativar"}
          </Botao>
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
          <Campo
            label="Nova senha"
            type="text"
            minLength={8}
            required
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />
          <Botao type="submit" disabled={editar.isPending}>
            Salvar senha
          </Botao>
        </form>
      )}
    </li>
  );
}

// Todos os usuarios da plataforma (para adicionar usuario, entre no orgao)
export default function Usuarios() {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");

  // Espera o usuario parar de digitar antes de buscar
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["plataforma", "usuarios", termo],
    queryFn: () => platformApi.usuarios(termo),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-slate-600">Para adicionar um usuário, abra o órgão em “Órgãos”.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="busca-usuario" className="block text-sm font-medium text-slate-700">
          Buscar por nome ou e-mail
        </label>
        <input
          id="busca-usuario"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {isLoading && <Carregando />}
      {error && <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />}
      {data && data.length === 0 && <Vazio texto="Nenhum usuário encontrado." />}
      {data && data.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
          {data.map((u) => (
            <LinhaUsuario key={u.id} u={u} />
          ))}
        </ul>
      )}
    </div>
  );
}
