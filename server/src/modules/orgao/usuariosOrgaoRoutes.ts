import bcrypt from "bcryptjs";
import { Request, Response, Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { exigePapel } from "../../middleware/orgao";
import { PAPEIS, Usuario, UsuarioDoc } from "../../models/Usuario";
import { registrarAuditoria } from "../../utils/audit";
import { HttpError, naoEncontrado } from "../../utils/httpError";

/**
 * Usuarios do orgao — so o ADMINISTRADOR DO ORGAO mexe aqui.
 * Montado em /api/admin/o/:orgaoId/usuarios
 */
const router = Router({ mergeParams: true });
router.use(exigePapel("admin_orgao"));

const vazioParaUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

function resumo(u: UsuarioDoc, orgaoId: string) {
  const vinculo = u.vinculos.find((v) => String(v.orgaoId) === orgaoId);
  return {
    id: String(u._id),
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    papel: vinculo?.papel ?? null,
    ultimoLogin: u.ultimoLogin ?? null,
    // Se o usuario tem acesso a outros orgaos, o admin deste nao pode trocar a senha dele
    outrosOrgaos: u.vinculos.length > 1 || u.plataformaAdmin,
  };
}

async function contarAdmins(orgaoId: string) {
  return Usuario.countDocuments({
    vinculos: { $elemMatch: { orgaoId: new Types.ObjectId(orgaoId), papel: "admin_orgao" } },
    ativo: true,
  });
}

async function usuarioDoOrgao(req: Request) {
  const usuario = await Usuario.findById(req.params.usuarioId);
  const orgaoId = String(req.orgao!._id);
  if (!usuario || !usuario.vinculos.some((v) => String(v.orgaoId) === orgaoId)) {
    throw naoEncontrado("Usuario nao encontrado neste orgao");
  }
  return usuario;
}

// GET /usuarios
router.get("/", async (req: Request, res: Response) => {
  const orgaoId = String(req.orgao!._id);
  const usuarios = await Usuario.find({ "vinculos.orgaoId": req.orgao!._id }).sort({ nome: 1 });
  res.json(usuarios.map((u) => resumo(u, orgaoId)));
});

const novoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.string().trim().toLowerCase().email("E-mail invalido"),
  senha: z.preprocess(vazioParaUndef, z.string().min(8, "Senha com no minimo 8 caracteres").optional()),
  papel: z.enum(PAPEIS),
});

// POST /usuarios -> cria ou da acesso a um usuario existente
router.post("/", async (req: Request, res: Response) => {
  const dados = novoSchema.parse(req.body);
  const orgao = req.orgao!;
  const orgaoId = String(orgao._id);

  let usuario = await Usuario.findOne({ email: dados.email });
  let criado = false;
  if (!usuario) {
    if (!dados.senha) throw new HttpError(400, "Informe uma senha inicial para o novo usuario");
    usuario = await Usuario.create({
      nome: dados.nome,
      email: dados.email,
      senhaHash: await bcrypt.hash(dados.senha, 12),
      vinculos: [],
    });
    criado = true;
  } else if (usuario.vinculos.some((v) => String(v.orgaoId) === orgaoId)) {
    throw new HttpError(409, "Este usuario ja faz parte do orgao");
  }

  usuario.vinculos.push({ municipioId: orgao.municipioId, orgaoId: orgao._id, papel: dados.papel });
  await usuario.save();

  await registrarAuditoria(req, {
    acao: criado ? "usuario.criar" : "usuario.vincular",
    entidade: "Usuario",
    entidadeId: usuario._id,
    diff: { email: dados.email, orgaoId, papel: dados.papel },
  });
  res.status(201).json({ ...resumo(usuario, orgaoId), criado });
});

const editarSchema = z.object({
  papel: z.enum(PAPEIS).optional(),
  novaSenha: z.preprocess(vazioParaUndef, z.string().min(8, "Senha com no minimo 8 caracteres").optional()),
});

// PATCH /usuarios/:usuarioId -> troca papel ou senha
router.patch("/:usuarioId", async (req: Request, res: Response) => {
  const dados = editarSchema.parse(req.body);
  const orgaoId = String(req.orgao!._id);
  const usuario = await usuarioDoOrgao(req);
  const vinculo = usuario.vinculos.find((v) => String(v.orgaoId) === orgaoId)!;

  if (dados.papel && dados.papel !== vinculo.papel) {
    // Nao deixa o orgao ficar sem administrador
    if (vinculo.papel === "admin_orgao" && (await contarAdmins(orgaoId)) <= 1) {
      throw new HttpError(400, "O órgão precisa ter pelo menos um administrador");
    }
    vinculo.papel = dados.papel;
  }

  if (dados.novaSenha) {
    if (usuario.vinculos.length > 1 || usuario.plataformaAdmin) {
      throw new HttpError(403, "Este usuário tem acesso a outros órgãos; a senha só pode ser trocada pela GADZ");
    }
    usuario.senhaHash = await bcrypt.hash(dados.novaSenha, 12);
    usuario.tokenVersion += 1;
  }

  await usuario.save();
  await registrarAuditoria(req, {
    acao: "usuario.editar",
    entidade: "Usuario",
    entidadeId: usuario._id,
    diff: { papel: dados.papel, trocouSenha: Boolean(dados.novaSenha) },
  });
  res.json(resumo(usuario, orgaoId));
});

// DELETE /usuarios/:usuarioId -> remove o acesso ao orgao (nao apaga a conta)
router.delete("/:usuarioId", async (req: Request, res: Response) => {
  const orgaoId = String(req.orgao!._id);
  const usuario = await usuarioDoOrgao(req);
  const vinculo = usuario.vinculos.find((v) => String(v.orgaoId) === orgaoId)!;

  if (vinculo.papel === "admin_orgao" && (await contarAdmins(orgaoId)) <= 1) {
    throw new HttpError(400, "O órgão precisa ter pelo menos um administrador");
  }

  usuario.vinculos = usuario.vinculos.filter((v) => String(v.orgaoId) !== orgaoId);
  usuario.tokenVersion += 1;
  await usuario.save();
  await registrarAuditoria(req, {
    acao: "usuario.desvincular",
    entidade: "Usuario",
    entidadeId: usuario._id,
    diff: { orgaoId },
  });
  res.json({ ok: true });
});

export default router;
