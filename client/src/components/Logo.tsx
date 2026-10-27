import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { urlDaApi } from "../api/http";

const TAMANHOS = {
  sm: "h-10 w-10 text-sm",
  md: "h-14 w-14 text-lg",
  lg: "h-20 w-20 text-2xl",
  xl: "h-24 w-24 text-3xl sm:h-36 sm:w-36 sm:text-4xl",
};

// Iniciais para quando nao ha logo: "Câmara Municipal de São Romão" -> "CM"
function iniciais(nome: string) {
  const palavras = nome.split(/\s+/).filter((p) => p.length > 2 && !/^(de|da|do|das|dos)$/i.test(p));
  return (palavras[0]?.[0] ?? "") + (palavras[1]?.[0] ?? "");
}

/**
 * Logo/brasao em quadro. Sem imagem (ou se a imagem falhar), mostra as iniciais.
 */
export function Logo({ url, nome, tamanho = "md" }: { url?: string | null; nome: string; tamanho?: keyof typeof TAMANHOS }) {
  const [falhou, setFalhou] = useState(false);
  // Imagem nova (trocou a logo): tenta carregar de novo
  useEffect(() => setFalhou(false), [url]);
  const classe = `${TAMANHOS[tamanho]} shrink-0 overflow-hidden rounded-xl border border-slate-200`;

  if (url && !falhou) {
    return (
      <div className={`${classe} fundo-imagem p-1.5`}>
        <img
          src={urlDaApi(url)}
          alt={`Logo de ${nome}`}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setFalhou(true)}
        />
      </div>
    );
  }
  return (
    <div className={`${classe} flex items-center justify-center bg-blue-50 font-bold uppercase text-blue-800`} aria-hidden="true">
      {iniciais(nome)}
    </div>
  );
}

/**
 * Logo ocupando o quadro inteiro (cartoes de Prefeitura/Camara).
 * A imagem preenche a area sem cortar (object-contain); sem logo, iniciais grandes.
 */
export function LogoQuadro({ url, nome }: { url?: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  // Imagem nova (trocou a logo): tenta carregar de novo
  useEffect(() => setFalhou(false), [url]);
  return (
    <div className={`aspect-square w-full overflow-hidden border-b border-slate-200 ${url && !falhou ? "fundo-imagem" : ""}`}>
      {url && !falhou ? (
        <img
          src={urlDaApi(url)}
          alt={`Logo de ${nome}`}
          className="h-full w-full object-contain p-2 sm:p-3"
          loading="lazy"
          onError={() => setFalhou(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-blue-50 text-5xl font-bold uppercase text-blue-800 sm:text-7xl"
          aria-hidden="true"
        >
          {iniciais(nome)}
        </div>
      )}
    </div>
  );
}

/**
 * Logo que ocupa toda a altura da linha (lista de publicacoes).
 * Fica a esquerda do cartao, com largura fixa e a altura do cartao.
 */
export function LogoLinha({ url, nome }: { url?: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [url]);
  return (
    <div className={`flex w-28 shrink-0 items-center justify-center self-stretch border-r border-slate-200 sm:w-32 ${url && !falhou ? "fundo-imagem" : ""}`}>
      {url && !falhou ? (
        <img
          src={urlDaApi(url)}
          alt={`Logo de ${nome}`}
          className="h-full w-full object-contain p-1.5 sm:p-2"
          loading="lazy"
          onError={() => setFalhou(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-blue-50 text-3xl font-bold uppercase text-blue-800" aria-hidden="true">
          {iniciais(nome)}
        </div>
      )}
    </div>
  );
}

// Botao "voltar" grande e facil de achar
export function BotaoVoltar({ para, rotulo }: { para: string; rotulo: string }) {
  return (
    <Link
      to={para}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <span aria-hidden="true">←</span> {rotulo}
    </Link>
  );
}

/**
 * Envio/troca/remocao de logo no painel.
 * onEnviar/onRemover fazem a chamada na API; aqui so cuida da tela.
 */
export function EditorLogo({
  url,
  nome,
  onEnviar,
  onRemover,
  dica = "PNG, JPG ou WEBP até 2 MB. De preferência quadrada e com fundo transparente.",
  oQue = "logo",
}: {
  url?: string | null;
  nome: string;
  onEnviar: (arquivo: File) => Promise<unknown>;
  onRemover: () => Promise<unknown>;
  dica?: string;
  oQue?: string; // "logo", "foto"...
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<unknown>) {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(msg ?? "Não foi possível salvar a imagem.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Logo url={url} nome={nome} tamanho="lg" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <label
            className={`cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 ${
              ocupado ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {ocupado ? "Enviando..." : url ? `Trocar ${oQue}` : `Enviar ${oQue}`}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label={`Logo de ${nome}`}
              disabled={ocupado}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) executar(() => onEnviar(arquivo));
              }}
            />
          </label>
          {url && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => executar(onRemover)}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Remover
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">{dica}</p>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      </div>
    </div>
  );
}
