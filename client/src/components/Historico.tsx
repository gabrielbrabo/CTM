import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { mensagemErro } from "../api/http";
import { FiltroHistorico, ItemHistorico, PaginaHistorico } from "../api/types";
import { formatarDataHora } from "../lib/formato";
import { Carregando, Erro, Vazio } from "./Estado";
import { Botao, Campo, Selecao } from "./ui";

// Nome amigavel de cada acao registrada
export const NOME_ACAO: Record<string, string> = {
  "auth.login": "Entrou no sistema",
  "auth.logout": "Saiu do sistema",
  "auth.login_falhou": "Tentativa de login com senha errada",
  "publicacao.criar": "Criou publicação",
  "publicacao.editar": "Editou publicação",
  "publicacao.corrigir": "Corrigiu publicação publicada",
  "publicacao.enviar_revisao": "Enviou publicação para revisão",
  "publicacao.devolver": "Devolveu publicação para correção",
  "publicacao.publicar": "Publicou",
  "publicacao.despublicar": "Retirou publicação do portal",
  "publicacao.excluir": "Excluiu rascunho",
  "publicacao.anexo_adicionar": "Anexou arquivo",
  "publicacao.anexo_remover": "Removeu anexo",
  "publicacao.anexo_exibicao": "Mudou documento no lugar do texto",
  "usuario.criar": "Cadastrou usuário",
  "usuario.vincular": "Deu acesso a usuário",
  "usuario.editar": "Alterou usuário",
  "usuario.desvincular": "Removeu acesso de usuário",
  "orgao.criar": "Cadastrou órgão",
  "orgao.editar": "Alterou dados/contrato do órgão",
  "orgao.config": "Alterou configurações do órgão",
  "orgao.logo": "Trocou a logo do órgão",
  "orgao.logo_remover": "Removeu a logo do órgão",
  "vereador.criar": "Cadastrou vereador(a)",
  "vereador.editar": "Alterou dados de vereador(a)",
  "vereador.excluir": "Excluiu vereador(a)",
  "vereador.foto": "Trocou a foto de vereador(a)",
  "vereador.foto_remover": "Removeu a foto de vereador(a)",
  "mensagem.responder": "Respondeu mensagem da população",
  "mensagem.situacao": "Mudou a situação de mensagem",
  "municipio.criar": "Cadastrou município",
  "municipio.editar": "Alterou município",
  "municipio.brasao": "Trocou o brasão do município",
  "municipio.brasao_remover": "Removeu o brasão do município",
};

const CATEGORIAS: [string, string][] = [
  ["publicacao", "Publicações"],
  ["usuario", "Usuários"],
  ["orgao", "Órgão"],
  ["vereador", "Vereadores"],
  ["mensagem", "Mensagens"],
  ["municipio", "Municípios"],
  ["auth", "Entradas no sistema"],
];

// Cor da etiqueta por categoria
const COR: Record<string, string> = {
  publicacao: "bg-blue-100 text-blue-900",
  usuario: "bg-violet-100 text-violet-900",
  orgao: "bg-amber-100 text-amber-900",
  vereador: "bg-rose-100 text-rose-900",
  mensagem: "bg-green-100 text-green-900",
  municipio: "bg-teal-100 text-teal-900",
  auth: "bg-slate-200 text-slate-800",
};

// Nomes amigaveis para os campos alterados
const NOME_CAMPO: Record<string, string> = {
  titulo: "Título",
  resumo: "Resumo",
  conteudo: "Texto",
  motivo: "Motivo",
  nome: "Nome",
  email: "E-mail",
  papel: "Papel",
  ativo: "Ativo",
  uf: "Estado",
  situacao: "Situação",
  exigeRevisao: "Exige revisão",
  trocouSenha: "Trocou a senha",
  tipo: "Tipo",
  numero: "Número",
  contrato: "Contrato",
};

