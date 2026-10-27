import { Types } from "mongoose";
import { z } from "zod";
import { tipoPorId } from "../../config/tiposPublicacao";
import { Orgao } from "../../models/Orgao";
import { PRESENCAS, VOTOS } from "../../models/Publicacao";
import { Vereador, nomeExibicao } from "../../models/Vereador";
import { HttpError } from "../../utils/httpError";
import { urlFotoVereador } from "../../utils/imagens";

/**
 * Ligacoes entre publicacoes e vereadores:
 * autores, relator, voto nominal e presenca na sessao.
 */

const vazioParaUndef = (v: unknown) => (v === "" ? undefined : v);
const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), "Vereador inválido");

export const vinculosSchema = z.object({
  autoresIds: z.array(objectId).max(60).optional(),
  relatorId: z.preprocess(vazioParaUndef, objectId.nullable().optional()),
  votos: z.array(z.object({ vereadorId: objectId, voto: z.enum(VOTOS) })).max(100).optional(),
  presencas: z.array(z.object({ vereadorId: objectId, situacao: z.enum(PRESENCAS) })).max(100).optional(),
});
export type DadosVinculos = z.infer<typeof vinculosSchema>;

// Camara do mesmo municipio (os vereadores sao cadastrados nela)
export async function camaraDoMunicipio(orgao: { _id: Types.ObjectId; tipo: string; municipioId?: unknown }) {
  if (orgao.tipo === "camara") return orgao._id;
  const camara = await Orgao.findOne({ municipioId: orgao.municipioId, tipo: "camara" }).select("_id");
  return camara?._id ?? null;
}

type Atual = {
  autoresIds?: unknown[];
  relatorId?: unknown;
  votos?: { vereadorId: unknown; voto: string }[];
  presencas?: { vereadorId: unknown; situacao: string }[];
};

/**
 * Junta o que veio com o que ja existe, limpa o que nao vale para o tipo
 * e confere se todos os vereadores sao desta Camara.
 * Devolve os campos prontos para gravar (e ajusta a contagem de votos nos detalhes).
 */
export async function prepararVinculos(
  orgao: { _id: Types.ObjectId; tipo: string; municipioId?: unknown },
  tipo: string,
  dados: DadosVinculos,
  detalhes: Record<string, unknown>,
  atual: Atual = {}
) {
  const def = tipoPorId(tipo)?.vinculos ?? {};
  // Prefeitura: so a votacao (ex.: lei votada pelos vereadores)
  const v = orgao.tipo === "camara" ? def : { votacao: def.votacao };
  const camaraId = await camaraDoMunicipio(orgao);
  const str = (x: unknown) => String(x);

  const autoresIds = v.autores ? [...new Set((dados.autoresIds ?? (atual.autoresIds ?? []).map(str)).map(str))] : [];
  const relatorId = v.relator ? (dados.relatorId !== undefined ? dados.relatorId : atual.relatorId ? str(atual.relatorId) : null) : null;
  // Um voto/presenca por vereador (o ultimo vale)
  const unicos = <T extends { vereadorId: string }>(lista: T[]) => [...new Map(lista.map((x) => [x.vereadorId, x])).values()];
  const votos = v.votacao
    ? unicos((dados.votos ?? (atual.votos ?? []).map((x) => ({ vereadorId: str(x.vereadorId), voto: x.voto }))) as { vereadorId: string; voto: (typeof VOTOS)[number] }[])
    : [];
  const presencas = v.presenca
    ? unicos(
        (dados.presencas ?? (atual.presencas ?? []).map((x) => ({ vereadorId: str(x.vereadorId), situacao: x.situacao }))) as {
          vereadorId: string;
          situacao: (typeof PRESENCAS)[number];
        }[]
      )
    : [];

  // Todos precisam ser vereadores desta Camara
  const ids = new Set([...autoresIds, ...(relatorId ? [relatorId] : []), ...votos.map((x) => x.vereadorId), ...presencas.map((x) => x.vereadorId)]);
  if (ids.size) {
    const achados = camaraId ? await Vereador.countDocuments({ _id: { $in: [...ids] }, orgaoId: camaraId }) : 0;
    if (achados !== ids.size) throw new HttpError(400, "Vereador não encontrado na Câmara deste município");
  }

  // Autoria obrigatoria: um vereador da lista ou "Outros autores"
  if (v.autores && !autoresIds.length && !String(detalhes.autor ?? "").trim()) {
    throw new HttpError(400, "Informe o(s) autor(es): escolha vereador(es) da lista ou preencha “Outros autores”");
  }

  // Votacao nominal: a contagem dos detalhes passa a vir dos votos
  const novosDetalhes = { ...detalhes };
  if (v.votacao && votos.length && tipo === "votacao") {
    novosDetalhes.votosSim = votos.filter((x) => x.voto === "sim").length;
    novosDetalhes.votosNao = votos.filter((x) => x.voto === "nao").length;
    novosDetalhes.abstencoes = votos.filter((x) => x.voto === "abstencao").length;
    novosDetalhes.ausentes = votos.filter((x) => x.voto === "ausente").length;
    if (!novosDetalhes.tipoVotacao) novosDetalhes.tipoVotacao = "Nominal";
  }

  return {
    campos: {
      autoresIds: autoresIds.map((x) => new Types.ObjectId(x)),
      relatorId: relatorId ? new Types.ObjectId(relatorId) : null,
      votos: votos.map((x) => ({ vereadorId: new Types.ObjectId(x.vereadorId), voto: x.voto })),
      presencas: presencas.map((x) => ({ vereadorId: new Types.ObjectId(x.vereadorId), situacao: x.situacao })),
    },
    detalhes: novosDetalhes,
  };
}

