import { useQuery } from "@tanstack/react-query";
import { http } from "../api/http";
import { Campo, Selecao, AreaTexto } from "../components/ui";
import { formatarData, formatarDataHora, formatarMoeda } from "./formato";

// Catalogo de tipos de publicacao (vem da API: /api/public/tipos-publicacao)

export type TipoCampo = "texto" | "texto_longo" | "data" | "datahora" | "numero" | "moeda" | "selecao" | "url";

export interface CampoTipo {
  nome: string;
  rotulo: string;
  tipo: TipoCampo;
  opcoes?: string[];
  obrigatorio?: boolean;
  dica?: string;
  largura?: "inteira" | "metade";
}

export interface TipoPublicacaoDef {
  id: string;
  nome: string;
  orgaos: ("camara" | "prefeitura")[];
  grupo: "geral" | "camara" | "prefeitura";
  descricao: string;
  campos: CampoTipo[];
  destaque?: string;
  cor?: string; // cor do tipo (etiqueta e faixa na lista)
  // Ligacoes com os vereadores (so Camara)
  vinculos?: { autores?: boolean; relator?: boolean; votacao?: boolean; presenca?: boolean };
}

export type Detalhes = Record<string, unknown>;

export const COR_PADRAO = "#475569";

/**
 * Cor da situacao (aprovado = verde, rejeitado = vermelho, em andamento = amarelo...).
 * Funciona pelo texto, entao vale para qualquer tipo de publicacao.
 */
export function classeSituacao(texto: string): string {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/aprovad|sancionad|promulgad|homologad|favoravel|concluid|realizad|respondid|vigente|em vigor|deferid|contratad/.test(t))
    return "bg-green-100 text-green-900 ring-green-300";
  if (/rejeitad|reprovad|vetad|cancelad|contrari|indeferid|deserta|fracassad|revogad|suspens|anulad|paralisad/.test(t))
    return "bg-red-100 text-red-900 ring-red-300";
  if (/tramita|comissao|pendente|adiad|andamento|analise|aguard|1º turno|2º turno|execucao|em pauta|pronto para pauta/.test(t))
    return "bg-amber-100 text-amber-900 ring-amber-300";
  if (/arquivad|retirad|encerrad|prejudicad/.test(t)) return "bg-slate-200 text-slate-700 ring-slate-300";
  return "bg-blue-100 text-blue-900 ring-blue-300"; // apresentado, agendada, aberta...
}

// Etiqueta colorida da situacao
export function SeloSituacaoPublicacao({ texto, grande = false }: { texto: string; grande?: boolean }) {
  return (
    <span className={`inline-block rounded-full font-semibold ring-1 ring-inset ${classeSituacao(texto)} ${grande ? "px-3 py-0.5 text-sm" : "px-2 py-0.5 text-xs"}`}>
      {texto}
    </span>
  );
}

