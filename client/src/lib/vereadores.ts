// Nomes amigaveis usados no painel e no portal (vereadores)

export const NOME_CARGO_MESA: Record<string, string> = {
  presidente: "Presidente",
  vice_presidente: "Vice-presidente",
  primeiro_secretario: "1º Secretário(a)",
  segundo_secretario: "2º Secretário(a)",
  vereador: "Vereador(a)",
};

export const NOME_SITUACAO_VEREADOR: Record<string, string> = {
  exercicio: "Em exercício",
  licenciado: "Licenciado(a)",
  afastado: "Afastado(a)",
  suplente: "Suplente",
  ex: "Ex-vereador(a)",
};

export const NOME_VOTO: Record<string, string> = { sim: "Favorável", nao: "Contrário", abstencao: "Abstenção", ausente: "Ausente" };
export const COR_VOTO: Record<string, string> = {
  sim: "bg-green-100 text-green-900",
  nao: "bg-red-100 text-red-900",
  abstencao: "bg-amber-100 text-amber-900",
  ausente: "bg-slate-200 text-slate-700",
};

export const NOME_PRESENCA: Record<string, string> = { presente: "Presente", ausente: "Ausente", justificada: "Ausência justificada" };
export const COR_PRESENCA: Record<string, string> = {
  presente: "bg-green-100 text-green-900",
  ausente: "bg-red-100 text-red-900",
  justificada: "bg-amber-100 text-amber-900",
};

// Nome para mostrar (o parlamentar, se tiver)
export const nomeVereador = (v: { nome: string; nomeParlamentar?: string | null }) => v.nomeParlamentar || v.nome;
