/**
 * Catalogo de tipos de publicacao.
 *
 * Cada tipo diz:
 *  - para quais orgaos aparece (camara, prefeitura ou os dois = "compartilhado")
 *  - quais campos extras tem (ficam em publicacao.detalhes)
 *
 * Para criar um tipo novo basta acrescentar aqui: o formulario do painel,
 * a validacao e a ficha do portal se montam sozinhos a partir desta lista.
 */

export type TipoCampo = "texto" | "texto_longo" | "data" | "datahora" | "numero" | "moeda" | "selecao" | "url";

export interface CampoTipo {
  nome: string; // chave em detalhes
  rotulo: string;
  tipo: TipoCampo;
  opcoes?: string[]; // para "selecao"
  obrigatorio?: boolean;
  dica?: string;
  largura?: "inteira" | "metade"; // no formulario
}

export interface TipoPublicacaoDef {
  id: string;
  nome: string;
  orgaos: ("camara" | "prefeitura")[];
  grupo: "geral" | "camara" | "prefeitura";
  descricao: string;
  campos: CampoTipo[];
  // Campo mostrado como etiqueta na lista do portal (ex.: situacao)
  destaque?: string;
  // Cor do tipo (etiqueta e faixa na lista), com texto branco por cima
  cor: string;
  // Ligacoes com os vereadores cadastrados na Camara do municipio
  // (na Prefeitura vale so a votacao, ex.: lei votada na Camara)
  vinculos?: {
    autores?: boolean; // vereador(es) autor(es)
    relator?: boolean; // vereador relator
    votacao?: boolean; // voto nominal de cada vereador
    presenca?: boolean; // presenca na sessao
  };
}

const AMBOS: ("camara" | "prefeitura")[] = ["camara", "prefeitura"];

// Fases comuns de editais (concurso, processo seletivo, estagio, chamada publica...)
const FASES_EDITAL = ["Edital de abertura", "Retificação", "Inscrições deferidas", "Resultado parcial", "Recurso", "Resultado final", "Homologação", "Convocação", "Cancelamento"];

