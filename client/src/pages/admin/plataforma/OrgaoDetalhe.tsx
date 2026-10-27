import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { mensagemErro } from "../../../api/http";
import { DadosOrgaoForm, OrgaoPlataforma, UsuarioOrgao, platformApi } from "../../../api/platform";
import { Papel } from "../../../api/types";
import { Carregando, Erro } from "../../../components/Estado";
import { Botao, Campo, SeloSituacao, Secao, Selecao } from "../../../components/ui";
import { NOME_PAPEL, NOME_TIPO, formatarCnpj, formatarData, paraInputData } from "../../../lib/formato";
import CamposOrgao from "./CamposOrgao";
import { EditorLogo } from "../../../components/Logo";
import { useAvisos } from "../../../lib/avisos";

// Converte o orgao da API para o formato do formulario
function paraForm(o: OrgaoPlataforma): DadosOrgaoForm {
  return {
    nome: o.nome,
    sigla: o.sigla ?? "",
    cnpj: o.cnpj ? formatarCnpj(o.cnpj) : "",
    situacao: o.situacao,
    contatos: { ...o.contatos },
    responsavel: { ...o.responsavel },
    plenario: o.plenario ?? "",
    recebeMensagens: o.recebeMensagens !== false,
    contrato: {
      numero: o.contrato?.numero ?? "",
      inicio: paraInputData(o.contrato?.inicio),
      fim: paraInputData(o.contrato?.fim),
      valorMensal: o.contrato?.valorMensal ?? "",
      observacoes: o.contrato?.observacoes ?? "",
    },
  };
}

function LinhaUsuario({ orgaoId, u }: { orgaoId: string; u: UsuarioOrgao }) {
  const qc = useQueryClient();
  const [novaSenha, setNovaSenha] = useState("");
  const [abrirSenha, setAbrirSenha] = useState(false);
  const { avisar } = useAvisos();
  const setMsg = (m: { tipo: "erro" | "sucesso"; texto: string } | null) => m && avisar(m.tipo, m.texto);
  const recarregar = () => qc.invalidateQueries({ queryKey: ["plataforma"] });

  const editar = useMutation({
    mutationFn: (d: { ativo?: boolean; novaSenha?: string }) => platformApi.editarUsuario(u.id, d),
    onSuccess: (_r, d) => {
      setMsg({ tipo: "sucesso", texto: d.novaSenha ? "Senha alterada." : "Usuário atualizado." });
      setNovaSenha("");
      setAbrirSenha(false);
      recarregar();
    },
    onError: (e) => setMsg({ tipo: "erro", texto: mensagemErro(e) }),
  });

  const remover = useMutation({
    mutationFn: () => platformApi.removerUsuario(orgaoId, u.id),
    onSuccess: recarregar,
    onError: (e) => setMsg({ tipo: "erro", texto: mensagemErro(e) }),
  });

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {u.nome}{" "}
            {!u.ativo && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">Desativado</span>}
          </p>
          <p className="text-sm text-slate-600">
            {u.email} · {u.papel ? NOME_PAPEL[u.papel] : "—"} · último acesso: {formatarData(u.ultimoLogin)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" type="button" onClick={() => setAbrirSenha((v) => !v)}>
            Trocar senha
          </Botao>
          <Botao
            variante="secundario"
            type="button"
            disabled={editar.isPending}
            onClick={() => editar.mutate({ ativo: !u.ativo })}
          >
            {u.ativo ? "Desativar" : "Reativar"}
          </Botao>
          <Botao
            variante="perigo"
            type="button"
            disabled={remover.isPending}
            onClick={() => {
              if (confirm(`Remover o acesso de ${u.nome} a este órgão?`)) remover.mutate();
            }}
          >
            Remover acesso
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

function NovoUsuario({ orgaoId }: { orgaoId: string }) {
  const qc = useQueryClient();
  const vazio = { nome: "", email: "", senha: "", papel: "editor" as Papel };
  const [form, setForm] = useState(vazio);
  const { avisar } = useAvisos();
  const setMsg = (m: { tipo: "erro" | "sucesso"; texto: string } | null) => m && avisar(m.tipo, m.texto);

  const adicionar = useMutation({
    mutationFn: () => platformApi.adicionarUsuario(orgaoId, form),
    onSuccess: (u) => {
      setMsg({
        tipo: "sucesso",
        texto: u.criado ? `Usuário ${u.email} criado.` : `${u.email} já tinha conta e ganhou acesso a este órgão.`,
      });
      setForm(vazio);
      qc.invalidateQueries({ queryKey: ["plataforma"] });
    },
    onError: (e) => setMsg({ tipo: "erro", texto: mensagemErro(e) }),
  });

  return (
    <form
      className="mt-4 rounded-lg border border-dashed border-slate-300 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        adicionar.mutate();
      }}
    >
      <p className="mb-3 text-sm font-medium">Adicionar usuário</p>
      <div className="grid gap-3 sm:grid-cols-4">
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
          dica="Não precisa se o e-mail já tiver conta."
          value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })}
        />
        <Selecao label="Papel" value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value as Papel })}>
          <option value="admin_orgao">Administrador</option>
          <option value="editor">Editor</option>
          <option value="revisor">Revisor</option>
        </Selecao>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Botao type="submit" disabled={adicionar.isPending}>
          {adicionar.isPending ? "Adicionando..." : "Adicionar"}
        </Botao>
      </div>
    </form>
  );
}