// Etiqueta colorida do tipo (texto branco sobre a cor do tipo)
export function EtiquetaTipo({ nome, cor, grande = false }: { nome: string; cor?: string; grande?: boolean }) {
  return (
    <span
      style={{ backgroundColor: cor ?? COR_PADRAO }}
      className={`inline-block rounded-full font-semibold text-white ${grande ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
    >
      {nome}
    </span>
  );
}

export function useTiposPublicacao() {
  const q = useQuery({
    queryKey: ["tipos-publicacao"],
    queryFn: () => http.get<TipoPublicacaoDef[]>("/public/tipos-publicacao").then((r) => r.data),
    staleTime: Infinity,
  });
  const lista = q.data ?? [];
  const porId = (id: string) => lista.find((t) => t.id === id);
  return {
    carregando: q.isLoading,
    lista,
    porId,
    nome: (id: string) => porId(id)?.nome ?? id,
    cor: (id: string) => porId(id)?.cor ?? COR_PADRAO,
    // Tipos disponiveis para Camara ou Prefeitura
    doOrgao: (orgaoTipo: string) => lista.filter((t) => t.orgaos.includes(orgaoTipo as "camara" | "prefeitura")),
  };
}

const ROTULO_GRUPO: Record<string, string> = {
  camara: "Câmara",
  prefeitura: "Prefeitura",
  geral: "Comuns (Câmara e Prefeitura)",
};

// Opcoes do <select> de tipo, agrupadas (especificos do orgao primeiro, depois os comuns)
export function OpcoesTipo({ tipos }: { tipos: TipoPublicacaoDef[] }) {
  const grupos = ["camara", "prefeitura", "geral"]
    // Em ordem alfabetica dentro de cada grupo (sao muitos tipos)
    .map((g) => ({ g, itens: tipos.filter((t) => t.grupo === g).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) }))
    .filter((x) => x.itens.length);
  return (
    <>
      {grupos.map(({ g, itens }) => (
        <optgroup key={g} label={ROTULO_GRUPO[g]}>
          {itens.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

// "2026-10-25T13:00:00.000Z" -> valor do <input type="datetime-local"> no horario local
function paraDataHoraLocal(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Campos especificos do tipo, montados a partir do catalogo
export function CamposDetalhes({
  def,
  valor,
  onChange,
}: {
  def: TipoPublicacaoDef;
  valor: Detalhes;
  onChange: (v: Detalhes) => void;
}) {
  const set = (nome: string, v: unknown) => onChange({ ...valor, [nome]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {def.campos.map((c) => {
        const atual = valor[c.nome];
        const comum = {
          label: c.rotulo,
          required: c.obrigatorio,
          className: c.largura === "inteira" || c.tipo === "texto_longo" ? "sm:col-span-2" : "",
        };
        switch (c.tipo) {
          case "selecao":
            return (
              <Selecao key={c.nome} {...comum} value={String(atual ?? "")} onChange={(e) => set(c.nome, e.target.value)}>
                <option value="">Selecione</option>
                {c.opcoes?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Selecao>
            );
          case "texto_longo":
            return (
              <AreaTexto key={c.nome} {...comum} value={String(atual ?? "")} onChange={(e) => set(c.nome, e.target.value)} />
            );
          case "datahora":
            return (
              <Campo
                key={c.nome}
                {...comum}
                type="datetime-local"
                dica={c.dica}
                value={paraDataHoraLocal(atual)}
                // Converte o horario local para ISO (com fuso) antes de enviar
                onChange={(e) => set(c.nome, e.target.value ? new Date(e.target.value).toISOString() : "")}
              />
            );
          default:
            return (
              <Campo
                key={c.nome}
                {...comum}
                dica={c.dica}
                type={c.tipo === "data" ? "date" : c.tipo === "url" ? "url" : c.tipo === "numero" || c.tipo === "moeda" ? "number" : "text"}
                step={c.tipo === "moeda" ? "0.01" : c.tipo === "numero" ? "1" : undefined}
                min={c.tipo === "numero" || c.tipo === "moeda" ? "0" : undefined}
                placeholder={c.tipo === "url" ? "https://" : undefined}
                value={atual === undefined || atual === null ? "" : String(atual)}
                onChange={(e) => set(c.nome, e.target.value)}
              />
            );
        }
      })}
    </div>
  );
}

// Valor formatado para exibir no portal
export function formatarValorCampo(c: CampoTipo, v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  switch (c.tipo) {
    case "data":
      return formatarData(String(v));
    case "datahora":
      return formatarDataHora(String(v));
    case "moeda":
      return formatarMoeda(Number(v));
    case "numero":
      return c.nome === "percentual" ? `${v}%` : String(v);
    default:
      return String(v);
  }
}

// Ficha com os campos especificos (pagina publica)
const CAMPOS_SITUACAO = ["situacao", "resultado", "conclusao"];

export function FichaDetalhes({ def, detalhes }: { def: TipoPublicacaoDef; detalhes: Detalhes }) {
  const linhas = def.campos.filter((c) => formatarValorCampo(c, detalhes[c.nome]) !== "");
  if (!linhas.length) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      {linhas.map((c) => {
        const valor = formatarValorCampo(c, detalhes[c.nome]);
        return (
          <div key={c.nome} className={c.tipo === "texto_longo" || c.largura === "inteira" ? "sm:col-span-2" : ""}>
            <dt className="text-xs font-medium uppercase text-slate-500">{c.rotulo}</dt>
            <dd className="mt-0.5 whitespace-pre-line text-slate-800">
              {c.tipo === "url" ? (
                <a href={valor} target="_blank" rel="noreferrer" className="break-all text-blue-700 hover:underline">
                  {valor}
                </a>
              ) : CAMPOS_SITUACAO.includes(c.nome) ? (
                // Situacao/resultado em cor (aprovado verde, rejeitado vermelho...)
                <SeloSituacaoPublicacao texto={valor} grande />
              ) : (
                valor
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// Etiqueta de destaque (ex.: situacao) mostrada nas listas
export function valorDestaque(def: TipoPublicacaoDef | undefined, detalhes: Detalhes | undefined): string | null {
  if (!def?.destaque || !detalhes) return null;
  const v = detalhes[def.destaque];
  return v ? String(v) : null;
}
