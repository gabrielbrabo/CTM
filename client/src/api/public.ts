import { http } from "./http";
import { MunicipioDetalhe, MunicipioResumo, OrgaoResumo } from "./types";

export const publicApi = {
  municipios: () => http.get<MunicipioResumo[]>("/public/municipios").then((r) => r.data),

  municipio: (slug: string) =>
    http
      .get<{ municipio: MunicipioDetalhe; orgaos: OrgaoResumo[] }>(`/public/m/${encodeURIComponent(slug)}`)
      .then((r) => r.data),
};

// ---------- Feed e publicacoes ----------

export interface ItemFeed {
  tipo: string;
  detalhes: Record<string, unknown>;
  titulo: string;
  slug: string;
  numero: string | null;
  resumo: string | null;
  publicadoEm: string;
  corrigidoEm: string | null;
  confiabilidade: string;
  totalAnexos: number;
  anexos?: { nome: string; mime: string; tamanho: number; url: string }[];
  orgao: { nome: string; tipo: string; logoUrl?: string | null } | null;
  autores?: VereadorResumo[];
}

// Vereador resumido (autores, votos, presenca)
export interface VereadorResumo {
  id: string;
  nome: string;
  partido: string | null;
  fotoUrl: string | null;
}

export interface VinculosPublicos {
  autores: VereadorResumo[];
  relator: VereadorResumo | null;
  votos: { vereador: VereadorResumo; voto: string }[];
  presencas: { vereador: VereadorResumo; situacao: string }[];
}

export interface PublicacaoPublica {
  municipio: { nome: string; uf: string; slug: string; brasaoUrl?: string | null };
  orgao: { nome: string; tipo: string; logoUrl?: string | null };
  publicacao: {
    tipo: string;
    detalhes: Record<string, unknown>;
    titulo: string;
    slug: string;
    numero: string | null;
    dataReferencia: string | null;
    resumo: string | null;
    conteudo: string | null;
    fonte: { nome?: string; url?: string };
    confiabilidade: string;
    publicadoEm: string;
    corrigidoEm: string | null;
    anexos: { id: string; nome: string; mime: string; tamanho: number; url: string; noCorpo?: boolean }[];
    vereadores?: VinculosPublicos;
    historico: { evento: string; data: string; motivo: string | null }[];
  };
}

export const feedApi = {
  feed: (
    slug: string,
    params: { orgao?: string; tipo?: string; q?: string; de?: string; ate?: string; pagina?: number; vereador?: string }
  ) =>
    http
      .get<{ total: number; pagina: number; paginas: number; porTipo?: { tipo: string; total: number }[]; itens: ItemFeed[] }>(
        `/public/m/${encodeURIComponent(slug)}/feed`,
        { params }
      )
      .then((r) => r.data),

  publicacao: (slug: string, pubSlug: string) =>
    http
      .get<PublicacaoPublica>(`/public/m/${encodeURIComponent(slug)}/p/${encodeURIComponent(pubSlug)}`)
      .then((r) => r.data),
};

// ---------- Vereadores (portal) ----------

export interface VereadorPublico {
  id: string;
  nome: string;
  nomeParlamentar: string | null;
  partido: string | null;
  cargoMesa: string;
  cargoNome: string;
  situacao: string;
  legislatura: string | null;
  fotoUrl: string | null;
}

export interface PerfilVereador {
  camara: { nome: string; logoUrl: string | null };
  vereador: VereadorPublico & {
    mandatoInicio: string | null;
    mandatoFim: string | null;
    email: string | null;
    telefone: string | null;
    gabinete: string | null;
    redeSocial: string | null;
    biografia: string | null;
  };
  autorias: { total: number; porTipo: { tipo: string; total: number }[] };
  votos: { titulo: string; slug: string; tipo: string; numero: string | null; data: string; resultado: string | null; voto: string | null }[];
  presencas: {
    total: number;
    presente: number;
    ausente: number;
    justificada: number;
    ultimas: { titulo: string; slug: string; data: string; situacao: string }[];
  };
}

export const vereadoresApi = {
  lista: (slug: string) =>
    http
      .get<{ camara: { nome: string; logoUrl: string | null }; vereadores: VereadorPublico[] }>(`/public/m/${encodeURIComponent(slug)}/vereadores`)
      .then((r) => r.data),
  perfil: (slug: string, id: string) =>
    http.get<PerfilVereador>(`/public/m/${encodeURIComponent(slug)}/vereadores/${encodeURIComponent(id)}`).then((r) => r.data),
};
