// Tipos compartilhados das respostas da API

export type TipoOrgao = "camara" | "prefeitura" | "secretaria" | "comissao" | "unidade";
export type Papel = "admin_orgao" | "editor" | "revisor";
export type SituacaoOrgao = "ativo" | "suspenso" | "encerrado";

export interface MunicipioResumo {
  id: string;
  slug: string;
  nome: string;
  uf: string;
  brasaoUrl?: string | null;
}

export interface MunicipioDetalhe extends MunicipioResumo {
  tema?: { corPrimaria?: string; corSecundaria?: string };
  contatos?: { email?: string; telefone?: string; site?: string; endereco?: string };
}

export interface OrgaoResumo {
  id: string;
  tipo: TipoOrgao;
  nome: string;
  sigla: string | null;
  plenario?: string | null; // Camara
  logoUrl?: string | null;
  contatos?: { email?: string; telefone?: string; whatsapp?: string; endereco?: string; horario?: string; site?: string };
  recebeMensagens?: boolean;
}

export interface Vinculo {
  municipioId: string;
  orgaoId: string;
  papel: Papel;
}

// Acesso do usuario a um orgao, com nomes (vem do /auth/me)
export interface Acesso {
  orgaoId: string;
  orgaoNome: string;
  orgaoTipo: TipoOrgao;
  orgaoLogoUrl?: string | null;
  situacao: SituacaoOrgao;
  municipioId: string;
  municipioNome: string;
  municipioSlug: string;
  uf: string;
  papel: Papel;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  plataformaAdmin: boolean;
  vinculos: Vinculo[];
}

// Historico de movimentacao (log de auditoria)
export interface ItemHistorico {
  id: string;
  data: string;
  acao: string;
  usuario: { id: string; nome: string; email: string } | null;
  entidade: string;
  entidadeId: string | null;
  alvo: string | null;
  municipio: string | null;
  orgao: string | null;
  detalhes: Record<string, unknown> | null;
  ip: string | null;
}

export interface PaginaHistorico {
  total: number;
  pagina: number;
  paginas: number;
  itens: ItemHistorico[];
}

export type FiltroHistorico = { q?: string; acao?: string; de?: string; ate?: string; pagina?: number };