export interface VereadorResumo {
  id: string;
  nome: string;
  partido: string | null;
  fotoUrl: string | null;
}

type ComVinculos = Atual & { _id?: unknown };

// Busca os vereadores citados em varias publicacoes de uma vez
export async function mapaVereadores(pubs: ComVinculos[]): Promise<Map<string, VereadorResumo>> {
  const ids = new Set<string>();
  for (const p of pubs) {
    (p.autoresIds ?? []).forEach((x) => ids.add(String(x)));
    if (p.relatorId) ids.add(String(p.relatorId));
    (p.votos ?? []).forEach((x) => ids.add(String(x.vereadorId)));
    (p.presencas ?? []).forEach((x) => ids.add(String(x.vereadorId)));
  }
  if (!ids.size) return new Map();
  const lista = await Vereador.find({ _id: { $in: [...ids] } })
    .select("nome nomeParlamentar partido fotoKey fotoAtualizadoEm")
    .lean();
  return new Map(
    lista.map((v) => [
      String(v._id),
      { id: String(v._id), nome: nomeExibicao(v), partido: v.partido ?? null, fotoUrl: urlFotoVereador(v) },
    ])
  );
}

// Monta os vinculos com nome/foto para o portal (e para o PDF)
export function vinculosComNomes(p: ComVinculos, mapa: Map<string, VereadorResumo>) {
  const pegar = (id: unknown) => mapa.get(String(id));
  return {
    autores: (p.autoresIds ?? []).map(pegar).filter(Boolean) as VereadorResumo[],
    relator: p.relatorId ? (pegar(p.relatorId) ?? null) : null,
    votos: (p.votos ?? [])
      .map((x) => ({ vereador: pegar(x.vereadorId), voto: x.voto }))
      .filter((x) => x.vereador) as { vereador: VereadorResumo; voto: string }[],
    presencas: (p.presencas ?? [])
      .map((x) => ({ vereador: pegar(x.vereadorId), situacao: x.situacao }))
      .filter((x) => x.vereador) as { vereador: VereadorResumo; situacao: string }[],
  };
}
