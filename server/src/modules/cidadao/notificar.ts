import { Types } from "mongoose";
import { semTenant } from "../../context/tenant";
import { Cidadao } from "../../models/Cidadao";
import { Notificacao } from "../../models/Notificacao";

/**
 * Cria as notificacoes do sininho.
 * Futuro (app do celular): aqui tambem sera disparado o envio "push".
 */

// Publicacao nova: avisa quem ativou as notificacoes do municipio
export async function notificarPublicacao(dados: {
  municipioId: Types.ObjectId | string;
  municipioSlug: string;
  orgaoNome: string;
  titulo: string;
  resumo?: string | null;
  slug: string;
}) {
  try {
    await semTenant(async () => {
      const inscritos = await Cidadao.find({ ativo: true, "inscricoes.municipioId": dados.municipioId }).select("_id").lean();
      if (!inscritos.length) return;
      await Notificacao.insertMany(
        inscritos.map((c) => ({
          cidadaoId: c._id,
          tipo: "publicacao",
          titulo: `${dados.orgaoNome}: ${dados.titulo}`.slice(0, 250),
          texto: dados.resumo ? dados.resumo.slice(0, 300) : undefined,
          link: `/${dados.municipioSlug}/p/${dados.slug}`,
          municipioId: dados.municipioId,
        })),
        { ordered: false }
      );
    });
  } catch (err) {
    // Notificacao nunca pode impedir a publicacao
    console.error("[notificar] falhou:", err instanceof Error ? err.message : err);
  }
}

// Servidor respondeu: avisa o cidadao
export async function notificarResposta(dados: { cidadaoId: Types.ObjectId; orgaoNome: string; assunto: string; mensagemId: string }) {
  try {
    await semTenant(() =>
      Notificacao.create({
        cidadaoId: dados.cidadaoId,
        tipo: "resposta",
        titulo: `${dados.orgaoNome} respondeu: ${dados.assunto}`.slice(0, 250),
        link: `/minha-conta/mensagens/${dados.mensagemId}`,
      })
    );
  } catch (err) {
    console.error("[notificar] falhou:", err instanceof Error ? err.message : err);
  }
}
