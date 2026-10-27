import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// URL base da API: aceita VITE_API_URL com ou sem "/api" no final
const urlApi = String(import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

// Monta a URL completa de um caminho da API (ex.: links de download de anexos)
export const urlDaApi = (caminho: string) => `${urlApi}${caminho}`;

// Cliente HTTP unico do app
export const http = axios.create({
  baseURL: `${urlApi}/api`,
  withCredentials: true, // envia o cookie do refresh token
});

// Access token fica so em memoria (mais seguro que localStorage)
let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Se der 401, tenta renovar o token uma vez e repete a requisicao
let renovando: Promise<string | null> | null = null;

export async function renovarToken(): Promise<string | null> {
  if (!renovando) {
    renovando = http
      .post<{ accessToken: string }>("/auth/refresh")
      .then((r) => {
        setAccessToken(r.data.accessToken);
        return r.data.accessToken;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        renovando = null;
      });
  }
  return renovando;
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _repetida?: boolean }) | undefined;
    const ehRotaAuth = original?.url?.startsWith("/auth/");
    if (error.response?.status === 401 && original && !original._repetida && !ehRotaAuth) {
      original._repetida = true;
      const novo = await renovarToken();
      if (novo) return http(original);
    }
    return Promise.reject(error);
  }
);

// Extrai a mensagem de erro da API para mostrar na tela
export function mensagemErro(err: unknown, padrao = "Algo deu errado. Tente novamente."): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string } | undefined)?.message;
    if (msg) return msg;
    if (!err.response) return "Nao foi possivel conectar ao servidor.";
  }
  return padrao;
}

// Abre um arquivo protegido do painel (precisa do token) em nova aba
export async function abrirArquivoProtegido(caminho: string) {
  const aba = window.open("", "_blank");
  try {
    const r = await http.get(caminho.replace(/^\/api/, ""), { responseType: "blob" });
    const url = URL.createObjectURL(r.data as Blob);
    if (aba) aba.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    aba?.close();
    throw err;
  }
}
