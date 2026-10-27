import { http } from "./http";
import { FiltroHistorico, PaginaHistorico, Papel, SituacaoOrgao } from "./types";

// Tipos e chamadas da area da plataforma (superadmin GADZ)

export interface Contrato {
  numero: string | null;
  inicio: string | null;
  fim: string | null;
  valorMensal: number | null;
  observacoes: string | null;
}

export interface OrgaoPlataforma {
  id: string;
  tipo: "prefeitura" | "camara";
  nome: string;
  sigla: string | null;
  cnpj: string | null;
  logoUrl?: string | null;
  situacao: SituacaoOrgao;
  contatos: { email?: string; telefone?: string; site?: string; endereco?: string; horario?: string; whatsapp?: string };
  recebeMensagens?: boolean;
  responsavel: { nome?: string; cargo?: string };
  plenario?: string | null;
  contrato: Contrato | null;
  criadoEm: string | null;
  municipio: { id: string; nome: string; uf: string; slug: string } | null;
  totalUsuarios?: number;
}

export interface UsuarioOrgao {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  plataformaAdmin: boolean;
  ultimoLogin: string | null;
  papel: Papel | null;
  criado?: boolean;
}

export interface UsuarioPlataforma extends UsuarioOrgao {
  acessos: { orgaoId: string; orgaoNome: string; municipio: string; papel: Papel }[];
}

export interface MunicipioPlataforma {
  id: string;
  nome: string;
  uf: string;
  slug: string;
  ativo: boolean;
  brasaoUrl?: string | null;
  orgaos: { id: string; tipo: string; nome: string; situacao: SituacaoOrgao }[];
}

export interface Resumo {
  municipios: number;
  usuarios: number;
  orgaos: { ativo: number; suspenso: number; encerrado: number; prefeituras: number; camaras: number };
  contratosVencendo: OrgaoPlataforma[];
  contratosVencidos: OrgaoPlataforma[];
}

// Dados enviados nos formularios (strings vazias sao aceitas pela API)
export interface DadosOrgaoForm {
  nome?: string;
  sigla?: string;
  cnpj?: string;
  situacao?: SituacaoOrgao;
  contatos?: { email?: string; telefone?: string; site?: string; endereco?: string; horario?: string; whatsapp?: string };
  recebeMensagens?: boolean;
  responsavel?: { nome?: string; cargo?: string };
  plenario?: string;
  contrato?: { numero?: string; inicio?: string; fim?: string; valorMensal?: string | number; observacoes?: string };
}

export interface NovoOrgaoForm extends DadosOrgaoForm {
  tipo: "prefeitura" | "camara";
  municipioId?: string;
  novoMunicipio?: { nome: string; uf: string };
  // Novo usuario (nome/e-mail/senha) OU um usuario ja cadastrado (usuarioId)
  admin: { nome: string; email: string; senha?: string } | { usuarioId: string };
}

export const platformApi = {
  resumo: () => http.get<Resumo>("/platform/resumo").then((r) => r.data),

  municipios: () => http.get<MunicipioPlataforma[]>("/platform/municipios").then((r) => r.data),
  criarMunicipio: (d: { nome: string; uf: string }) => http.post("/platform/municipios", d).then((r) => r.data),
  editarMunicipio: (id: string, d: { nome?: string; uf?: string; ativo?: boolean }) =>
    http.patch(`/platform/municipios/${id}`, d).then((r) => r.data),

  orgaos: () => http.get<OrgaoPlataforma[]>("/platform/orgaos").then((r) => r.data),
  orgao: (id: string) =>
    http.get<{ orgao: OrgaoPlataforma; usuarios: UsuarioOrgao[] }>(`/platform/orgaos/${id}`).then((r) => r.data),
  criarOrgao: (d: NovoOrgaoForm) =>
    http.post<{ orgao: OrgaoPlataforma; admin: UsuarioOrgao }>("/platform/orgaos", d).then((r) => r.data),
  editarOrgao: (id: string, d: DadosOrgaoForm) =>
    http.patch<OrgaoPlataforma>(`/platform/orgaos/${id}`, d).then((r) => r.data),
  adicionarUsuario: (orgaoId: string, d: { nome: string; email: string; senha?: string; papel: Papel }) =>
    http.post<UsuarioOrgao>(`/platform/orgaos/${orgaoId}/usuarios`, d).then((r) => r.data),
  removerUsuario: (orgaoId: string, usuarioId: string) =>
    http.delete(`/platform/orgaos/${orgaoId}/usuarios/${usuarioId}`).then((r) => r.data),

  enviarBrasao: (municipioId: string, arquivo: File) => {
    const form = new FormData();
    form.append("imagem", arquivo);
    return http.post<{ brasaoUrl: string | null }>(`/platform/municipios/${municipioId}/brasao`, form).then((r) => r.data);
  },
  removerBrasao: (municipioId: string) => http.delete(`/platform/municipios/${municipioId}/brasao`).then((r) => r.data),
  enviarLogoOrgao: (orgaoId: string, arquivo: File) => {
    const form = new FormData();
    form.append("imagem", arquivo);
    return http.post<{ logoUrl: string | null }>(`/platform/orgaos/${orgaoId}/logo`, form).then((r) => r.data);
  },
  removerLogoOrgao: (orgaoId: string) => http.delete(`/platform/orgaos/${orgaoId}/logo`).then((r) => r.data),

  historico: (f: FiltroHistorico) =>
    http.get<PaginaHistorico>("/platform/historico", { params: f }).then((r) => r.data),
  usuarios: (q = "") =>
    http.get<UsuarioPlataforma[]>("/platform/usuarios", { params: q ? { q } : {} }).then((r) => r.data),
  editarUsuario: (id: string, d: { nome?: string; ativo?: boolean; novaSenha?: string }) =>
    http.patch(`/platform/usuarios/${id}`, d).then((r) => r.data),
};
