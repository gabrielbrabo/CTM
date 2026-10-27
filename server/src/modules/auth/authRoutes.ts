import bcrypt from "bcryptjs";
import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { semTenant } from "../../context/tenant";
import { protect } from "../../middleware/auth";
import { Mensagem } from "../../models/Mensagem";
import { Municipio } from "../../models/Municipio";
import { Orgao } from "../../models/Orgao";
import { Usuario, usuarioPublico } from "../../models/Usuario";
import { registrarAuditoria } from "../../utils/audit";
import { urlLogoOrgao } from "../../utils/imagens";
import { naoAutenticado } from "../../utils/httpError";
import {
  REFRESH_COOKIE,
  gerarAccessToken,
  gerarRefreshToken,
  opcoesCookieRefresh,
  verificarRefreshToken,
} from "../../utils/tokens";

const router = Router();

// Limita tentativas de login (protege contra forca bruta)
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Nos testes automaticos o login roda dezenas de vezes
  skip: () => process.env.NODE_ENV === "test",
  message: { message: "Muitas tentativas. Tente novamente em alguns minutos." },
});

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  senha: z.string().min(1),
});

// POST /api/auth/login
router.post("/login", limiteLogin, async (req: Request, res: Response) => {
  const { email, senha } = loginSchema.parse(req.body);

  const usuario = await Usuario.findOne({ email: email.toLowerCase() }).select("+senhaHash");
  const senhaOk = usuario ? await bcrypt.compare(senha, usuario.senhaHash) : false;
  if (!usuario || !senhaOk || !usuario.ativo) {
    // Registra a tentativa (sem a senha) para o historico
    await semTenant(() =>
      registrarAuditoria(req, {
        acao: "auth.login_falhou",
        entidade: "Usuario",
        entidadeId: usuario?._id ?? null,
        usuarioId: usuario?._id ?? null,
        municipioId: null,
        diff: { email },
      })
    );
    throw naoAutenticado("E-mail ou senha incorretos");
  }

  usuario.ultimoLogin = new Date();
  await usuario.save();

  const id = String(usuario._id);
  res.cookie(REFRESH_COOKIE, gerarRefreshToken(id, usuario.tokenVersion), opcoesCookieRefresh());

  // Login nao pertence a um municipio especifico
  await semTenant(() =>
    registrarAuditoria(req, { acao: "auth.login", entidade: "Usuario", entidadeId: id, usuarioId: id, municipioId: null })
  );

  res.json({ accessToken: gerarAccessToken(id, usuario.tokenVersion), usuario: usuarioPublico(usuario) });
});

// POST /api/auth/refresh -> novo access token usando o cookie httpOnly
router.post("/refresh", async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw naoAutenticado();

  let payload;
  try {
    payload = verificarRefreshToken(token);
  } catch {
    throw naoAutenticado("Sessao expirada");
  }

  const usuario = await Usuario.findById(payload.sub);
  if (!usuario || !usuario.ativo || usuario.tokenVersion !== payload.tv) {
    throw naoAutenticado("Sessao invalida");
  }

  const id = String(usuario._id);
  // Renova o cookie (sessao deslizante de 7 dias)
  res.cookie(REFRESH_COOKIE, gerarRefreshToken(id, usuario.tokenVersion), opcoesCookieRefresh());
  res.json({ accessToken: gerarAccessToken(id, usuario.tokenVersion), usuario: usuarioPublico(usuario) });
});

// POST /api/auth/logout -> invalida todas as sessoes do usuario
router.post("/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const payload = verificarRefreshToken(token);
      await Usuario.updateOne({ _id: payload.sub }, { $inc: { tokenVersion: 1 } });
      await semTenant(() =>
        registrarAuditoria(req, { acao: "auth.logout", entidade: "Usuario", entidadeId: payload.sub, usuarioId: payload.sub, municipioId: null })
      );
    } catch {
      // token invalido: so limpa o cookie
    }
  }
  const { maxAge: _ignorar, ...opcoes } = opcoesCookieRefresh();
  res.clearCookie(REFRESH_COOKIE, opcoes);
  res.json({ ok: true });
});

// GET /api/auth/me -> usuario logado + orgaos/municipios que ele acessa
router.get("/me", protect, async (req: Request, res: Response) => {
  const usuario = req.usuario!;

  const dados = await semTenant(async () => {
    const orgaoIds = usuario.vinculos.map((v) => v.orgaoId);
    const orgaos = await Orgao.find({ _id: { $in: orgaoIds } }).select("nome tipo situacao municipioId logoKey logoAtualizadoEm");
    const municipioIds = usuario.plataformaAdmin ? undefined : orgaos.map((o) => o.municipioId);
    const municipios = await Municipio.find(municipioIds ? { _id: { $in: municipioIds } } : {})
      .select("slug nome uf")
      .sort({ nome: 1 });
    return { orgaos, municipios };
  });

  const municipioPorId = new Map(dados.municipios.map((m) => [String(m._id), m]));
  const orgaoPorId = new Map(dados.orgaos.map((o) => [String(o._id), o]));

  res.json({
    usuario: usuarioPublico(usuario),
    municipios: dados.municipios.map((m) => ({ id: String(m._id), slug: m.slug, nome: m.nome, uf: m.uf })),
    // Vinculos com nomes, para o painel do usuario do orgao
    acessos: usuario.vinculos
      .map((v) => {
        const orgao = orgaoPorId.get(String(v.orgaoId));
        const municipio = municipioPorId.get(String(v.municipioId));
        if (!orgao || !municipio) return null;
        return {
          orgaoId: String(orgao._id),
          orgaoNome: orgao.nome,
          orgaoTipo: orgao.tipo,
          orgaoLogoUrl: urlLogoOrgao(orgao),
          situacao: orgao.situacao,
          municipioId: String(municipio._id),
          municipioNome: municipio.nome,
          municipioSlug: municipio.slug,
          uf: municipio.uf,
          papel: v.papel,
        };
      })
      .filter(Boolean),
  });
});

// GET /api/auth/avisos -> mensagens da populacao ainda nao lidas, por orgao (sininho do painel)
router.get("/avisos", protect, async (req: Request, res: Response) => {
  const u = req.usuario!;
  const orgaoIds = u.vinculos.map((v) => v.orgaoId);
  const dados = await semTenant(async () => {
    const orgaos = await Orgao.find({ _id: { $in: orgaoIds } }).select("nome");
    const contagem = await Mensagem.aggregate<{ _id: unknown; total: number }>([
      { $match: { orgaoId: { $in: orgaoIds }, lidaPeloOrgao: false } },
      { $group: { _id: "$orgaoId", total: { $sum: 1 } } },
    ]);
    const porOrgao = new Map(contagem.map((c) => [String(c._id), c.total]));
    return orgaos.map((o) => ({ orgaoId: String(o._id), orgaoNome: o.nome, mensagensNaoLidas: porOrgao.get(String(o._id)) ?? 0 }));
  });
  res.json({ total: dados.reduce((s, d) => s + d.mensagensNaoLidas, 0), orgaos: dados });
});

export default router;