// Detalhe/edicao de um orgao + usuarios dele
export default function OrgaoDetalhe() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const recemCriado = (location.state as { criado?: boolean } | null)?.criado;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["plataforma", "orgao", id],
    queryFn: () => platformApi.orgao(id),
  });

  const [form, setForm] = useState<DadosOrgaoForm | null>(null);
  const { avisar } = useAvisos();
  const setMsg = (m: { tipo: "erro" | "sucesso"; texto: string } | null) => m && avisar(m.tipo, m.texto);
  // Aviso de "cadastrado" so uma vez, ao chegar da tela de novo orgao
  const avisouCriado = useRef(false);
  useEffect(() => {
    if (recemCriado && !avisouCriado.current) {
      avisouCriado.current = true;
      avisar("sucesso", "Órgão cadastrado com sucesso.");
    }
  }, [recemCriado, avisar]);

  useEffect(() => {
    if (data) setForm(paraForm(data.orgao));
  }, [data]);

  const salvar = useMutation({
    mutationFn: (d: DadosOrgaoForm) => platformApi.editarOrgao(id, d),
    onSuccess: () => {
      setMsg({ tipo: "sucesso", texto: "Alterações do órgão salvas." });
      qc.invalidateQueries({ queryKey: ["plataforma"] });
      // Volta para a lista para ver a alteracao
      navigate("/admin/orgaos");
    },
    onError: (e) => setMsg({ tipo: "erro", texto: mensagemErro(e) }),
  });

  if (isLoading || (data && !form)) return <Carregando />;
  if (error || !data || !form) return <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />;

  const { orgao, usuarios } = data;

  function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    salvar.mutate(form!);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin/orgaos" className="text-sm text-slate-600 hover:underline">
          ← Órgãos
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{orgao.nome}</h1>
          <SeloSituacao situacao={orgao.situacao} />
        </div>
        <p className="text-sm text-slate-600">
          {NOME_TIPO[orgao.tipo]} · {orgao.municipio?.nome}/{orgao.municipio?.uf} · cadastrado em{" "}
          {formatarData(orgao.criadoEm)}
          {" · "}
          <Link to={`/admin/o/${orgao.id}`} className="text-blue-700 hover:underline">
            abrir painel do órgão
          </Link>
          {" · "}
          <Link to={`/admin/o/${orgao.id}/historico`} className="text-blue-700 hover:underline">
            histórico
          </Link>
          {orgao.municipio && orgao.situacao === "ativo" && (
            <>
              {" · "}
              <a
                href={`/${orgao.municipio.slug}/${orgao.tipo}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 hover:underline"
              >
                ver no portal
              </a>
            </>
          )}
        </p>
      </div>

      <Secao titulo="Logo do órgão (aparece no portal)">
        <EditorLogo
          url={orgao.logoUrl}
          nome={orgao.nome}
          onEnviar={async (arquivo) => {
            await platformApi.enviarLogoOrgao(orgao.id, arquivo);
            qc.invalidateQueries({ queryKey: ["plataforma"] });
          }}
          onRemover={async () => {
            await platformApi.removerLogoOrgao(orgao.id);
            qc.invalidateQueries({ queryKey: ["plataforma"] });
          }}
        />
      </Secao>

      <form onSubmit={enviar} className="space-y-4">
        <CamposOrgao valor={form} onChange={setForm} tipo={orgao.tipo} />
        <Botao type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando..." : "Salvar alterações"}
        </Botao>
      </form>

      <Secao titulo={`Usuários do órgão (${usuarios.length})`}>
        {usuarios.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum usuário ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <LinhaUsuario key={u.id} orgaoId={orgao.id} u={u} />
            ))}
          </ul>
        )}
        <NovoUsuario orgaoId={orgao.id} />
      </Secao>
    </div>
  );
}
