import bcrypt from "bcryptjs";
import { conectarBanco, desconectarBanco } from "../config/db";
import { semTenant } from "../context/tenant";
import { Municipio } from "../models/Municipio";
import { Orgao, TIPOS_CONTRATANTE, TipoContratante, nomePadraoOrgao } from "../models/Orgao";
import { Usuario } from "../models/Usuario";
import { slugify } from "../utils/slug";

/**
 * Cria (ou reaproveita) um orgao e um usuario ADMINISTRADOR DO ORGAO para testes.
 * Pode rodar varias vezes: nao duplica nada.
 *
 * Uso (na pasta server):
 *   npm run orgao:teste
 *   npm run orgao:teste -- --municipio "São Romão" --uf MG --tipo camara --email eu@teste.com --senha minhasenha
 *
 * Padrao: Camara de "Municipio Teste"/MG, login camara@teste.com / camara12345
 * Obs.: use um e-mail DIFERENTE do superadmin, senao voce cai no painel da GADZ.
 */

// Le argumentos no formato --nome valor
function lerArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const lista = process.argv.slice(2);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].startsWith("--")) {
      args[lista[i].slice(2)] = lista[i + 1] ?? "";
      i++;
    }
  }
  return args;
}

async function main() {
  const a = lerArgs();
  const municipioNome = a.municipio || "Município Teste";
  const uf = (a.uf || "MG").toUpperCase();
  const tipo = (a.tipo || "camara") as TipoContratante;
  const email = (a.email || "camara@teste.com").toLowerCase();
  const senha = a.senha || "camara12345";
  const nome = a.nome || "Administrador da Câmara";

  if (!(TIPOS_CONTRATANTE as readonly string[]).includes(tipo)) throw new Error('--tipo deve ser "camara" ou "prefeitura"');
  if (senha.length < 8) throw new Error("--senha precisa ter no minimo 8 caracteres");

  await conectarBanco();

  await semTenant(async () => {
    // 1) Municipio
    let municipio = await Municipio.findOne({ nome: municipioNome, uf });
    if (!municipio) {
      let slug = slugify(municipioNome);
      if (await Municipio.exists({ slug })) slug = `${slug}-${uf.toLowerCase()}`;
      municipio = await Municipio.create({ nome: municipioNome, uf, slug });
      console.log(`[ok] municipio criado: ${municipio.nome}/${uf} (/${slug})`);
    } else {
      console.log(`[ok] municipio ja existia: ${municipio.nome}/${uf}`);
    }

    // 2) Orgao (Camara ou Prefeitura)
    let orgao = await Orgao.findOne({ municipioId: municipio._id, tipo });
    if (!orgao) {
      const hoje = new Date();
      orgao = await Orgao.create({
        municipioId: municipio._id,
        tipo,
        nome: nomePadraoOrgao(tipo, municipio.nome),
        situacao: "ativo",
        contrato: {
          numero: "TESTE",
          inicio: hoje,
          fim: new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate()),
          valorMensalCentavos: 0,
          observacoes: "Criado pelo script de teste",
        },
      });
      console.log(`[ok] orgao criado: ${orgao.nome}`);
    } else {
      if (orgao.situacao !== "ativo") {
        orgao.situacao = "ativo";
        await orgao.save();
      }
      console.log(`[ok] orgao ja existia: ${orgao.nome} (situacao: ativo)`);
    }

    // 3) Usuario administrador do orgao
    let usuario = await Usuario.findOne({ email });
    if (!usuario) {
      usuario = await Usuario.create({ nome, email, senhaHash: await bcrypt.hash(senha, 12), vinculos: [] });
      console.log(`[ok] usuario criado: ${email}`);
    } else {
      // Garante a senha informada e reativa, para facilitar o teste
      usuario.senhaHash = await bcrypt.hash(senha, 12);
      usuario.ativo = true;
      usuario.tokenVersion += 1;
      console.log(`[ok] usuario ja existia: ${email} (senha redefinida)`);
    }
    if (usuario.plataformaAdmin) {
      console.warn("[aviso] este e-mail e do SUPERADMIN: ao entrar voce vera o painel da GADZ, nao o do orgao.");
    }

    const vinculo = usuario.vinculos.find((v) => String(v.orgaoId) === String(orgao!._id));
    if (vinculo) vinculo.papel = "admin_orgao";
    else usuario.vinculos.push({ municipioId: municipio._id, orgaoId: orgao._id, papel: "admin_orgao" });
    await usuario.save();

    console.log("\n=== Pronto! Acesse http://localhost:5173/admin/login ===");
    console.log(`E-mail: ${email}`);
    console.log(`Senha:  ${senha}`);
    console.log(`Orgao:  ${orgao.nome} (${municipio.nome}/${uf}) — Administrador`);
  });

  await desconectarBanco();
}

main().catch(async (err) => {
  console.error("[erro]", err instanceof Error ? err.message : err);
  await desconectarBanco();
  process.exit(1);
});
