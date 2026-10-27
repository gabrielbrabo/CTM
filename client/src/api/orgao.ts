import { http } from "./http";
import { FiltroHistorico, PaginaHistorico, Papel, SituacaoOrgao } from "./types";

// Chamadas do painel do orgao (/api/admin/o/:orgaoId)

// Os tipos vem do catalogo da API (Camara, Prefeitura e comuns)
export type TipoPublicacao = string;
export type EstadoPublicacao = "rascunho" | "em_revisao" | "publicado" | "despublicado";
export type Confiabilidade = "oficial" | "pendente_confirmacao";

export interface ContatosOrgaoPainel {
  email?: string;
  telefone?: string;
  whatsapp?: string;
  endereco?: string;
  horario?: string;
  site?: string;
}

export interface MensagemOrgao {
  id: string;
  protocolo: string;
  assunto: string;
  situacao: "aberta" | "respondida" | "encerrada";
  lida: boolean;
  criadaEm: string;
  ultimaAtividade: string;
  cidadao: { nome: string; email: string; telefone: string | null } | null;
  respostas?: { autor: "cidadao" | "servidor"; nome: string; texto: string; data: string }[];
  total?: number;
  previa?: string;
}

export interface PaginaMensagens {
  total: number;
  naoLidas: number;
  pagina: number;
  paginas: number;
  porSituacao: Record<string, number>;
  itens: MensagemOrgao[];
}

export interface PainelOrgao {
  orgao: {
    id: string;
    tipo: string;
    nome: string;
    situacao: SituacaoOrgao;
    exigeRevisao: boolean;
    plenario: string | null;
    logoUrl: string | null;
    contatos: ContatosOrgaoPainel;
    recebeMensagens: boolean;
  };
  mensagensNaoLidas: number;
  municipio: { id: string; nome: string; uf: string; slug: string };
  papel: Papel | null;
  publicacoes: Record<EstadoPublicacao, number>;
}

export interface UsuarioDoOrgao {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  papel: Papel | null;
  ultimoLogin: string | null;
  outrosOrgaos: boolean;
  criado?: boolean;
}

export interface PublicacaoResumo {
  id: string;
  tipo: TipoPublicacao;
  detalhes: Record<string, unknown>;
  titulo: string;
  numero: string | null;
  estado: EstadoPublicacao;
  confiabilidade: Confiabilidade;
  publicadoEm: string | null;
  atualizadoEm: string | null;
  totalAnexos: number;
  anexos?: { nome: string; mime: string; tamanho: number; url: string }[];
}

export interface Anexo {
  id: string;
  nome: string;
  mime: string;
  tamanho: number;
  url: string;
  noCorpo?: boolean; // mostrado no lugar do texto
}

export interface Publicacao {
  id: string;
  tipo: TipoPublicacao;
  detalhes: Record<string, unknown>;
  titulo: string;
  slug: string;
  numero: string | null;
  dataReferencia: string | null;
  resumo: string | null;
  conteudo: string | null;
  fonte: { nome?: string; url?: string };
  confiabilidade: Confiabilidade;
  estado: EstadoPublicacao;
  publicadoEm: string | null;
  corrigidoEm: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  anexos: Anexo[];
  autoresIds: string[];
  relatorId: string | null;
  votos: VotoVereador[];
  presencas: PresencaVereador[];
  historico: { evento: string; data: string; usuarioNome: string | null; motivo: string | null }[];
  permissoes: {
    editar: boolean;
    precisaMotivoParaEditar: boolean;
    enviarRevisao: boolean;
    publicar: boolean;
    devolver: boolean;
    despublicar: boolean;
    excluir: boolean;
  };
}

export interface DadosPublicacao {
  tipo: TipoPublicacao;
  detalhes?: Record<string, unknown>;
  titulo: string;
  numero?: string;
  dataReferencia?: string;
  resumo?: string;
  conteudo?: string;
  fonte?: { nome?: string; url?: string };
  confiabilidade?: Confiabilidade;
  motivo?: string; // so para corrigir publicacao ja publicada
  // Vereadores (Camara)
  autoresIds?: string[];
  relatorId?: string | null;
  votos?: VotoVereador[];
  presencas?: PresencaVereador[];
}

// ---------- Vereadores ----------
export type Voto = "sim" | "nao" | "abstencao" | "ausente";
export type Presenca = "presente" | "ausente" | "justificada";
export interface VotoVereador {
  vereadorId: string;
  voto: Voto;
}
export interface PresencaVereador {
  vereadorId: string;
  situacao: Presenca;
}
export type SituacaoVereador = "exercicio" | "licenciado" | "afastado" | "suplente" | "ex";
export type CargoMesa = "presidente" | "vice_presidente" | "primeiro_secretario" | "segundo_secretario" | "vereador";

export interface Vereador {
  id: string;
  nome: string;
  nomeParlamentar: string | null;
  partido: string | null;
  cargoMesa: CargoMesa;
  situacao: SituacaoVereador;
  legislatura: string | null;
  mandatoInicio: string | null;
  mandatoFim: string | null;
  email: string | null;
  telefone: string | null;
  gabinete: string | null;
  redeSocial: string | null;
  biografia: string | null;
  ordem: number;
  mostrarNoPortal: boolean;
  fotoUrl: string | null;
}

export type DadosVereador = Partial<Omit<Vereador, "id" | "fotoUrl">> & { nome: string };

