import { Request } from "express";
import { Types } from "mongoose";
import { semTenant } from "../../context/tenant";
import { Auditoria } from "../../models/Auditoria";
import { Municipio } from "../../models/Municipio";
import { Orgao } from "../../models/Orgao";
import { Publicacao } from "../../models/Publicacao";
import { Usuario } from "../../models/Usuario";
import { Vereador } from "../../models/Vereador";

/**
 * Historico de movimentacao (quem fez o que e quando), lido do log de auditoria.
 * Usado pela GADZ (tudo) e pelo administrador do orgao (so o seu orgao).
 *
 * Filtros (query string):
 * - q: nome ou e-mail de quem fez
 * - acao: categoria ("publicacao", "usuario", "orgao", "municipio", "auth") ou acao exata ("publicacao.publicar")
 * - de / ate: datas AAAA-MM-DD (inclusive)
 * - municipio / orgao: ids (so na visao da GADZ)
 * - pagina: 1, 2, 3...
 */

const POR_PAGINA = 50;

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const idValido = (v: unknown): v is string => typeof v === "string" && Types.ObjectId.isValid(v);

// Data "2026-10-20" no fuso de Brasilia (UTC-3)
function inicioDoDia(v: string) {
  return new Date(`${v}T00:00:00-03:00`);
}

// Tira campos sensiveis e encurta textos longos (ex.: conteudo da publicacao)
function limparDetalhes(v: unknown, nivel = 0): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.length > 300 ? `${v.slice(0, 300)}…` : v;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => limparDetalhes(x, nivel + 1));
  if (typeof v === "object" && nivel < 3) {
    const saida: Record<string, unknown> = {};
    for (const [k, valor] of Object.entries(v as Record<string, unknown>)) {
      if (/senha|hash|token/i.test(k)) continue;
      if (valor === undefined) continue;
      saida[k] = limparDetalhes(valor, nivel + 1);
    }
    return saida;
  }
  return v;
}

export async function listarHistorico(req: Request, base: { orgaoId?: Types.ObjectId | string }) {
  return semTenant(async () => {
    const filtro: Record<string, unknown> = {};
    const q = req.query;

    if (base.orgaoId) {
      filtro.orgaoId = new Types.ObjectId(String(base.orgaoId));
    } else {
      if (idValido(q.orgao)) filtro.orgaoId = new Types.ObjectId(q.orgao);
      if (idValido(q.municipio)) filtro.municipioId = new Types.ObjectId(q.municipio);
    }

    const acao = String(q.acao || "").trim();
    if (acao) filtro.acao = acao.includes(".") ? acao : new RegExp(`^${escapar(acao)}\\.`);

    const criadoEm: Record<string, Date> = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(q.de || ""))) criadoEm.$gte = inicioDoDia(String(q.de));
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(q.ate || ""))) {
      const fim = inicioDoDia(String(q.ate));
      fim.setDate(fim.getDate() + 1);
      criadoEm.$lt = fim;
    }
    if (Object.keys(criadoEm).length) filtro.criadoEm = criadoEm;

    // Quem fez: busca por nome ou e-mail
    const texto = String(q.q || "").trim();
    if (texto) {
      const re = new RegExp(escapar(texto), "i");
      const ids = await Usuario.find({ $or: [{ nome: re }, { email: re }] }).select("_id").limit(200);
      filtro.usuarioId = { $in: ids.map((u) => u._id) };
    }

    const pagina = Math.max(1, Number(q.pagina) || 1);
    const [total, registros] = await Promise.all([
      Auditoria.countDocuments(filtro),
      Auditoria.find(filtro)
        .sort({ criadoEm: -1, _id: -1 })
        .skip((pagina - 1) * POR_PAGINA)
        .limit(POR_PAGINA)
        .lean(),
    ]);

    // Nomes de quem fez e do que foi alterado (busca tudo de uma vez)
    const ids = (entidade: string) =>
      registros.filter((r) => r.entidade === entidade && idValido(r.entidadeId)).map((r) => r.entidadeId as string);
    const usuarioIds = [...registros.map((r) => r.usuarioId).filter(Boolean), ...ids("Usuario")];
    const orgaoIds = [...registros.map((r) => r.orgaoId).filter(Boolean), ...ids("Orgao")];
    const municipioIds = [...registros.map((r) => r.municipioId).filter(Boolean), ...ids("Municipio")];

    const [usuarios, orgaos, municipios, publicacoes, vereadores] = await Promise.all([
      Usuario.find({ _id: { $in: usuarioIds } }).select("nome email").lean(),
      Orgao.find({ _id: { $in: orgaoIds } }).select("nome").lean(),
      Municipio.find({ _id: { $in: municipioIds } }).select("nome uf").lean(),
      Publicacao.find({ _id: { $in: ids("Publicacao") } }).select("titulo").lean(),
      Vereador.find({ _id: { $in: ids("Vereador") } }).select("nome nomeParlamentar").lean(),
    ]);
    const mapa = <T extends { _id: unknown }>(lista: T[]) => new Map(lista.map((x) => [String(x._id), x]));
    const uMap = mapa(usuarios);
    const oMap = mapa(orgaos);
    const mMap = mapa(municipios);
    const pMap = mapa(publicacoes);
    const vMap = mapa(vereadores);

    function nomeAlvo(entidade: string, id: string | null | undefined, detalhes: unknown): string | null {
      const d = (detalhes ?? {}) as Record<string, unknown>;
      if (!id) return typeof d.email === "string" ? d.email : null;
      switch (entidade) {
        case "Publicacao":
          return pMap.get(id)?.titulo ?? (typeof d.titulo === "string" ? `${d.titulo} (excluída)` : "(publicação excluída)");
        case "Usuario": {
          const u = uMap.get(id);
          return u ? `${u.nome} (${u.email})` : (typeof d.email === "string" ? d.email : null);
        }
        case "Orgao":
          return oMap.get(id)?.nome ?? null;
        case "Vereador": {
          const v = vMap.get(id);
          return v ? (v.nomeParlamentar || v.nome) : typeof d.nome === "string" ? `${d.nome} (excluído)` : "(vereador excluído)";
        }
        case "Municipio": {
          const m = mMap.get(id);
          return m ? `${m.nome}/${m.uf}` : null;
        }
        default:
          return null;
      }
    }

    return {
      total,
      pagina,
      paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
      itens: registros.map((r) => {
        const u = r.usuarioId ? uMap.get(String(r.usuarioId)) : null;
        const m = r.municipioId ? mMap.get(String(r.municipioId)) : null;
        return {
          id: String(r._id),
          data: r.criadoEm,
          acao: r.acao,
          usuario: u ? { id: String(u._id), nome: u.nome, email: u.email } : null,
          entidade: r.entidade,
          entidadeId: r.entidadeId ?? null,
          alvo: nomeAlvo(r.entidade, r.entidadeId, r.diff),
          municipio: m ? `${m.nome}/${m.uf}` : null,
          orgao: r.orgaoId ? (oMap.get(String(r.orgaoId))?.nome ?? null) : null,
          detalhes: limparDetalhes(r.diff),
          ip: base.orgaoId ? null : (r.ip ?? null), // IP so para a GADZ
        };
      }),
    };
  });
}
