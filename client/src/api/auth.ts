import { http } from "./http";
import { Acesso, MunicipioResumo, Usuario } from "./types";

export const authApi = {
  login: (email: string, senha: string) =>
    http.post<{ accessToken: string; usuario: Usuario }>("/auth/login", { email, senha }).then((r) => r.data),

  logout: () => http.post("/auth/logout"),

  // Sininho do painel: mensagens da populacao nao lidas por orgao
  avisos: () =>
    http
      .get<{ total: number; orgaos: { orgaoId: string; orgaoNome: string; mensagensNaoLidas: number }[] }>("/auth/avisos")
      .then((r) => r.data),
  me: () => http.get<{ usuario: Usuario; municipios: MunicipioResumo[]; acessos: Acesso[] }>("/auth/me").then((r) => r.data),
};
