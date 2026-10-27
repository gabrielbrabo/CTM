import { FormEvent, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { mensagemErro } from "../../api/http";
import { Campo } from "../../components/ui";
import { useCidadao } from "../../context/CidadaoContext";
import { useAvisos } from "../../lib/avisos";

/**
 * Entrar ou criar conta (populacao).
 * A conta so e necessaria para mandar mensagens e receber notificacoes.
 */
export default function EntrarPage() {
  const [params] = useSearchParams();
  const voltar = params.get("voltar") || "/";
  const { conta, entrar, cadastrar } = useCidadao();
  const { avisar } = useAvisos();
  const navigate = useNavigate();
  const [aba, setAba] = useState<"entrar" | "cadastro">(params.get("aba") === "cadastro" ? "cadastro" : "entrar");
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", senha: "", senha2: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (conta) return <Navigate to={voltar} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (aba === "cadastro" && form.senha !== form.senha2) {
      setErro("As senhas não são iguais.");
      return;
    }
    setEnviando(true);
    try {
      if (aba === "entrar") await entrar(form.email.trim(), form.senha);
      else await cadastrar({ nome: form.nome.trim(), email: form.email.trim(), telefone: form.telefone.trim(), senha: form.senha });
      avisar("sucesso", aba === "entrar" ? "Você entrou na sua conta." : "Conta criada! Bem-vindo(a).");
      navigate(voltar, { replace: true });
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-center text-2xl font-bold">Sua conta no portal</h1>
      <p className="mt-1 text-center text-sm text-slate-600">
        Para <strong>ler</strong> as publicações não precisa de conta. Com a conta você pode <strong>mandar mensagens</strong> para a
        Prefeitura e a Câmara e <strong>receber notificações</strong> das publicações.
      </p>

      <div role="tablist" className="mt-6 grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1">
        {(
          [
            ["entrar", "Já tenho conta"],
            ["cadastro", "Criar conta"],
          ] as const
        ).map(([v, r]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={aba === v}
            onClick={() => {
              setAba(v);
              setErro(null);
            }}
            className={`rounded-lg py-2 text-sm font-medium ${aba === v ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {r}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        {aba === "cadastro" && <Campo label="Nome completo" required autoComplete="name" value={form.nome} onChange={set("nome")} />}
        <Campo label="E-mail" type="email" required autoComplete="email" autoCapitalize="none" value={form.email} onChange={set("email")} />
        {aba === "cadastro" && (
          <Campo label="Telefone / WhatsApp (opcional)" type="tel" autoComplete="tel" value={form.telefone} onChange={set("telefone")} />
        )}
        <Campo
          label="Senha"
          type="password"
          required
          minLength={aba === "cadastro" ? 8 : undefined}
          autoComplete={aba === "entrar" ? "current-password" : "new-password"}
          dica={aba === "cadastro" ? "Mínimo de 8 caracteres." : undefined}
          value={form.senha}
          onChange={set("senha")}
        />
        {aba === "cadastro" && (
          <Campo label="Repita a senha" type="password" required autoComplete="new-password" value={form.senha2} onChange={set("senha2")} />
        )}
        {erro && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {erro}
          </p>
        )}
        <button type="submit" disabled={enviando} className="w-full rounded-lg bg-blue-700 py-2.5 font-medium text-white hover:bg-blue-800 disabled:opacity-60">
          {enviando ? "Aguarde..." : aba === "entrar" ? "Entrar" : "Criar minha conta"}
        </button>
        {aba === "cadastro" && (
          <p className="text-xs text-slate-500">
            Seus dados são usados só para responder suas mensagens e enviar as notificações que você ativar.
          </p>
        )}
      </form>
    </div>
  );
}
