import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { mensagemErro } from "../../../api/http";
import { orgaoApi } from "../../../api/orgao";
import { Aviso, Botao } from "../../../components/ui";

export interface TextoImportado {
  texto: string;
  tituloSugerido: string;
  arquivo: File;
  modo: "substituir" | "adicionar";
  anexarOriginal: boolean;
  // true: o arquivo (escaneado/foto) aparece no lugar do texto; nao ha texto lido
  comoDocumento: boolean;
  escaneado?: boolean; // era um PDF sem texto
}

// As duas formas de usar o arquivo, com a recomendacao de cada uma
const OPCOES = [
  {
    valor: "ler",
    rotulo: "Ler o texto do arquivo",
    dica: "O texto do arquivo vai para o “Texto completo”, e a população pode ler e buscar por palavras.",
    recomendado:
      "documentos digitados, sem assinatura à mão: Word (.docx), ODT ou PDF gerado no computador (“Salvar como PDF”).",
    observacao: "Foto também funciona (leitura por OCR), mas pode ter erros: revise o texto antes de publicar.",
  },
  {
    valor: "documento",
    rotulo: "Mostrar o documento no lugar do texto",
    dica: "O próprio documento aparece na publicação, igual ao original. Você só preenche título e dados.",
    recomendado:
      "documentos assinados, escaneados, com carimbo, brasão ou tabelas — PDF (de preferência) ou imagem JPG/PNG.",
    observacao: "Preencha título, número e resumo para a população encontrar o documento na busca.",
  },
] as const;

const PODE_DOCUMENTO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * "Criar a partir de um arquivo", dois jeitos:
 * - Ler o texto: PDF, Word, ODT, TXT ou imagem (OCR) -> preenche o "Texto completo"
 * - Mostrar o documento: PDF escaneado ou foto aparece no lugar do texto
 *   (o usuario so preenche titulo e os outros dados)
 * PDF sem texto (escaneado) cai automaticamente no segundo jeito.
 */
export default function ImportarArquivo({
  orgaoId,
  temTexto,
  onImportar,
}: {
  orgaoId: string;
  temTexto: boolean;
  onImportar: (r: TextoImportado) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // O arquivo enviado sempre fica disponivel para download na publicacao
  const anexarOriginal = true;
  // Comeca sem nenhuma opcao marcada: o usuario precisa decidir
  const [jeito, setJeito] = useState<"ler" | "documento" | null>(null);
  const [resultado, setResultado] = useState<{ texto: string; tituloSugerido: string; metodo: string; arquivo: File } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const extrair = useMutation({
    mutationFn: (arquivo: File) => orgaoApi(orgaoId).extrairTexto(arquivo).then((r) => ({ ...r, arquivo })),
    onSuccess: (r) => {
      // PDF escaneado: mostra o documento no lugar do texto
      if (r.semTexto) {
        usarComoDocumento(r.arquivo, r.tituloSugerido, true);
        return;
      }
      setResultado(r);
      // Se o editor ainda esta vazio, ja aplica direto
      if (!temTexto) aplicar(r, "substituir");
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function usarComoDocumento(arquivo: File, tituloSugerido: string, escaneado = false) {
    onImportar({ texto: "", tituloSugerido, arquivo, modo: "adicionar", anexarOriginal: true, comoDocumento: true, escaneado });
    if (inputRef.current) inputRef.current.value = "";
  }

  function aplicar(r: NonNullable<typeof resultado>, modo: "substituir" | "adicionar") {
    onImportar({ texto: r.texto, tituloSugerido: r.tituloSugerido, arquivo: r.arquivo, modo, anexarOriginal, comoDocumento: false });
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const ehImagem = (f?: File) => Boolean(f?.type.startsWith("image/"));

  return (
    <section className="rounded-xl border border-dashed border-blue-300 bg-blue-50/60 p-4">
      <h2 className="font-semibold text-slate-800">Criar a partir de um arquivo</h2>
      <fieldset className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <legend className="sr-only">Como usar o arquivo</legend>
        {OPCOES.map((o) => (
          <label
            key={o.valor}
            className={`flex cursor-pointer gap-2 rounded-lg border bg-white p-3 ${
              jeito === o.valor ? "border-blue-600 ring-1 ring-blue-600" : "border-slate-300"
            }`}
          >
            <input type="radio" name="jeito-importar" className="mt-1" checked={jeito === o.valor} onChange={() => setJeito(o.valor)} />
            <span>
              <span className="block font-medium">{o.rotulo}</span>
              <span className="block text-xs text-slate-600">{o.dica}</span>
              {/* Aviso: para que tipo de documento esta opcao e recomendada */}
              <span className="mt-2 block rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                <strong>Recomendado para:</strong> {o.recomendado}
              </span>
              <span className="mt-1 block text-xs text-slate-500">{o.observacao}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {!jeito && (
        <p className="mt-3 text-sm font-medium text-amber-800">Escolha acima como o arquivo será usado para liberar o envio.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          aria-label="Arquivo para extrair o texto"
          accept={jeito === "documento" ? ".pdf,.jpg,.jpeg,.png,.webp" : ".pdf,.docx,.doc,.odt,.txt,.csv,.jpg,.jpeg,.png,.webp"}
          disabled={!jeito || extrair.isPending}
          className="text-sm disabled:cursor-not-allowed disabled:opacity-50"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (!arquivo) return;
            setErro(null);
            setResultado(null);
            if (jeito === "documento") {
              if (!PODE_DOCUMENTO.includes(arquivo.type)) {
                setErro("Para mostrar no lugar do texto, envie um PDF ou imagem (JPG, PNG, WEBP).");
                return;
              }
              usarComoDocumento(arquivo, arquivo.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
            } else {
              extrair.mutate(arquivo);
            }
          }}
        />
      </div>

      {/* Aviso: o arquivo sempre vai para download */}
      <p className="mt-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-2.5 text-sm text-green-900">
        <span aria-hidden="true">⬇</span>
        <span>
          O arquivo enviado <strong>sempre fica disponível para download</strong> na publicação (portal e impressão de anexos).
        </span>
      </p>



      {extrair.isPending && (
        <p role="status" className="mt-3 text-sm text-blue-800">
          Lendo o arquivo{ehImagem(extrair.variables) ? " (imagem: pode levar alguns segundos)" : ""}...
        </p>
      )}

      {resultado && temTexto && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p>
            Texto lido de <strong>{resultado.arquivo.name}</strong> ({resultado.metodo}) — {resultado.texto.length} caracteres. O
            campo de texto já tem conteúdo:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Botao type="button" onClick={() => aplicar(resultado, "substituir")}>
              Substituir o texto
            </Botao>
            <Botao type="button" variante="secundario" onClick={() => aplicar(resultado, "adicionar")}>
              Adicionar ao final
            </Botao>
            <Botao type="button" variante="secundario" onClick={() => setResultado(null)}>
              Cancelar
            </Botao>
          </div>
        </div>
      )}

      {erro && (
        <div className="mt-3">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}
    </section>
  );
}