export const orgaoApi = (orgaoId: string) => {
  const base = `/admin/o/${orgaoId}`;
  return {
    painel: () => http.get<PainelOrgao>(base).then((r) => r.data),
    // Vereadores (so Camara)
    vereadores: () => http.get<Vereador[]>(`${base}/vereadores`).then((r) => r.data),
    criarVereador: (d: DadosVereador) => http.post<Vereador>(`${base}/vereadores`, d).then((r) => r.data),
    editarVereador: (id: string, d: Partial<DadosVereador>) => http.patch<Vereador>(`${base}/vereadores/${id}`, d).then((r) => r.data),
    excluirVereador: (id: string) => http.delete(`${base}/vereadores/${id}`).then((r) => r.data),
    enviarFotoVereador: (id: string, arquivo: File) => {
      const form = new FormData();
      form.append("imagem", arquivo);
      return http.post<Vereador>(`${base}/vereadores/${id}/foto`, form).then((r) => r.data);
    },
    removerFotoVereador: (id: string) => http.delete<Vereador>(`${base}/vereadores/${id}/foto`).then((r) => r.data),
    historico: (f: FiltroHistorico) => http.get<PaginaHistorico>(`${base}/historico`, { params: f }).then((r) => r.data),
    // Mensagens da populacao
    mensagens: (params: { situacao?: string; pagina?: number }) =>
      http.get<PaginaMensagens>(`${base}/mensagens`, { params }).then((r) => r.data),
    mensagem: (id: string) => http.get<MensagemOrgao>(`${base}/mensagens/${id}`).then((r) => r.data),
    responderMensagem: (id: string, texto: string, encerrar = false) =>
      http.post<MensagemOrgao>(`${base}/mensagens/${id}/responder`, { texto, encerrar }).then((r) => r.data),
    situacaoMensagem: (id: string, situacao: "aberta" | "respondida" | "encerrada") =>
      http.post<MensagemOrgao>(`${base}/mensagens/${id}/situacao`, { situacao }).then((r) => r.data),
    config: (d: { exigeRevisao?: boolean; plenario?: string; contatos?: ContatosOrgaoPainel; recebeMensagens?: boolean }) => http.patch(`${base}/config`, d).then((r) => r.data),
    enviarLogo: (arquivo: File) => {
      const form = new FormData();
      form.append("imagem", arquivo);
      return http.post<{ logoUrl: string | null }>(`${base}/logo`, form).then((r) => r.data);
    },
    removerLogo: () => http.delete(`${base}/logo`).then((r) => r.data),

    usuarios: () => http.get<UsuarioDoOrgao[]>(`${base}/usuarios`).then((r) => r.data),
    criarUsuario: (d: { nome: string; email: string; senha?: string; papel: Papel }) =>
      http.post<UsuarioDoOrgao>(`${base}/usuarios`, d).then((r) => r.data),
    editarUsuario: (id: string, d: { papel?: Papel; novaSenha?: string }) =>
      http.patch<UsuarioDoOrgao>(`${base}/usuarios/${id}`, d).then((r) => r.data),
    removerUsuario: (id: string) => http.delete(`${base}/usuarios/${id}`).then((r) => r.data),

    extrairTexto: (arquivo: File) => {
      const form = new FormData();
      form.append("arquivo", arquivo);
      return http
        .post<{ texto: string; metodo: string; semTexto?: boolean; tituloSugerido: string; nomeArquivo: string }>(`${base}/extrair-texto`, form, {
          timeout: 120_000,
        })
        .then((r) => r.data);
    },

    publicacoes: (params: { estado?: string; tipo?: string; q?: string; pagina?: number }) =>
      http
        .get<{
          total: number;
          pagina: number;
          paginas: number;
          porTipo?: { tipo: string; total: number }[];
          itens: PublicacaoResumo[];
          exigeRevisao: boolean;
        }>(
          `${base}/publicacoes`,
          { params }
        )
        .then((r) => r.data),
    publicacao: (id: string) => http.get<Publicacao>(`${base}/publicacoes/${id}`).then((r) => r.data),
    criar: (d: DadosPublicacao) => http.post<Publicacao>(`${base}/publicacoes`, d).then((r) => r.data),
    editar: (id: string, d: Partial<DadosPublicacao>) =>
      http.patch<Publicacao>(`${base}/publicacoes/${id}`, d).then((r) => r.data),
    acao: (id: string, acao: "enviar-revisao" | "publicar" | "devolver" | "despublicar", motivo?: string) =>
      http.post<Publicacao>(`${base}/publicacoes/${id}/${acao}`, motivo ? { motivo } : {}).then((r) => r.data),
    excluir: (id: string) => http.delete(`${base}/publicacoes/${id}`).then((r) => r.data),
    enviarAnexo: (id: string, arquivo: File, noCorpo = false) => {
      const form = new FormData();
      if (noCorpo) form.append("noCorpo", "1");
      form.append("arquivo", arquivo);
      return http.post<Publicacao>(`${base}/publicacoes/${id}/anexos`, form).then((r) => r.data);
    },
    // Mostrar (ou nao) o anexo no lugar do texto
    anexoNoCorpo: (id: string, anexoId: string, noCorpo: boolean) =>
      http.patch<Publicacao>(`${base}/publicacoes/${id}/anexos/${anexoId}`, { noCorpo }).then((r) => r.data),
    removerAnexo: (id: string, anexoId: string, motivo?: string) =>
      http
        .delete<Publicacao>(`${base}/publicacoes/${id}/anexos/${anexoId}`, { data: motivo ? { motivo } : {} })
        .then((r) => r.data),
  };
};
