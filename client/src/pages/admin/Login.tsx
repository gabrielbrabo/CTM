import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { mensagemErro } from "../../api/http";
import { BotaoVoltar } from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";
import { SeletorTema } from "../../lib/tema";
import { SeletorFonte } from "../../lib/fonte";

// Login dos servidores/administradores
export default function Login() {
  const { usuario, acessos, entrar } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Ja logado: quem tem um orgao so entra direto no painel dele
  if (usuario) {
    const destino = !usuario.plataformaAdmin && acessos.length === 1 ? `/admin/o/${acessos[0].orgaoId}` : "/admin";
    return <Navigate to={destino} replace />;
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      // trim: o celular as vezes coloca um espaco no fim do e-mail
      // O redirecionamento acontece acima, assim que o usuario e carregado
      await entrar(email.trim(), senha);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 py-4">
        <BotaoVoltar para="/" rotulo="Voltar ao portal" />
        <div className="flex items-center gap-2">
          <SeletorFonte />
          <SeletorTema />
        </div>
      </div>

      <div className="flex justify-center pt-8 sm:pt-16">
        <form onSubmit={enviar} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">
          <h1 className="text-xl font-bold">Área do servidor</h1>
          <p className="mt-1 text-sm text-slate-600">Entre com seu e-mail e senha.</p>

          <label htmlFor="email" className="mt-6 block text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />

          <label htmlFor="senha" className="mt-4 block text-sm font-medium">
            Senha
          </label>
          <div className="mt-1 flex rounded-lg border border-slate-300 focus-within:border-blue-500">
            <input
              id="senha"
              type={verSenha ? "text" : "password"}
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-l-lg border-0 px-3 py-2 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              className="shrink-0 rounded-r-lg px-3 text-sm font-medium text-blue-700 hover:bg-slate-50"
              aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
            >
              {verSenha ? "Esconder" : "Mostrar"}
            </button>
          </div>

          {erro && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-6 w-full rounded-lg bg-blue-700 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
