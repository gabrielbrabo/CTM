import { FormEvent, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cidadaoApi } from "../api/cidadao";
import { mensagemErro } from "../api/http";
import { useCidadao } from "../context/CidadaoContext";
import { useAvisos } from "../lib/avisos";
import { AreaTexto, Botao, Campo } from "./ui";

export interface ContatosOrgao {
  email?: string;
  telefone?: string;
  whatsapp?: string;
  endereco?: string;
  horario?: string;
  site?: string;
}

const soNumeros = (v: string) => v.replace(/\D/g, "");

/**
 * "Fale com a Prefeitura/Camara": contatos (todos veem) + formulario de mensagem
 * (precisa de conta, para o orgao poder responder).
 */
export function FaleComOrgao({
  orgaoId,
  orgaoNome,
  contatos,
  recebeMensagens,
}: {
  orgaoId: string;
  orgaoNome: string;
  contatos: ContatosOrgao;
  recebeMensagens: boolean;
}) {
  const { conta, atualizar } = useCidadao();
  const { avisar } = useAvisos();
  const location = useLocation();
  const [form, setForm] = useState({ assunto: "", texto: "" });
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState<{ id: string; protocolo: string } | null>(null);

  const linhas: { rotulo: string; valor: React.ReactNode }[] = [];
  if (contatos.telefone) linhas.push({ rotulo: "Telefone", valor: <a href={`tel:${soNumeros(contatos.telefone)}`} className="text-blue-700 hover:underline">{contatos.telefone}</a> });
  if (contatos.whatsapp)
    linhas.push({
      rotulo: "WhatsApp",
      valor: (
        <a href={`https://wa.me/55${soNumeros(contatos.whatsapp).replace(/^55/, "")}`} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
          {contatos.whatsapp}
        </a>
      ),
    });
  if (contatos.email) linhas.push({ rotulo: "E-mail", valor: <a href={`mailto:${contatos.email}`} className="break-all text-blue-700 hover:underline">{contatos.email}</a> });
  if (contatos.endereco) linhas.push({ rotulo: "Endereço", valor: contatos.endereco });
  if (contatos.horario) linhas.push({ rotulo: "Horário de atendimento", valor: contatos.horario });
  if (contatos.site)
    linhas.push({ rotulo: "Site", valor: <a href={contatos.site} target="_blank" rel="noreferrer" className="break-all text-blue-700 hover:underline">{contatos.site}</a> });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const m = await cidadaoApi.enviarMensagem({ orgaoId, assunto: form.assunto.trim(), texto: form.texto.trim() });
      setEnviada({ id: m.id, protocolo: m.protocolo });
      setForm({ assunto: "", texto: "" });
      atualizar();
      avisar("sucesso", `Mensagem enviada. Protocolo ${m.protocolo}.`);
    } catch (err) {
      avisar("erro", mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section id="contato" className="mt-10 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
      <div>
        <h2 className="text-lg font-semibold">Fale com {orgaoNome}</h2>
        {linhas.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">O órgão ainda não informou os dados de contato.</p>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            {linhas.map((l) => (
              <div key={l.rotulo}>
                <dt className="text-xs font-semibold uppercase text-slate-500">{l.rotulo}</dt>
                <dd className="text-slate-800">{l.valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="rounded-xl bg-slate-50 p-4">
        <h3 className="font-semibold">Enviar mensagem</h3>
        {!recebeMensagens ? (
          <p className="mt-2 text-sm text-slate-600">Este órgão não recebe mensagens pelo portal. Use os contatos ao lado.</p>
        ) : !conta ? (
          <div className="mt-2 space-y-3 text-sm text-slate-600">
            <p>Para enviar uma mensagem e receber a resposta, entre na sua conta (é rápido e gratuito).</p>
            <div className="flex flex-wrap gap-2">
              <Link to={`/entrar?voltar=${encodeURIComponent(location.pathname + "#contato")}`} className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800">
                Entrar
              </Link>
              <Link
                to={`/entrar?aba=cadastro&voltar=${encodeURIComponent(location.pathname + "#contato")}`}
                className="rounded-lg border border-blue-600 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50"
              >
                Criar conta
              </Link>
            </div>
          </div>
        ) : enviada ? (
          <div className="mt-2 space-y-2 text-sm">
            <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-900">
              Mensagem enviada! Protocolo <strong>{enviada.protocolo}</strong>. Você será avisado(a) no sininho quando o órgão responder.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to={`/minha-conta/mensagens/${enviada.id}`} className="font-medium text-blue-700 hover:underline">
                Acompanhar a mensagem
              </Link>
              <button type="button" className="text-slate-600 hover:underline" onClick={() => setEnviada(null)}>
                Enviar outra
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-2 space-y-3">
            <Campo label="Assunto" required maxLength={150} value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
            <AreaTexto label="Mensagem" required rows={5} maxLength={5000} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
            <p className="text-xs text-slate-500">Enviando como {conta.cidadao.nome} ({conta.cidadao.email}).</p>
            <Botao type="submit" disabled={enviando || form.assunto.trim().length < 3 || form.texto.trim().length < 5}>
              {enviando ? "Enviando..." : "Enviar mensagem"}
            </Botao>
          </form>
        )}
      </div>
    </section>
  );
}
