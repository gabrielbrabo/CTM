import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { mensagemErro } from "../../../api/http";
import { DadosOrgaoForm, UsuarioPlataforma, platformApi } from "../../../api/platform";
import { Aviso, Botao, Campo, Secao, Selecao } from "../../../components/ui";
import { ESTADOS } from "../../../lib/estados";
import { NOME_PAPEL } from "../../../lib/formato";
import CamposOrgao from "./CamposOrgao";

type Tipo = "prefeitura" | "camara";

// Busca e escolhe um usuario ja cadastrado (para ser admin de mais de um orgao)
function EscolherUsuario({ escolhido, onEscolher }: { escolhido: UsuarioPlataforma | null; onEscolher: (u: UsuarioPlataforma | null) => void }) {
  const [busca, setBusca] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["plataforma", "usuarios", busca.trim()],
    queryFn: () => platformApi.usuarios(busca.trim()),
  });
  // Superadmin GADZ nao entra como usuario de orgao
  const lista = (data || []).filter((u) => !u.plataformaAdmin);

  if (escolhido) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-300 bg-blue-50 p-3">
        <div>
          <p className="font-semibold">{escolhido.nome}</p>
          <p className="text-sm text-slate-600">{escolhido.email}</p>
          {escolhido.acessos.length > 0 && (
            <p className="mt-1 text-xs text-slate-600">Já acessa: {escolhido.acessos.map((a) => a.orgaoNome).join(", ")}</p>
          )}
        </div>
        <Botao variante="secundario" type="button" onClick={() => onEscolher(null)}>
          Trocar
        </Botao>
      </div>
    );
  }

  return (
    <div>
      <Campo
        label="Buscar usuário"
        type="search"
        placeholder="Digite o nome ou e-mail"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <ul className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
        {isLoading && <li className="p-3 text-sm text-slate-500">Carregando...</li>}
        {!isLoading && lista.length === 0 && <li className="p-3 text-sm text-slate-500">Nenhum usuário encontrado.</li>}
        {lista.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => onEscolher(u)}
              className="flex w-full flex-col items-start p-3 text-left hover:bg-slate-50"
            >
              <span className="font-medium">
                {u.nome} {!u.ativo && <span className="text-xs text-red-700">(inativo)</span>}
              </span>
              <span className="text-sm text-slate-600">{u.email}</span>
              {u.acessos.length > 0 && (
                <span className="text-xs text-slate-500">
                  {u.acessos.map((a) => `${a.orgaoNome} (${NOME_PAPEL[a.papel]})`).join(" · ")}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Cadastro de um orgao contratante (Prefeitura OU Camara) + seu administrador
export default function OrgaoNovo() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: municipios } = useQuery({ queryKey: ["plataforma", "municipios"], queryFn: platformApi.municipios });

  const [tipo, setTipo] = useState<Tipo>("camara");
  const [modoMunicipio, setModoMunicipio] = useState<"existente" | "novo">("novo");
  const [municipioId, setMunicipioId] = useState("");
  const [novoMunicipio, setNovoMunicipio] = useState({ nome: "", uf: "" });
  const [dados, setDados] = useState<DadosOrgaoForm>({ situacao: "ativo" });
  const [modoAdmin, setModoAdmin] = useState<"novo" | "existente">("novo");
  const [admin, setAdmin] = useState({ nome: "", email: "", senha: "" });
  const [adminExistente, setAdminExistente] = useState<UsuarioPlataforma | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const municipioEscolhido = municipios?.find((m) => m.id === municipioId);
  const nomeMunicipio = modoMunicipio === "existente" ? municipioEscolhido?.nome : novoMunicipio.nome.trim();
  const nomeSugerido = nomeMunicipio
    ? tipo === "prefeitura"
      ? `Prefeitura Municipal de ${nomeMunicipio}`
      : `Câmara Municipal de ${nomeMunicipio}`
    : undefined;

  // Avisa se o municipio escolhido ja tem esse tipo de orgao
  const jaTemEsseTipo = municipioEscolhido?.orgaos.some((o) => o.tipo === tipo);

  const criar = useMutation({
    mutationFn: platformApi.criarOrgao,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["plataforma"] });
      navigate(`/admin/orgaos/${r.orgao.id}`, { state: { criado: true, adminCriado: r.admin.criado } });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (modoAdmin === "existente" && !adminExistente) {
      setErro("Escolha o usuário que será administrador do órgão.");
      return;
    }
    criar.mutate({
      ...dados,
      tipo,
      ...(modoMunicipio === "existente" ? { municipioId } : { novoMunicipio }),
      admin: modoAdmin === "existente" && adminExistente ? { usuarioId: adminExistente.id } : admin,
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <Link to="/admin/orgaos" className="text-sm text-slate-600 hover:underline">
          ← Órgãos
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Novo órgão</h1>
        <p className="text-sm text-slate-600">
          Cada órgão (Prefeitura ou Câmara) tem contrato, pagamento e administrador próprios.
        </p>
      </div>

      <Secao titulo="Tipo e município">
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Tipo de órgão *</legend>
          <div className="mt-2 flex gap-3">
            {(["camara", "prefeitura"] as Tipo[]).map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
                  tipo === t ? "border-blue-600 bg-blue-50 font-medium" : "border-slate-300"
                }`}
              >
                <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
                {t === "camara" ? "Câmara Municipal" : "Prefeitura Municipal"}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-slate-700">Município *</legend>
          <div className="mt-2 flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={modoMunicipio === "novo"} onChange={() => setModoMunicipio("novo")} />
              Município novo
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={modoMunicipio === "existente"}
                onChange={() => setModoMunicipio("existente")}
                disabled={!municipios?.length}
              />
              Já cadastrado {municipios?.length ? `(${municipios.length})` : ""}
            </label>
          </div>

          {modoMunicipio === "novo" ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_14rem]">
              <Campo
                label="Nome do município"
                required
                value={novoMunicipio.nome}
                onChange={(e) => setNovoMunicipio({ ...novoMunicipio, nome: e.target.value })}
              />
              <Selecao
                label="Estado"
                required
                value={novoMunicipio.uf}
                onChange={(e) => setNovoMunicipio({ ...novoMunicipio, uf: e.target.value })}
              >
                <option value="">Selecione</option>
                {Object.entries(ESTADOS).map(([uf, nome]) => (
                  <option key={uf} value={uf}>
                    {nome} ({uf})
                  </option>
                ))}
              </Selecao>
            </div>
          ) : (
            <div className="mt-3">
              <Selecao label="Município" required value={municipioId} onChange={(e) => setMunicipioId(e.target.value)}>
                <option value="">Selecione</option>
                {municipios?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}/{m.uf}
                    {m.orgaos.length ? ` — já tem: ${m.orgaos.map((o) => (o.tipo === "camara" ? "Câmara" : "Prefeitura")).join(", ")}` : ""}
                  </option>
                ))}
              </Selecao>
              {jaTemEsseTipo && (
                <p className="mt-2 text-sm text-red-700">
                  Este município já tem {tipo === "camara" ? "uma Câmara" : "uma Prefeitura"} cadastrada.
                </p>
              )}
            </div>
          )}
        </fieldset>
      </Secao>

      <CamposOrgao valor={dados} onChange={setDados} nomeSugerido={nomeSugerido} tipo={tipo} />

      <Secao titulo="Administrador do órgão">
        <p className="mb-3 text-sm text-slate-600">
          Essa pessoa entra no painel e cadastra os outros usuários do órgão. A mesma pessoa pode administrar mais de um
          órgão: ao entrar, ela escolhe qual quer acessar.
        </p>
        <fieldset className="mb-4 flex flex-wrap gap-3 text-sm">
          <legend className="sr-only">Quem será o administrador</legend>
          {(
            [
              ["novo", "Cadastrar novo usuário"],
              ["existente", "Usar usuário já cadastrado"],
            ] as const
          ).map(([valor, rotulo]) => (
            <label
              key={valor}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 ${
                modoAdmin === valor ? "border-blue-600 bg-blue-50 font-medium" : "border-slate-300"
              }`}
            >
              <input type="radio" name="modoAdmin" checked={modoAdmin === valor} onChange={() => setModoAdmin(valor)} />
              {rotulo}
            </label>
          ))}
        </fieldset>

        {modoAdmin === "existente" ? (
          <EscolherUsuario escolhido={adminExistente} onEscolher={setAdminExistente} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Nome" required value={admin.nome} onChange={(e) => setAdmin({ ...admin, nome: e.target.value })} />
            <Campo
              label="E-mail"
              type="email"
              required
              autoComplete="off"
              value={admin.email}
              onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
            />
            <Campo
              label="Senha inicial"
              type="text"
              autoComplete="new-password"
              minLength={8}
              dica="Mínimo 8 caracteres. Envie para a pessoa e peça para trocar."
              value={admin.senha}
              onChange={(e) => setAdmin({ ...admin, senha: e.target.value })}
            />
          </div>
        )}
      </Secao>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="flex gap-3">
        <Botao type="submit" disabled={criar.isPending || jaTemEsseTipo}>
          {criar.isPending ? "Salvando..." : "Cadastrar órgão"}
        </Botao>
        <Link to="/admin/orgaos" className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:underline">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
