import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { urlDaApi } from "./http";

/**
 * API da conta da populacao (cidadao). Separada da dos servidores:
 * outro token e outro cookie, para as duas sessoes nao se misturarem.
 */
export const httpCidadao = axios.create({ baseURL: urlDaApi("/api/cidadao"), withCredentials: true });

let token: string | null = null;
export const setTokenCidadao = (t: string | null) => {
  token = t;
};

httpCidadao.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let renovando: Promise<string | null> | null = null;
export function renovarTokenCidadao(): Promise<string | null> {
  if (!renovando) {
    renovando = httpCidadao
      .post<{ accessToken: string }>("/auth/refresh")
      .then((r) => {
        setTokenCidadao(r.data.accessToken);
        return r.data.accessToken;
      })
      .catch(() => {
        setTokenCidadao(null);
        return null;
      })
      .finally(() => {
        renovando = null;
      });
  }
  return renovando;
}

httpCidadao.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _repetida?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._repetida && !original.url?.startsWith("/auth/")) {
      original._repetida = true;
      if (await renovarTokenCidadao()) return httpCidadao(original);
    }
    return Promise.reject(error);
  }
);

export interface Cidadao {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
}

export interface DadosConta {
  cidadao: Cidadao;
  seguindo: { id: string; slug: string; nome: string; uf: string; brasaoUrl: string | null }[];
  notificacoesNaoLidas: number;
  mensagensNaoLidas: number;
}

export interface Notificacao {
  id: string;
  tipo: "publicacao" | "resposta";
  titulo: string;
  texto: string | null;
  link: string;
  lida: boolean;
  criadaEm: string;
}

export interface OrgaoDaMensagem {
  nome: string;
  tipo: string;
  logoUrl: string | null;
  municipio: string;
  municipioSlug: string;
}

export interface MensagemCidadao {
  id: string;
  protocolo: string;
  assunto: string;
  situacao: "aberta" | "respondida" | "encerrada";
  lida: boolean;
  criadaEm: string;
  ultimaAtividade: string;
  orgao: OrgaoDaMensagem | null;
  total?: number;
  respostas?: { autor: "cidadao" | "servidor"; nome: string; texto: string; data: string }[];
}

type Entrada = { accessToken: string; cidadao: Cidadao };

export const cidadaoApi = {
  cadastrar: (d: { nome: string; email: string; telefone?: string; senha: string }) =>
    httpCidadao.post<Entrada>("/auth/cadastro", d).then((r) => r.data),
  entrar: (email: string, senha: string) => httpCidadao.post<Entrada>("/auth/login", { email, senha }).then((r) => r.data),
  sair: () => httpCidadao.post("/auth/logout").then((r) => r.data),
  eu: () => httpCidadao.get<DadosConta>("/eu").then((r) => r.data),

  seguir: (municipio: string) => httpCidadao.post("/inscricoes", { municipio }).then((r) => r.data),
  deixarDeSeguir: (municipio: string) => httpCidadao.delete(`/inscricoes/${encodeURIComponent(municipio)}`).then((r) => r.data),

  notificacoes: (pagina = 1) =>
    httpCidadao
      .get<{ total: number; naoLidas: number; pagina: number; paginas: number; itens: Notificacao[] }>("/notificacoes", { params: { pagina } })
      .then((r) => r.data),
  marcarLidas: (ids?: string[]) => httpCidadao.post("/notificacoes/lidas", { ids }).then((r) => r.data),

  mensagens: () => httpCidadao.get<MensagemCidadao[]>("/mensagens").then((r) => r.data),
  mensagem: (id: string) => httpCidadao.get<MensagemCidadao>(`/mensagens/${id}`).then((r) => r.data),
  enviarMensagem: (d: { orgaoId: string; assunto: string; texto: string }) =>
    httpCidadao.post<MensagemCidadao>("/mensagens", d).then((r) => r.data),
  responder: (id: string, texto: string) => httpCidadao.post<MensagemCidadao>(`/mensagens/${id}/responder`, { texto }).then((r) => r.data),
};