// Campos de um ato simples (ementa + data)
const ato = (rotuloData: string, extra: CampoTipo[] = []): CampoTipo[] => [
  { nome: "ementa", rotulo: "Ementa / assunto", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
  { nome: "dataAto", rotulo: rotuloData, tipo: "data" },
  ...extra,
];

// Campos de editais/selecoes
const selecao = (extra: CampoTipo[] = []): CampoTipo[] => [
  { nome: "fase", rotulo: "Fase / documento", tipo: "selecao", opcoes: FASES_EDITAL },
  { nome: "vagas", rotulo: "Vagas", tipo: "numero" },
  { nome: "inscricoesInicio", rotulo: "Inscrições de", tipo: "data" },
  { nome: "inscricoesFim", rotulo: "Inscrições até", tipo: "data" },
  ...extra,
  { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: ["Inscrições abertas", "Em andamento", "Resultado publicado", "Homologado", "Encerrado", "Cancelado"] },
];

const SITUACOES_PROPOSICAO = [
  "Apresentado",
  "Em tramitação",
  "Em comissão",
  "Pronto para pauta",
  "Aprovado",
  "Rejeitado",
  "Retirado",
  "Arquivado",
  "Vetado",
  "Sancionado / Promulgado",
];

export const TIPOS_PUBLICACAO_DEF: TipoPublicacaoDef[] = [
  // ---------- Compartilhados (Camara e Prefeitura) ----------
  { id: "noticia", nome: "Notícia", orgaos: AMBOS, grupo: "geral", descricao: "Notícia ou informe geral", cor: "#2563eb", campos: [] },
  { id: "comunicado", nome: "Comunicado", orgaos: AMBOS, grupo: "geral", descricao: "Comunicado oficial", cor: "#0369a1", campos: [] },
  { id: "aviso", nome: "Aviso", orgaos: AMBOS, grupo: "geral", descricao: "Aviso à população", cor: "#b45309", campos: [] },
  { id: "documento", nome: "Documento", orgaos: AMBOS, grupo: "geral", descricao: "Documento avulso (relatório, balanço...)", cor: "#475569", campos: [] },
  {
    id: "audiencia_publica",
    nome: "Audiência pública",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Convocação ou resultado de audiência pública",
    destaque: "situacao",
    cor: "#0f766e",
    campos: [
      { nome: "tema", rotulo: "Tema", tipo: "texto", obrigatorio: true, largura: "inteira" },
      { nome: "dataHora", rotulo: "Data e hora", tipo: "datahora", obrigatorio: true },
      { nome: "local", rotulo: "Local", tipo: "texto" },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: ["Agendada", "Realizada", "Adiada", "Cancelada"] },
      { nome: "transmissao", rotulo: "Link da transmissão", tipo: "url" },
    ],
  },

  // ---------- Camara ----------
  {
    id: "projeto_lei",
    nome: "Projeto de lei / proposição",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Projeto de lei, resolução, decreto legislativo ou emenda",
    destaque: "situacao",
    vinculos: { autores: true, votacao: true },
    cor: "#6d28d9",
    campos: [
      {
        nome: "especie",
        rotulo: "Espécie",
        tipo: "selecao",
        obrigatorio: true,
        opcoes: [
          "Projeto de Lei Ordinária",
          "Projeto de Lei Complementar",
          "Projeto de Resolução",
          "Projeto de Decreto Legislativo",
          "Proposta de Emenda à Lei Orgânica",
        ],
      },
      { nome: "autor", rotulo: "Outros autores", tipo: "texto", dica: "Se o autor não for vereador: Mesa Diretora, Poder Executivo, comissão..." },
      { nome: "ementa", rotulo: "Ementa", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "dataApresentacao", rotulo: "Data de apresentação", tipo: "data" },
      { nome: "regime", rotulo: "Regime de tramitação", tipo: "selecao", opcoes: ["Ordinário", "Urgência", "Urgência especial"] },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: SITUACOES_PROPOSICAO, obrigatorio: true },
    ],
  },
  {
    id: "indicacao",
    nome: "Indicação",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Sugestão de vereador ao Executivo (ex.: reparo de rua)",
    destaque: "situacao",
    vinculos: { autores: true, votacao: true },
    cor: "#15803d",
    campos: [
      { nome: "autor", rotulo: "Outros autores", tipo: "texto", dica: "Se o autor não for vereador da lista" },
      { nome: "destinatario", rotulo: "Destinatário", tipo: "texto", dica: "ex.: Prefeito, Secretaria de Obras" },
      { nome: "dataApresentacao", rotulo: "Data de apresentação", tipo: "data" },
      {
        nome: "situacao",
        rotulo: "Situação",
        tipo: "selecao",
        obrigatorio: true,
        opcoes: ["Apresentada", "Aprovada em plenário", "Encaminhada ao Executivo", "Respondida", "Atendida", "Arquivada"],
      },
      { nome: "resposta", rotulo: "Resposta recebida", tipo: "texto_longo", largura: "inteira" },
    ],
  },
  {
    id: "requerimento",
    nome: "Requerimento",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Pedido de informação ou providência",
    destaque: "situacao",
    vinculos: { autores: true, votacao: true },
    cor: "#c2410c",
    campos: [
      { nome: "autor", rotulo: "Outros autores", tipo: "texto", dica: "Se o autor não for vereador: Mesa Diretora, comissão..." },
      { nome: "destinatario", rotulo: "Destinatário", tipo: "texto" },
      { nome: "dataApresentacao", rotulo: "Data de apresentação", tipo: "data" },
      {
        nome: "situacao",
        rotulo: "Situação",
        tipo: "selecao",
        obrigatorio: true,
        opcoes: ["Apresentado", "Aprovado", "Rejeitado", "Encaminhado", "Respondido", "Arquivado"],
      },
      { nome: "resposta", rotulo: "Resposta recebida", tipo: "texto_longo", largura: "inteira" },
    ],
  },
  {
    id: "mocao",
    nome: "Moção",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Moção de aplauso, pesar, repúdio...",
    destaque: "situacao",
    vinculos: { autores: true, votacao: true },
    cor: "#db2777",
    campos: [
      { nome: "especie", rotulo: "Tipo de moção", tipo: "selecao", obrigatorio: true, opcoes: ["Aplauso", "Congratulação", "Pesar", "Repúdio", "Apoio"] },
      { nome: "autor", rotulo: "Outros autores", tipo: "texto", dica: "Se o autor não for vereador: Mesa Diretora, comissão..." },
      { nome: "homenageado", rotulo: "Homenageado / destinatário", tipo: "texto" },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: ["Apresentada", "Aprovada", "Rejeitada"] },
    ],
  },
  {
    id: "sessao",
    nome: "Sessão / pauta",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Convocação e pauta de sessão plenária",
    destaque: "situacao",
    vinculos: { presenca: true },
    cor: "#4338ca",
    campos: [
      { nome: "tipoSessao", rotulo: "Tipo de sessão", tipo: "selecao", obrigatorio: true, opcoes: ["Ordinária", "Extraordinária", "Solene", "Especial"] },
      { nome: "dataHora", rotulo: "Data e hora", tipo: "datahora", obrigatorio: true },
      { nome: "local", rotulo: "Local", tipo: "texto", dica: "ex.: Plenário da Câmara" },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: ["Agendada", "Realizada", "Adiada", "Cancelada"] },
      { nome: "transmissao", rotulo: "Link da transmissão", tipo: "url" },
    ],
  },
  {
    id: "ata",
    nome: "Ata de sessão",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Ata aprovada de sessão plenária",
    vinculos: { presenca: true },
    cor: "#57534e",
    campos: [
      { nome: "tipoSessao", rotulo: "Tipo de sessão", tipo: "selecao", opcoes: ["Ordinária", "Extraordinária", "Solene", "Especial"] },
      { nome: "dataSessao", rotulo: "Data da sessão", tipo: "data", obrigatorio: true },
      { nome: "numeroSessao", rotulo: "Número da sessão", tipo: "texto" },
    ],
  },
  {
    id: "votacao",
    nome: "Resultado de votação",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Resultado oficial de votação em plenário",
    destaque: "resultado",
    vinculos: { votacao: true },
    cor: "#b91c1c",
    campos: [
      { nome: "materia", rotulo: "Matéria votada", tipo: "texto", obrigatorio: true, largura: "inteira", dica: "ex.: Projeto de Lei 45/2026" },
      { nome: "dataVotacao", rotulo: "Data da votação", tipo: "data", obrigatorio: true },
      { nome: "tipoVotacao", rotulo: "Tipo de votação", tipo: "selecao", opcoes: ["Simbólica", "Nominal", "Secreta"] },
      { nome: "resultado", rotulo: "Resultado", tipo: "selecao", obrigatorio: true, opcoes: ["Aprovado", "Rejeitado", "Adiado", "Retirado de pauta"] },
      { nome: "votosSim", rotulo: "Votos favoráveis", tipo: "numero" },
      { nome: "votosNao", rotulo: "Votos contrários", tipo: "numero" },
      { nome: "abstencoes", rotulo: "Abstenções", tipo: "numero" },
      { nome: "ausentes", rotulo: "Ausentes", tipo: "numero" },
    ],
  },
  {
    id: "parecer",
    nome: "Parecer de comissão",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Parecer de comissão permanente ou especial",
    destaque: "conclusao",
    vinculos: { relator: true, votacao: true },
    cor: "#0e7490",
    campos: [
      { nome: "comissao", rotulo: "Comissão", tipo: "texto", obrigatorio: true },
      { nome: "materia", rotulo: "Matéria", tipo: "texto", obrigatorio: true },
      { nome: "relator", rotulo: "Relator(a) (se não for vereador da lista)", tipo: "texto" },
      { nome: "conclusao", rotulo: "Conclusão", tipo: "selecao", opcoes: ["Favorável", "Favorável com emendas", "Contrário"] },
    ],
  },

  {
    id: "resolucao",
    nome: "Resolução",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Resolução da Câmara (assuntos internos: regimento, estrutura, mesa...)",
    vinculos: { autores: true, votacao: true },
    cor: "#a21caf",
    campos: [
      { nome: "ementa", rotulo: "Ementa", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "dataAto", rotulo: "Data da resolução", tipo: "data", obrigatorio: true },
      { nome: "autor", rotulo: "Outros autores", tipo: "texto", dica: "Mesa Diretora, comissão..." },
    ],
  },
  {
    id: "decreto_legislativo",
    nome: "Decreto legislativo",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Decreto legislativo (títulos, honrarias, contas do Prefeito...)",
    vinculos: { autores: true, votacao: true },
    cor: "#7c2d12",
    campos: [
      { nome: "ementa", rotulo: "Ementa", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "dataAto", rotulo: "Data do decreto legislativo", tipo: "data", obrigatorio: true },
      { nome: "autor", rotulo: "Outros autores", tipo: "texto", dica: "Mesa Diretora, comissão..." },
    ],
  },
  {
    id: "emenda_lei_organica",
    nome: "Emenda à Lei Orgânica",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Proposta ou emenda à Lei Orgânica do Município (votada em dois turnos)",
    vinculos: { autores: true, votacao: true },
    destaque: "situacao",
    cor: "#be123c",
    campos: [
      { nome: "ementa", rotulo: "Ementa", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "autor", rotulo: "Outros autores", tipo: "texto", dica: "Prefeito, 1/3 dos vereadores..." },
      { nome: "turno", rotulo: "Turno de votação", tipo: "selecao", opcoes: ["Não votada", "1º turno", "2º turno"] },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: SITUACOES_PROPOSICAO, obrigatorio: true },
      { nome: "dataPromulgacao", rotulo: "Data da promulgação", tipo: "data" },
    ],
  },

  // ---------- Prefeitura ----------
  {
    id: "decreto",
    nome: "Decreto",
    orgaos: ["prefeitura"],
    grupo: "prefeitura",
    descricao: "Decreto do Executivo",
    cor: "#4d7c0f",
    campos: [
      { nome: "ementa", rotulo: "Ementa", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "dataAto", rotulo: "Data do decreto", tipo: "data", obrigatorio: true },
      { nome: "secretaria", rotulo: "Secretaria responsável", tipo: "texto" },
    ],
  },
  {
    id: "portaria",
    nome: "Portaria",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Portaria (nomeação, exoneração, designação...)",
    cor: "#9333ea",
    campos: [
      { nome: "ementa", rotulo: "Ementa", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "dataAto", rotulo: "Data da portaria", tipo: "data", obrigatorio: true },
      { nome: "secretaria", rotulo: "Secretaria / setor emissor", tipo: "texto" },
    ],
  },
  {
    id: "lei",
    nome: "Lei municipal",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Lei sancionada pelo Prefeito ou promulgada pela Câmara",
    vinculos: { votacao: true }, // votada na Camara
    cor: "#1e3a8a",
    campos: [
      { nome: "ementa", rotulo: "Ementa", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "dataSancao", rotulo: "Data da sanção / promulgação", tipo: "data", obrigatorio: true },
      { nome: "projetoOrigem", rotulo: "Projeto de origem", tipo: "texto", dica: "ex.: PL 45/2026 da Câmara" },
    ],
  },
  {
    id: "licitacao",
    nome: "Licitação",
    orgaos: ["prefeitura"],
    grupo: "prefeitura",
    descricao: "Aviso, edital ou resultado de licitação",
    destaque: "situacao",
    cor: "#ca8a04",
    campos: [
      {
        nome: "modalidade",
        rotulo: "Modalidade",
        tipo: "selecao",
        obrigatorio: true,
        opcoes: ["Pregão eletrônico", "Pregão presencial", "Concorrência", "Concurso", "Leilão", "Diálogo competitivo", "Dispensa", "Inexigibilidade"],
      },
      { nome: "numeroProcesso", rotulo: "Nº do processo", tipo: "texto" },
      { nome: "objeto", rotulo: "Objeto", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "dataAbertura", rotulo: "Abertura das propostas", tipo: "datahora" },
      { nome: "valorEstimado", rotulo: "Valor estimado (R$)", tipo: "moeda" },
      {
        nome: "situacao",
        rotulo: "Situação",
        tipo: "selecao",
        obrigatorio: true,
        opcoes: ["Aberta", "Em andamento", "Suspensa", "Homologada", "Deserta", "Fracassada", "Revogada", "Anulada"],
      },
      { nome: "linkPncp", rotulo: "Link no PNCP / portal de compras", tipo: "url", largura: "inteira" },
    ],
  },
  {
    id: "contrato",
    nome: "Contrato / aditivo",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Contrato firmado ou termo aditivo",
    cor: "#0891b2",
    campos: [
      { nome: "contratada", rotulo: "Contratada", tipo: "texto", obrigatorio: true },
      { nome: "cnpjContratada", rotulo: "CNPJ da contratada", tipo: "texto" },
      { nome: "objeto", rotulo: "Objeto", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "valor", rotulo: "Valor (R$)", tipo: "moeda" },
      { nome: "vigenciaInicio", rotulo: "Início da vigência", tipo: "data" },
      { nome: "vigenciaFim", rotulo: "Fim da vigência", tipo: "data" },
      { nome: "licitacao", rotulo: "Licitação de origem", tipo: "texto" },
    ],
  },
  {
    id: "obra",
    nome: "Obra",
    orgaos: ["prefeitura"],
    grupo: "prefeitura",
    descricao: "Obra ou intervenção pública e seu andamento",
    destaque: "situacao",
    cor: "#ea580c",
    campos: [
      { nome: "local", rotulo: "Local", tipo: "texto", obrigatorio: true, largura: "inteira" },
      {
        nome: "situacao",
        rotulo: "Situação",
        tipo: "selecao",
        obrigatorio: true,
        opcoes: ["Planejada", "Em licitação", "Contratada", "Em execução", "Paralisada", "Concluída"],
      },
      { nome: "percentual", rotulo: "Execução (%)", tipo: "numero" },
      { nome: "secretaria", rotulo: "Secretaria responsável", tipo: "texto" },
      { nome: "empresa", rotulo: "Empresa executora", tipo: "texto" },
      { nome: "valor", rotulo: "Valor (R$)", tipo: "moeda" },
      { nome: "inicioPrevisto", rotulo: "Início previsto", tipo: "data" },
      { nome: "terminoPrevisto", rotulo: "Término previsto", tipo: "data" },
    ],
  },
  {
    id: "edital",
    nome: "Concurso público",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Edital, retificação, resultado e homologação de concurso público",
    destaque: "situacao",
    cor: "#be185d",
    campos: [
      { nome: "modalidade", rotulo: "Modalidade", tipo: "selecao", opcoes: ["Concurso público", "Processo seletivo", "Chamamento público", "Outro"] },
      { nome: "fase", rotulo: "Fase / documento", tipo: "selecao", opcoes: FASES_EDITAL },
      { nome: "vagas", rotulo: "Vagas", tipo: "numero" },
      { nome: "inscricoesInicio", rotulo: "Inscrições de", tipo: "data" },
      { nome: "inscricoesFim", rotulo: "Inscrições até", tipo: "data" },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: ["Inscrições abertas", "Em andamento", "Resultado publicado", "Homologado", "Cancelado"] },
    ],
  },
  {
    id: "programa_servico",
    nome: "Programa / serviço",
    orgaos: ["prefeitura"],
    grupo: "prefeitura",
    descricao: "Programa, campanha ou serviço para a população",
    cor: "#059669",
    campos: [
      { nome: "secretaria", rotulo: "Secretaria", tipo: "texto" },
      { nome: "publicoAlvo", rotulo: "Público-alvo", tipo: "texto" },
      { nome: "prazo", rotulo: "Prazo", tipo: "data" },
      { nome: "comoAcessar", rotulo: "Como participar / acessar", tipo: "texto_longo", largura: "inteira" },
    ],
  },
  // ---------- Mais tipos (atos, editais, prestacao de contas...) ----------
  {
    id: "ato_administrativo",
    nome: "Ato administrativo",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Ato administrativo em geral (ordem de serviço, despacho, comunicado interno...)",
    cor: "#115e59",
    campos: ato("Data do ato"),
  },
  {
    id: "instrucao_normativa",
    nome: "Instrução normativa",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Instrução normativa (regras e procedimentos internos)",
    cor: "#1d4ed8",
    campos: ato("Data da instrução", [{ nome: "setor", rotulo: "Setor / órgão emissor", tipo: "texto" }]),
  },
  {
    id: "deliberacao",
    nome: "Deliberação",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Deliberação de conselho, comissão ou colegiado",
    cor: "#7e22ce",
    campos: ato("Data da deliberação", [{ nome: "colegiado", rotulo: "Conselho / comissão", tipo: "texto", dica: "ex.: Conselho Municipal de Educação" }]),
  },
  {
    id: "regimento_interno",
    nome: "Regimento interno",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Regimento interno (da Câmara, de conselho...) e suas alterações",
    cor: "#3f6212",
    campos: ato("Data de aprovação", [{ nome: "vigencia", rotulo: "Situação", tipo: "selecao", opcoes: ["Em vigor", "Revogado"] }]),
  },
  {
    id: "convenio",
    nome: "Convênio",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Convênio, termo de colaboração/fomento ou acordo de cooperação",
    destaque: "situacao",
    cor: "#155e75",
    campos: [
      { nome: "concedente", rotulo: "Concedente / parceiro", tipo: "texto", obrigatorio: true },
      { nome: "objeto", rotulo: "Objeto", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "valor", rotulo: "Valor (R$)", tipo: "moeda" },
      { nome: "contrapartida", rotulo: "Contrapartida (R$)", tipo: "moeda" },
      { nome: "vigenciaInicio", rotulo: "Início da vigência", tipo: "data" },
      { nome: "vigenciaFim", rotulo: "Fim da vigência", tipo: "data" },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: ["Vigente", "Em execução", "Concluído", "Prestação de contas", "Cancelado"] },
    ],
  },
  {
    id: "termo_ajuste_conduta",
    nome: "Termo de Ajustamento de Conduta",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "TAC firmado com o Ministério Público ou outro órgão",
    destaque: "situacao",
    cor: "#9a3412",
    campos: [
      { nome: "compromitente", rotulo: "Firmado com", tipo: "texto", obrigatorio: true, dica: "ex.: Ministério Público de MG" },
      { nome: "objeto", rotulo: "Objeto", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "dataAto", rotulo: "Data de assinatura", tipo: "data" },
      { nome: "prazo", rotulo: "Prazo para cumprimento", tipo: "data" },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: ["Em cumprimento", "Cumprido", "Descumprido", "Arquivado"] },
    ],
  },
  {
    id: "processo_administrativo",
    nome: "Processo administrativo",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Processo administrativo (disciplinar, sindicância, licitatório...) e suas decisões",
    destaque: "situacao",
    cor: "#44403c",
    campos: [
      { nome: "especie", rotulo: "Espécie", tipo: "selecao", opcoes: ["Processo administrativo disciplinar", "Sindicância", "Processo de responsabilização", "Outro"] },
      { nome: "ementa", rotulo: "Assunto", tipo: "texto_longo", obrigatorio: true, largura: "inteira" },
      { nome: "dataAto", rotulo: "Data", tipo: "data" },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: ["Instaurado", "Em andamento", "Concluído", "Arquivado"] },
    ],
  },
  {
    id: "licenca_premio",
    nome: "Licença-prêmio",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Concessão de licença-prêmio a servidor",
    cor: "#a16207",
    campos: [
      { nome: "servidor", rotulo: "Servidor(a)", tipo: "texto", obrigatorio: true },
      { nome: "cargo", rotulo: "Cargo", tipo: "texto" },
      { nome: "periodo", rotulo: "Período aquisitivo", tipo: "texto", dica: "ex.: 2016-2021" },
      { nome: "inicio", rotulo: "Início do gozo", tipo: "data" },
      { nome: "fim", rotulo: "Fim do gozo", tipo: "data" },
    ],
  },
  {
    id: "processo_seletivo",
    nome: "Processo seletivo",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Processo seletivo simplificado (contratação temporária)",
    destaque: "situacao",
    cor: "#c026d3",
    campos: selecao(),
  },
  {
    id: "chamada_publica",
    nome: "Chamada pública",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Chamada pública (agricultura familiar, credenciamento, chamamento...)",
    destaque: "situacao",
    cor: "#075985",
    campos: selecao([{ nome: "objeto", rotulo: "Objeto", tipo: "texto_longo", largura: "inteira" }]),
  },
  {
    id: "edital_convocacao",
    nome: "Edital de convocação",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Convocação de aprovados, de conselheiros, para audiência...",
    cor: "#991b1b",
    campos: [
      { nome: "referente", rotulo: "Referente a", tipo: "texto", dica: "ex.: Concurso 01/2025" },
      { nome: "prazo", rotulo: "Prazo para comparecer", tipo: "data" },
      { nome: "local", rotulo: "Local", tipo: "texto" },
    ],
  },
  {
    id: "edital_estagio",
    nome: "Edital de estágio",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Seleção de estagiários",
    destaque: "situacao",
    cor: "#e11d48",
    campos: selecao([{ nome: "cursos", rotulo: "Cursos / áreas", tipo: "texto", largura: "inteira" }]),
  },
  {
    id: "edital_selecao",
    nome: "Edital de seleção",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Outras seleções (bolsas, conselheiros, projetos culturais...)",
    destaque: "situacao",
    cor: "#86198f",
    campos: selecao([{ nome: "objeto", rotulo: "Objeto", tipo: "texto_longo", largura: "inteira" }]),
  },
  {
    id: "prestacao_contas_executivo",
    nome: "Prestação de contas do Executivo",
    orgaos: ["prefeitura"],
    grupo: "prefeitura",
    descricao: "Prestação de contas anual do Poder Executivo Municipal",
    destaque: "situacao",
    cor: "#065f46",
    campos: [
      { nome: "exercicio", rotulo: "Exercício (ano)", tipo: "numero", obrigatorio: true },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: ["Enviada ao Tribunal de Contas", "Em análise", "Parecer prévio emitido", "Aprovada", "Aprovada com ressalvas", "Rejeitada"] },
      { nome: "parecerTce", rotulo: "Parecer do Tribunal de Contas", tipo: "texto", largura: "inteira" },
    ],
  },
  {
    id: "prestacao_contas_legislativo",
    nome: "Prestação de contas do Legislativo",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Prestação de contas anual do Poder Legislativo Municipal",
    destaque: "situacao",
    cor: "#047857",
    campos: [
      { nome: "exercicio", rotulo: "Exercício (ano)", tipo: "numero", obrigatorio: true },
      { nome: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: ["Enviada ao Tribunal de Contas", "Em análise", "Aprovada", "Aprovada com ressalvas", "Rejeitada"] },
    ],
  },
  {
    id: "aprovacao_contas",
    nome: "Decreto de aprovação de contas",
    orgaos: ["camara"],
    grupo: "camara",
    descricao: "Decreto legislativo que aprova ou rejeita as contas do Prefeito (julgamento pela Câmara)",
    vinculos: { autores: true, votacao: true },
    destaque: "resultado",
    cor: "#14532d",
    campos: [
      { nome: "exercicio", rotulo: "Exercício (ano) das contas", tipo: "numero", obrigatorio: true },
      { nome: "responsavel", rotulo: "Responsável pelas contas", tipo: "texto", dica: "ex.: Prefeito(a) na época" },
      { nome: "parecerTce", rotulo: "Parecer prévio do Tribunal de Contas", tipo: "selecao", opcoes: ["Favorável à aprovação", "Favorável com ressalvas", "Contrário (rejeição)"] },
      { nome: "resultado", rotulo: "Resultado do julgamento", tipo: "selecao", obrigatorio: true, opcoes: ["Aprovadas", "Aprovadas com ressalvas", "Rejeitadas"] },
      { nome: "dataAto", rotulo: "Data do decreto", tipo: "data" },
      { nome: "autor", rotulo: "Outros autores", tipo: "texto", dica: "ex.: Comissão de Finanças" },
    ],
  },
  {
    id: "patrimonio_cultural",
    nome: "Patrimônio cultural",
    orgaos: ["prefeitura"],
    grupo: "prefeitura",
    descricao: "Tombamento, registro e inventário de bens culturais (ICMS Patrimônio Cultural)",
    cor: "#92400e",
    campos: [
      { nome: "bem", rotulo: "Bem cultural", tipo: "texto", obrigatorio: true },
      { nome: "especie", rotulo: "Tipo de ato", tipo: "selecao", opcoes: ["Tombamento", "Registro imaterial", "Inventário", "Ata do conselho", "Outro"] },
      { nome: "dataAto", rotulo: "Data", tipo: "data" },
    ],
  },
  {
    id: "educacao_infantil",
    nome: "Educação infantil (CEMEI)",
    orgaos: ["prefeitura"],
    grupo: "prefeitura",
    descricao: "Publicações das unidades de educação infantil: matrículas, cadastro reserva, listas...",
    cor: "#d97706",
    campos: [
      { nome: "unidade", rotulo: "Unidade (CEMEI)", tipo: "texto", dica: "ex.: CEMEI Pequeno Príncipe" },
      { nome: "assunto", rotulo: "Assunto", tipo: "selecao", opcoes: ["Matrícula", "Cadastro reserva / lista de espera", "Calendário", "Comunicado", "Outro"] },
    ],
  },
  {
    id: "conselho_municipal",
    nome: "Conselhos municipais (CME / CACS-FUNDEB)",
    orgaos: ["prefeitura"],
    grupo: "prefeitura",
    descricao: "Atas, resoluções e pareceres de conselhos (Educação, CACS-FUNDEB, Saúde...)",
    cor: "#4f46e5",
    campos: [
      { nome: "conselho", rotulo: "Conselho", tipo: "selecao", obrigatorio: true, opcoes: ["Conselho Municipal de Educação (CME)", "CACS-FUNDEB", "Conselho Municipal de Saúde", "Conselho de Assistência Social", "Conselho do Idoso", "Conselho da Criança e do Adolescente", "Outro"] },
      { nome: "documento", rotulo: "Documento", tipo: "selecao", opcoes: ["Ata", "Resolução", "Parecer", "Convocação", "Composição", "Outro"] },
      { nome: "dataAto", rotulo: "Data", tipo: "data" },
    ],
  },
  {
    id: "publicacoes_diversas",
    nome: "Publicações diversas",
    orgaos: AMBOS,
    grupo: "geral",
    descricao: "Outras publicações que não se encaixam nos demais tipos",
    cor: "#64748b",
    campos: [],
  },
];

