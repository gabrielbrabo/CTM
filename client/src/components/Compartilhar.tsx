import { useAvisos } from "../lib/avisos";

/**
 * Compartilhar SOMENTE a publicacao (o link da pagina dela no portal).
 * WhatsApp, Facebook, copiar link e o menu de compartilhar do celular.
 */
export function Compartilhar({ titulo, url, compacto = false }: { titulo: string; url: string; compacto?: boolean }) {
  const { avisar } = useAvisos();
  const texto = encodeURIComponent(`${titulo}\n${url}`);
  const classe = `inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white font-medium hover:bg-slate-50 ${
    compacto ? "px-3 py-1.5 text-sm" : "px-3 py-1.5 text-sm"
  }`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      avisar("sucesso", "Link da publicação copiado.");
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Compartilhar a publicação">
      <span className="text-sm text-slate-600">Compartilhar:</span>
      <a className={`${classe} text-green-700`} href={`https://wa.me/?text=${texto}`} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      <a
        className={`${classe} text-blue-800`}
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noreferrer"
      >
        Facebook
      </a>
      <button type="button" className={classe} onClick={copiar}>
        Copiar link
      </button>
      {"share" in navigator && (
        <button
          type="button"
          className={`${classe} sm:hidden`}
          onClick={() => navigator.share({ title: titulo, url }).catch(() => undefined)}
        >
          Mais…
        </button>
      )}
    </div>
  );
}
