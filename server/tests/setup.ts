import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { semTenant } from "../src/context/tenant";
import { Municipio } from "../src/models/Municipio";
import { Orgao } from "../src/models/Orgao";
import { Papel, Usuario } from "../src/models/Usuario";

// Sobe um MongoDB temporario em memoria (na 1a vez baixa o binario do MongoDB)
let servidor: MongoMemoryServer;

export async function iniciarBancoTeste() {
  servidor = await MongoMemoryServer.create();
  await mongoose.connect(servidor.getUri());
}

export async function pararBancoTeste() {
  await mongoose.disconnect();
  await servidor?.stop();
}

export async function limparBanco() {
  await mongoose.connection.db?.dropDatabase();
  // Recria os indices (ex.: e-mail unico) depois de apagar o banco
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

// Cria um municipio com Prefeitura e Camara
export async function criarMunicipio(slug: string) {
  return semTenant(async () => {
    const municipio = await Municipio.create({ slug, nome: slug.toUpperCase(), uf: "MG" });
    const [prefeitura, camara] = await Orgao.create([
      { municipioId: municipio._id, tipo: "prefeitura", nome: `Prefeitura ${slug}` },
      { municipioId: municipio._id, tipo: "camara", nome: `Camara ${slug}` },
    ]);
    return { municipio, prefeitura, camara };
  });
}

export const SENHA_TESTE = "senha-de-teste-123";

export async function criarUsuario(
  email: string,
  vinculos: { municipioId: Types.ObjectId; orgaoId: Types.ObjectId; papel: Papel }[],
  plataformaAdmin = false
) {
  return Usuario.create({
    nome: email,
    email,
    senhaHash: await bcrypt.hash(SENHA_TESTE, 4),
    plataformaAdmin,
    vinculos,
  });
}