function valorTexto(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Detalhes({ d }: { d: Record<string, unknown> | null }) {
  const entradas = Object.entries(d ?? {}).filter(([k]) => k !== "orgaoId");
  if (!entradas.length) return null;
  return (
    <details className="mt-1 text-xs text-slate-600">
      <summary className="cursor-pointer text-blue-700 hover:underline">Ver detalhes</summary>
      <dl className="mt-1 grid gap-x-3 gap-y-0.5 rounded-lg bg-slate-50 p-2 sm:grid-cols-[10rem_1fr]">
        {entradas.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-medium">{NOME_CAMPO[k] ?? k}</dt>
            <dd className="break-words">{valorTexto(v)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Linha({ item, mostrarLocal }: { item: ItemHistorico; mostrarLocal: boolean }) {
  const categoria = item.acao.split(".")[0];
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
      <time className="shrink-0 text-sm text-slate-500 sm:w-36" dateTime={item.data}>
        {formatarDataHora(item.data)}
      </time>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{item.usuario?.nome ?? "Sistema / desconhecido"}</span>{" "}
          <span className={`ml-1 rounded px-1.5 py-0.5 text-xs font-medium ${COR[categoria] ?? COR.auth}`}>
            {NOME_ACAO[item.acao] ?? item.acao}
          </span>
        </p>
        {item.alvo && <p className="mt-0.5 break-words text-sm text-slate-800">{item.alvo}</p>}
        <p className="mt-0.5 text-xs text-slate-500">
          {item.usuario?.email}
          {mostrarLocal && (item.orgao || item.municipio) && ` · ${[item.orgao, item.municipio].filter(Boolean).join(" · ")}`}
          {item.ip && ` · IP ${item.ip}`}
        </p>
        <Detalhes d={item.detalhes} />
      </div>
    </li>
  );
}

/**
 * Tela de historico (quem fez o que e quando), com filtros e paginas.
 * buscar: chamada da API (GADZ ou orgao). mostrarLocal: exibe orgao/municipio de cada linha.
 */
export function HistoricoLista({
  chave,
  buscar,
  mostrarLocal = false,
}: {
  chave: unknown[];
  buscar: (f: FiltroHistorico) => Promise<PaginaHistorico>;
  mostrarLocal?: boolean;
}) {
  const [form, setForm] = useState({ q: "", acao: "", de: "", ate: "" });
  const [filtro, setFiltro] = useState<FiltroHistorico>({ pagina: 1 });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [...chave, "historico", filtro],
    queryFn: () => buscar(filtro),
    placeholderData: keepPreviousData,
  });

  function aplicar(e: FormEvent) {
    e.preventDefault();
    setFiltro({ ...form, pagina: 1 });
  }
  function limpar() {
    setForm({ q: "", acao: "", de: "", ate: "" });
    setFiltro({ pagina: 1 });
  }
  const irPara = (pagina: number) => {
    setFiltro((f) => ({ ...f, pagina }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={aplicar} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_14rem_10rem_10rem_auto]">
        <Campo label="Quem fez (nome ou e-mail)" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} />
        <Selecao label="O que foi feito" value={form.acao} onChange={(e) => setForm({ ...form, acao: e.target.value })}>
          <option value="">Tudo</option>
          {CATEGORIAS.map(([v, rotulo]) => (
            <optgroup key={v} label={rotulo}>
              <option value={v}>Tudo de {rotulo.toLowerCase()}</option>
              {Object.entries(NOME_ACAO)
                .filter(([a]) => a.startsWith(`${v}.`))
                .map(([a, nome]) => (
                  <option key={a} value={a}>
                    {nome}
                  </option>
                ))}
            </optgroup>
          ))}
        </Selecao>
        <Campo label="De" type="date" value={form.de} onChange={(e) => setForm({ ...form, de: e.target.value })} />
        <Campo label="Até" type="date" value={form.ate} onChange={(e) => setForm({ ...form, ate: e.target.value })} />
        <div className="flex items-end gap-2">
          <Botao type="submit">Filtrar</Botao>
          <Botao type="button" variante="secundario" onClick={limpar}>
            Limpar
          </Botao>
        </div>
      </form>

      {isLoading && <Carregando />}
      {error && <Erro texto={mensagemErro(error)} onTentar={() => refetch()} />}
      {data && data.itens.length === 0 && <Vazio texto="Nenhuma movimentação encontrada." />}
      {data && data.itens.length > 0 && (
        <>
          <p className="text-sm text-slate-500" aria-live="polite">
            {data.total} registro{data.total > 1 ? "s" : ""} {isFetching && "· atualizando..."}
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {data.itens.map((i) => (
              <Linha key={i.id} item={i} mostrarLocal={mostrarLocal} />
            ))}
          </ul>
          {data.paginas > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Botao variante="secundario" disabled={data.pagina <= 1} onClick={() => irPara(data.pagina - 1)}>
                ← Anteriores
              </Botao>
              <span className="text-sm text-slate-600">
                Página {data.pagina} de {data.paginas}
              </span>
              <Botao variante="secundario" disabled={data.pagina >= data.paginas} onClick={() => irPara(data.pagina + 1)}>
                Próximos →
              </Botao>
            </div>
          )}
        </>
      )}
    </div>
  );
}
