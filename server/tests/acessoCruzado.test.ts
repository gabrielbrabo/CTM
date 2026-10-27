import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../src/app";
import { semTenant } from "../src/context/tenant";
import { Auditoria } from "../src/models/Auditoria";
import { Orgao } from "../src/models/Orgao";
import { SENHA_TESTE, criarMunicipio, criarUsuario, iniciarBancoTeste, limparBanco, pararBancoTeste } from "./setup";

// Criterio de aceite: usuario de um municipio/orgao nao acessa dados de outro
describe("acesso cruzado e area da plataforma (API)", () => {
  const app = criarApp();
  let A: Awaited<ReturnType<typeof criarMunicipio>>;
  let B: Awaited<ReturnType<typeof criarMunicipio>>;
  let tokenAdminCamaraA: string;
  let tokenSuper: string;

  async function login(email: string) {
    const res = await request(app).post("/api/auth/login").send({ email, senha: SENHA_TESTE });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  beforeAll(iniciarBancoTeste);
  afterAll(pararBancoTeste);
  beforeEach(async () => {
    await limparBanco();
    A = await criarMunicipio("municipio-a");
    B = await criarMunicipio("municipio-b");
    await criarUsuario("admin-camara-a@teste.com", [
      { municipioId: A.municipio._id, orgaoId: A.camara._id, papel: "admin_orgao" },
    ]);
    await criarUsuario("super@teste.com", [], true);
    tokenAdminCamaraA = await login("admin-camara-a@teste.com");
    tokenSuper = await login("super@teste.com");
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it("usuario de A lista orgaos de A", async () => {
    const res = await request(app).get(`/api/admin/m/${A.municipio._id}/orgaos`).set(auth(tokenAdminCamaraA));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("usuario de A NAO lista orgaos de B", async () => {
    const res = await request(app).get(`/api/admin/m/${B.municipio._id}/orgaos`).set(auth(tokenAdminCamaraA));
    expect(res.status).toBe(403);
  });

  it("sem token nao entra no admin", async () => {
    const res = await request(app).get(`/api/admin/m/${A.municipio._id}/orgaos`);
    expect(res.status).toBe(401);
  });

  it("usuario comum nao acessa rotas da plataforma", async () => {
    const res = await request(app).get("/api/platform/orgaos").set(auth(tokenAdminCamaraA));
    expect(res.status).toBe(403);
  });

  it("superadmin cadastra Camara em municipio novo com administrador", async () => {
    const res = await request(app)
      .post("/api/platform/orgaos")
      .set(auth(tokenSuper))
      .send({
        tipo: "camara",
        novoMunicipio: { nome: "São Teste", uf: "MG" },
        cnpj: "12.345.678/0001-90",
        contrato: { numero: "01/2026", inicio: "2026-01-01", fim: "2026-12-31", valorMensal: 1500.5 },
        admin: { nome: "Admin Camara", email: "camara@teste.com", senha: "senha-forte-1" },
      });
    expect(res.status).toBe(201);
    expect(res.body.orgao.nome).toBe("Câmara Municipal de São Teste");
    expect(res.body.orgao.municipio.slug).toBe("sao-teste");
    expect(res.body.orgao.contrato.valorMensal).toBe(1500.5);
    expect(res.body.admin.papel).toBe("admin_orgao");

    // Municipio aparece no portal so com a Camara
    const pub = await request(app).get("/api/public/m/sao-teste");
    expect(pub.body.orgaos.map((o: { tipo: string }) => o.tipo)).toEqual(["camara"]);

    // O admin novo consegue entrar
    const login = await request(app).post("/api/auth/login").send({ email: "camara@teste.com", senha: "senha-forte-1" });
    expect(login.status).toBe(200);

    const logs = await semTenant(() => Auditoria.find({ acao: "orgao.criar" }));
    expect(logs).toHaveLength(1);
  });

  it("nao permite duas Camaras no mesmo municipio", async () => {
    const res = await request(app)
      .post("/api/platform/orgaos")
      .set(auth(tokenSuper))
      .send({
        tipo: "camara",
        municipioId: String(A.municipio._id),
        admin: { nome: "Fulano", email: "x@teste.com", senha: "senha-forte-1" },
      });
    expect(res.status, JSON.stringify(res.body)).toBe(409);
  });

  it("orgao suspenso some do portal; municipio sem orgao ativo some da lista", async () => {
    await request(app).patch(`/api/platform/orgaos/${B.camara._id}`).set(auth(tokenSuper)).send({ situacao: "suspenso" });
    let pub = await request(app).get("/api/public/m/municipio-b");
    expect(pub.body.orgaos.map((o: { tipo: string }) => o.tipo)).toEqual(["prefeitura"]);

    await request(app).patch(`/api/platform/orgaos/${B.prefeitura._id}`).set(auth(tokenSuper)).send({ situacao: "encerrado" });
    const lista = await request(app).get("/api/public/municipios");
    expect(lista.body.map((m: { slug: string }) => m.slug)).toEqual(["municipio-a"]);

    const orgaoB = await semTenant(() => Orgao.findById(B.prefeitura._id));
    expect(orgaoB?.situacao).toBe("encerrado");
  });

  it("portal publico lista municipios em ordem de cadastro", async () => {
    const res = await request(app).get("/api/public/municipios");
    expect(res.body.map((m: { slug: string }) => m.slug)).toEqual(["municipio-a", "municipio-b"]);
  });

  it("logos: GADZ envia brasao do municipio e logo do orgao; portal mostra as imagens", async () => {
    // PNG 1x1 valido
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    let r = await request(app)
      .post(`/api/platform/municipios/${A.municipio._id}/brasao`)
      .set(auth(tokenSuper))
      .attach("imagem", png, { filename: "brasao.png", contentType: "image/png" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);

    r = await request(app)
      .post(`/api/platform/orgaos/${A.camara._id}/logo`)
      .set(auth(tokenSuper))
      .attach("imagem", Buffer.from("nao e imagem"), { filename: "x.png", contentType: "image/png" });
    expect(r.status).toBe(400);

    // Admin do orgao troca a propria logo; nao consegue trocar a da Prefeitura
    r = await request(app)
      .post(`/api/admin/o/${A.camara._id}/logo`)
      .set(auth(tokenAdminCamaraA))
      .attach("imagem", png, { filename: "logo.png", contentType: "image/png" });
    expect(r.status).toBe(200);
    r = await request(app)
      .post(`/api/admin/o/${A.prefeitura._id}/logo`)
      .set(auth(tokenAdminCamaraA))
      .attach("imagem", png, { filename: "logo.png", contentType: "image/png" });
    expect(r.status).toBe(403);

    const lista = await request(app).get("/api/public/municipios");
    const munA = lista.body.find((m: { slug: string }) => m.slug === "municipio-a");
    expect(munA.brasaoUrl).toMatch(/^\/api\/public\/imagens\/municipio\//);

    const pub = await request(app).get("/api/public/m/municipio-a");
    const camara = pub.body.orgaos.find((o: { tipo: string }) => o.tipo === "camara");
    expect(camara.logoUrl).toBeTruthy();
    const img = await request(app).get(camara.logoUrl);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");
    expect(img.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });
});
