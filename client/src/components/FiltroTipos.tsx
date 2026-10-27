import { COR_PADRAO } from "../lib/tiposPublicacao";

/**
 * Etiquetas coloridas com a quantidade de cada tipo de publicacao.
 * Clicar filtra a lista por aquele tipo; "Todas" tira o filtro.
 */
export function FiltroTipos({
  porTipo,
  tipoAtual,
  nome,
  cor,
  onEscolher,
}: {
  porTipo: { tipo: string; total: number }[];
  tipoAtual: string;
  nome: (id: string) => string;
  cor: (id: string) => string;
  onEscolher: (tipo: string) => void;
}) {
  if (!porTipo.length) return null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
      <button
        type="button"
        aria-pressed={!tipoAtual}
        onClick={() => onEscolher("")}
        className={`rounded-full border px-3 py-1 text-sm font-medium ${
          !tipoAtual ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        Todas
      </button>
      {porTipo.map((t) => {
        const c = cor(t.tipo) || COR_PADRAO;
        const ativo = tipoAtual === t.tipo;
        return (
          <button
            key={t.tipo}
            type="button"
            aria-pressed={ativo}
            onClick={() => onEscolher(ativo ? "" : t.tipo)}
            style={ativo ? { backgroundColor: c, borderColor: c } : { borderColor: c }}
            className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-0.5 text-sm font-medium ${
              ativo ? "text-white" : "bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            {!ativo && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />}
            {nome(t.tipo)}
            <span className={`rounded-full px-1.5 text-xs font-bold ${ativo ? "bg-white/25" : "bg-slate-100"}`}>{t.total}</span>
          </button>
        );
      })}
    </div>
  );
}

// Tamanho legivel: 1234567 -> "1,2 MB"
const tamanho = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const extensao = (nome: string) => (nome.split(".").pop() ?? "").toUpperCase().slice(0, 4);

/** Botoes para baixar os documentos (direto da lista) */
export function BotoesBaixar({
  anexos,
  hrefDe,
  onBaixar,
}: {
  anexos: { nome: string; tamanho: number; url: string }[];
  hrefDe?: (url: string) => string; // portal: link direto
  onBaixar?: (url: string) => void; // painel: precisa do login
}) {
  if (!anexos.length) return null;
  const classe =
    "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100";
  return (
    <div className="flex flex-wrap gap-2">
      {anexos.map((a) => {
        const conteudo = (
          <>
            <span aria-hidden="true">⬇</span>
            <span className="truncate">{a.nome}</span>
            <span className="shrink-0 text-blue-600/80">
              {extensao(a.nome)} · {tamanho(a.tamanho)}
            </span>
          </>
        );
        return onBaixar ? (
          <button key={a.url} type="button" className={classe} onClick={() => onBaixar(a.url)} title={`Baixar ${a.nome}`}>
            {conteudo}
          </button>
        ) : (
          <a key={a.url} href={hrefDe ? hrefDe(a.url) : a.url} className={classe} title={`Baixar ${a.nome}`}>
            {conteudo}
          </a>
        );
      })}
    </div>
  );
}