export const IDS_TIPOS = TIPOS_PUBLICACAO_DEF.map((t) => t.id);
export const tipoPorId = (id: string) => TIPOS_PUBLICACAO_DEF.find((t) => t.id === id);

export const tipoPermitidoNoOrgao = (tipoId: string, orgaoTipo: string) =>
  Boolean(tipoPorId(tipoId)?.orgaos.includes(orgaoTipo as "camara" | "prefeitura"));

/**
 * Valida e limpa os detalhes conforme o tipo.
 * Devolve { detalhes } ou { erros } (campo -> mensagem).
 */
export function validarDetalhes(
  tipoId: string,
  entrada: unknown
): { detalhes: Record<string, unknown>; erros: Record<string, string> } {
  const def = tipoPorId(tipoId);
  const erros: Record<string, string> = {};
  const detalhes: Record<string, unknown> = {};
  if (!def) return { detalhes, erros: { tipo: "Tipo inválido" } };
  const dados = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;

  for (const campo of def.campos) {
    const bruto = dados[campo.nome];
    const vazio = bruto === undefined || bruto === null || (typeof bruto === "string" && bruto.trim() === "");
    if (vazio) {
      if (campo.obrigatorio) erros[campo.nome] = `${campo.rotulo}: obrigatório`;
      continue;
    }

    switch (campo.tipo) {
      case "texto":
      case "texto_longo": {
        const v = String(bruto).trim();
        const max = campo.tipo === "texto" ? 300 : 5000;
        if (v.length > max) erros[campo.nome] = `${campo.rotulo}: máximo ${max} caracteres`;
        else detalhes[campo.nome] = v;
        break;
      }
      case "data":
      case "datahora": {
        const d = new Date(String(bruto));
        if (isNaN(d.getTime())) erros[campo.nome] = `${campo.rotulo}: data inválida`;
        // data simples guardada como "AAAA-MM-DD" (sem problema de fuso)
        else detalhes[campo.nome] = campo.tipo === "data" ? String(bruto).slice(0, 10) : d.toISOString();
        break;
      }
      case "numero":
      case "moeda": {
        const n = Number(String(bruto).replace(",", "."));
        if (!isFinite(n) || n < 0) erros[campo.nome] = `${campo.rotulo}: número inválido`;
        else detalhes[campo.nome] = campo.tipo === "moeda" ? Math.round(n * 100) / 100 : n;
        break;
      }
      case "selecao": {
        const v = String(bruto);
        if (!campo.opcoes?.includes(v)) erros[campo.nome] = `${campo.rotulo}: opção inválida`;
        else detalhes[campo.nome] = v;
        break;
      }
      case "url": {
        const v = String(bruto).trim();
        if (!/^https?:\/\/\S+$/i.test(v)) erros[campo.nome] = `${campo.rotulo}: link inválido (comece com https://)`;
        else detalhes[campo.nome] = v;
        break;
      }
    }
  }
  return { detalhes, erros };
}

// Texto dos detalhes para a busca (ementa, autor, objeto...)
export function textoBuscaDetalhes(tipoId: string, detalhes: Record<string, unknown> | undefined): string {
  const def = tipoPorId(tipoId);
  if (!def || !detalhes) return "";
  return def.campos
    .filter((c) => ["texto", "texto_longo", "selecao"].includes(c.tipo) && detalhes[c.nome])
    .map((c) => String(detalhes[c.nome]))
    .join(" ");
}
