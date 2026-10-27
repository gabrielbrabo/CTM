import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../src/app";
import { Municipio } from "../src/models/Municipio";
import { SENHA_TESTE, criarMunicipio, criarUsuario, iniciarBancoTeste, limparBanco, pararBancoTeste } from "./setup";

// PNG 1x1 valido (para testar o envio de brasao)
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

describe("plataforma: edicao de municipios", () => {
  const app = criarApp();
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(iniciarBancoTeste);
  afterAll(pararBancoTeste);
  beforeEach(async () => {
    await limparBanco();
    await criarUsuario("gadz@teste.com", [], true);
    const r = await request(app).post("/api/auth/login").send({ email: "gadz@teste.com", senha: SENHA_TESTE });
    token = r.body.accessToken;
  });

  it("brasao vai so para o municipio escolhido, mesmo com slug antigo invalido", async () => {
    const A = await criarMunicipio("municipio-a");
    const B = await criarMunicipio("municipio-b");
    // Simula dado antigo: slug com espacos (antes travava com "Path `slug` is invalid")
    await Municipio.collection.updateOne({ _id: A.municipio._id }, { $set: { slug: "municipio de teste", nome: "Municipio de Teste" } });

    const r = await request(app)
      .post(`/api/platform/municipios/${A.municipio._id}/brasao`)
      .set(auth())
      .attach("imagem", PNG, { filename: "brasao.png", contentType: "image/png" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.id).toBe(String(A.municipio._id));

    const a = await Municipio.findById(A.municipio._id).lean();
    const b = await Municipio.findById(B.municipio._id).lean();
    expect(a?.brasaoKey).toBeTruthy();
    expect(a?.slug).toBe("municipio-de-teste"); // corrigido automaticamente
    expect(b?.brasaoKey).toBeFalsy(); // o outro nao foi tocado

    const lista = await request(app).get("/api/platform/municipios").set(auth());
    const itemA = lista.body.find((m: { id: string }) => m.id === String(A.municipio._id));
    const itemB = lista.body.find((m: { id: string }) => m.id === String(B.municipio._id));
    expect(itemA.brasaoUrl).toContain(String(A.municipio._id));
    expect(itemB.brasaoUrl).toBeNull();

    const rem = await request(app).delete(`/api/platform/municipios/${A.municipio._id}/brasao`).set(auth());
    expect(rem.status).toBe(200);
    expect((await Municipio.findById(A.municipio._id).lean())?.brasaoKey).toBeFalsy();
  });

  it("editar nome/estado funciona com slug antigo invalido", async () => {
    const A = await criarMunicipio("municipio-a");
    await Municipio.collection.updateOne({ _id: A.municipio._id }, { $set: { slug: "outro nome" } });
    const r = await request(app).patch(`/api/platform/municipios/${A.municipio._id}`).set(auth()).send({ nome: "Nova Cidade", uf: "SP" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.nome).toBe("Nova Cidade");
    expect(r.body.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("novo orgao com administrador ja cadastrado: mesmo usuario em dois orgaos", async () => {
    const r1 = await request(app)
      .post("/api/platform/orgaos")
      .set(auth())
      .send({ tipo: "camara", novoMunicipio: { nome: "Cidade Um", uf: "MG" }, admin: { nome: "Maria", email: "maria@teste.com", senha: "senha-maria-1" } });
    expect(r1.status, JSON.stringify(r1.body)).toBe(201);
    const usuarioId = r1.body.admin.id;

    const r2 = await request(app)
      .post("/api/platform/orgaos")
      .set(auth())
      .send({ tipo: "prefeitura", novoMunicipio: { nome: "Cidade Dois", uf: "SP" }, admin: { usuarioId } });
    expect(r2.status, JSON.stringify(r2.body)).toBe(201);
    expect(r2.body.admin.id).toBe(usuarioId);
    expect(r2.body.admin.criado).toBe(false);

    // Ao entrar, Maria ve os dois orgaos
    const login = await request(app).post("/api/auth/login").send({ email: "maria@teste.com", senha: "senha-maria-1" });
    const me = await request(app).get("/api/auth/me").set({ Authorization: `Bearer ${login.body.accessToken}` });
    expect(me.body.acessos.map((a: { orgaoTipo: string }) => a.orgaoTipo).sort()).toEqual(["camara", "prefeitura"]);
  });
});
