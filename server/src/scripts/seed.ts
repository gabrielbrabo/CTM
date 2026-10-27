import bcrypt from "bcryptjs";
import { conectarBanco, desconectarBanco } from "../config/db";
import { semTenant } from "../context/tenant";
import { Municipio } from "../models/Municipio";
import { Orgao } from "../models/Orgao";
import { Publicacao, normalizarNumero, normalizarTitulo } from "../models/Publicacao";
import { Usuario } from "../models/Usuario";
import { Vereador } from "../models/Vereador";
import { Cidadao } from "../models/Cidadao";
import { Mensagem } from "../models/Mensagem";
import { Notificacao } from "../models/Notificacao";
import { slugify } from "../utils/slug";

/**
 * Prepara o banco (pode rodar varias vezes, nao duplica):
 * - cria o superadmin da plataforma (dados do .env) -> e com ele que voce
 *   entra em /admin e cadastra municipios, orgaos e administradores
 * - atualiza orgaos antigos para o formato novo (contratante + situacao)
 */
async function seed() {
  await conectarBanco();

  const nome = process.env.SEED_ADMIN_NOME || "Administrador GADZ";
  // trim(): evita espaco sobrando no .env virar parte do e-mail/senha
  const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const senha = (process.env.SEED_ADMIN_SENHA || "").trim();
  if (!email || senha.length < 8) {
    throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_SENHA (min. 8 caracteres) no .env");
  }

  await semTenant(async () => {
    const existe = await Usuario.findOne({ email });
    if (existe) {
      // Sempre sincroniza com o .env: se a senha foi trocada no .env, passa a valer
      existe.senhaHash = await bcrypt.hash(senha, 12);
      existe.plataformaAdmin = true;
      existe.ativo = true;
      existe.tokenVersion += 1;
      await existe.save();
      console.log(`[seed] superadmin ja existia: ${email} (senha atualizada conforme o .env)`);
    } else {
      await Usuario.create({ nome, email, senhaHash: await bcrypt.hash(senha, 12), plataformaAdmin: true });
      console.log(`[seed] superadmin criado: ${email}`);
    }

    // Migracao: orgaos criados antes do campo "situacao"/"contratante"
    for (const tipo of ["prefeitura", "camara"]) {
      const r = await Orgao.updateMany({ tipo, contratante: { $ne: true } }, { $set: { contratante: true } });
      if (r.modifiedCount) console.log(`[seed] ${r.modifiedCount} ${tipo}(s) marcada(s) como contratante`);
    }
    const r2 = await Orgao.updateMany({ situacao: { $exists: false } }, { $set: { situacao: "ativo" } });
    if (r2.modifiedCount) console.log(`[seed] ${r2.modifiedCount} orgao(s) com situacao "ativo"`);

    // Corrige municipios com endereco (slug) invalido, ex.: "municipio de teste"
    const invalidos = await Municipio.find({ slug: { $not: /^[a-z0-9-]+$/ } }).lean();
    for (const m of invalidos) {
      const base = slugify(m.nome) || "municipio";
      const comUf = `${base}-${m.uf.toLowerCase()}`;
      let novo = base;
      let n = 1;
      while (await Municipio.exists({ slug: novo, _id: { $ne: m._id } })) {
        novo = n === 1 ? comUf : `${comUf}-${n}`;
        n++;
      }
      await Municipio.updateOne({ _id: m._id }, { $set: { slug: novo } });
      console.log(`[seed] endereco do municipio "${m.nome}" corrigido: "${m.slug}" -> "${novo}"`);
    }

    // Chaves que impedem publicacao repetida (publicacoes antigas)
    const semChave = await Publicacao.find({ tituloNormalizado: { $exists: false } }).select("numero titulo").lean();
    for (const p of semChave) {
      await Publicacao.updateOne(
        { _id: p._id },
        { $set: { numeroNormalizado: normalizarNumero(p.numero) || null, tituloNormalizado: normalizarTitulo(p.titulo) } }
      );
    }
    if (semChave.length) console.log(`[seed] ${semChave.length} publicação(ões) preparada(s) contra duplicidade`);

    // Recria os indices (inclui o de "uma Prefeitura/Camara por municipio")
    await Orgao.syncIndexes();
    await Publicacao.syncIndexes();
    await Vereador.syncIndexes();
    await Cidadao.syncIndexes();
    await Mensagem.syncIndexes();
    await Notificacao.syncIndexes();
  });

  console.log(`[seed] pronto. Entre em /admin/login com: ${email} e a senha do SEED_ADMIN_SENHA (${senha.length} caracteres).`);
  await desconectarBanco();
}

seed().catch(async (err) => {
  console.error("[seed] erro:", err);
  await desconectarBanco();
  process.exit(1);
});
