import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "../api/auth";
import { renovarToken, setAccessToken } from "../api/http";
import { Acesso, MunicipioResumo, Usuario } from "../api/types";

interface AuthState {
  usuario: Usuario | null;
  municipios: MunicipioResumo[];
  acessos: Acesso[];
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [municipios, setMunicipios] = useState<MunicipioResumo[]>([]);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarMe = useCallback(async () => {
    const dados = await authApi.me();
    setUsuario(dados.usuario);
    setMunicipios(dados.municipios);
    setAcessos(dados.acessos);
    return dados;
  }, []);

  // Ao abrir o site, tenta recuperar a sessao pelo cookie de refresh
  useEffect(() => {
    (async () => {
      try {
        const token = await renovarToken();
        if (token) await carregarMe();
      } catch {
        setUsuario(null);
      } finally {
        setCarregando(false);
      }
    })();
  }, [carregarMe]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const { accessToken } = await authApi.login(email, senha);
      setAccessToken(accessToken);
      await carregarMe();
    },
    [carregarMe]
  );

  const sair = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUsuario(null);
      setMunicipios([]);
      setAcessos([]);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, municipios, acessos, carregando, entrar, sair }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro do AuthProvider");
  return ctx;
}
