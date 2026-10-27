import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { DadosConta, cidadaoApi, renovarTokenCidadao, setTokenCidadao } from "../api/cidadao";

/**
 * Sessao da conta da populacao (portal). Ler o portal nao precisa de conta.
 * Os contadores do sininho sao atualizados a cada minuto.
 */
interface Contexto {
  carregando: boolean;
  conta: DadosConta | null;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (d: { nome: string; email: string; telefone?: string; senha: string }) => Promise<void>;
  sair: () => Promise<void>;
  atualizar: () => void;
  segue: (slug: string) => boolean;
}

const CidadaoContext = createContext<Contexto | null>(null);

export function CidadaoProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [logado, setLogado] = useState(false);
  const [iniciando, setIniciando] = useState(true);

  // Ao abrir o site, tenta recuperar a sessao pelo cookie
  useEffect(() => {
    renovarTokenCidadao()
      .then((t) => setLogado(Boolean(t)))
      .finally(() => setIniciando(false));
  }, []);

  const conta = useQuery({
    queryKey: ["cidadao", "eu"],
    queryFn: cidadaoApi.eu,
    enabled: logado,
    refetchInterval: 60_000, // sininho atualiza sozinho
    refetchOnWindowFocus: true,
    retry: false,
  });

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await cidadaoApi.entrar(email, senha);
    setTokenCidadao(r.accessToken);
    setLogado(true);
  }, []);

  const cadastrar = useCallback(async (d: { nome: string; email: string; telefone?: string; senha: string }) => {
    const r = await cidadaoApi.cadastrar(d);
    setTokenCidadao(r.accessToken);
    setLogado(true);
  }, []);

  const sair = useCallback(async () => {
    try {
      await cidadaoApi.sair();
    } finally {
      setTokenCidadao(null);
      setLogado(false);
      qc.removeQueries({ queryKey: ["cidadao"] });
    }
  }, [qc]);

  const atualizar = useCallback(() => qc.invalidateQueries({ queryKey: ["cidadao"] }), [qc]);
  const dados = logado ? (conta.data ?? null) : null;

  return (
    <CidadaoContext.Provider
      value={{
        carregando: iniciando || (logado && conta.isLoading),
        conta: dados,
        entrar,
        cadastrar,
        sair,
        atualizar,
        segue: (slug) => Boolean(dados?.seguindo.some((m) => m.slug === slug)),
      }}
    >
      {children}
    </CidadaoContext.Provider>
  );
}

export function useCidadao() {
  const ctx = useContext(CidadaoContext);
  if (!ctx) throw new Error("useCidadao precisa estar dentro de <CidadaoProvider>");
  return ctx;
}
