import { Papel, SituacaoOrgao } from "../api/types";

export const NOME_PAPEL: Record<Papel, string> = {
  admin_orgao: "Administrador",
  editor: "Editor",
  revisor: "Revisor",
};

export const NOME_SITUACAO: Record<SituacaoOrgao, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

export const COR_SITUACAO: Record<SituacaoOrgao, string> = {
  ativo: "bg-green-100 text-green-800",
  suspenso: "bg-amber-100 text-amber-800",
  encerrado: "bg-slate-200 text-slate-700",
};

export const NOME_TIPO: Record<string, string> = {
  prefeitura: "Prefeitura",
  camara: "Câmara",
};

// Datas vindas da API em ISO -> "31/12/2026" (sem erro de fuso)
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

// ISO -> "2026-12-31" para <input type="date">
export const paraInputData = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "—";
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// Dias ate a data (negativo = ja passou)
export function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

export const NOME_TIPO_PUBLICACAO: Record<string, string> = {
  noticia: "Notícia",
  comunicado: "Comunicado",
  aviso: "Aviso",
  documento: "Documento",
};

export const NOME_ESTADO: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  publicado: "Publicado",
  despublicado: "Despublicado",
};

export const COR_ESTADO: Record<string, string> = {
  rascunho: "bg-slate-200 text-slate-700",
  em_revisao: "bg-amber-100 text-amber-800",
  publicado: "bg-green-100 text-green-800",
  despublicado: "bg-red-100 text-red-800",
};

export const NOME_EVENTO: Record<string, string> = {
  criado: "Criado",
  editado: "Editado",
  enviado_revisao: "Enviado para revisão",
  devolvido: "Devolvido para correção",
  publicado: "Publicado",
  corrigido: "Atualizado",
  despublicado: "Despublicado",
  anexo_adicionado: "Anexo adicionado",
  anexo_removido: "Anexo removido",
};

// "2026-10-25T13:45:00Z" -> "25/10/2026 10:45" (horario local)
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
