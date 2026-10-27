import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../src/app";
import { SENHA_TESTE, criarMunicipio, criarUsuario, iniciarBancoTeste, limparBanco, pararBancoTeste } from "./setup";

describe("historico de movimentacao", () => {
  const app = criarApp();
  let A: Awaited<ReturnType<typeof criarMunicipio>>;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  async function login(email: string) {
    const r = await request(app).post("/api/auth/login").send({ email, senha: SENHA_TESTE });
    expect(r.status).toBe(200);
    return r.body.accessToken as string;
  }

  beforeAll(iniciarBancoTeste);
  afterAll(pararBancoTeste);
  beforeEach(async () => {
    await limparBanco();
    A = await criarMunicipio("municipio-a");
    const m = A.municipio._id;
    await criarUsuario("admin@camara.com", [{ municipioId: m, orgaoId: A.camara._id, papel: "admin_orgao" }]);
    await criarUsuario("editor@camara.com", [{ municipioId: m, orgaoId: A.camara._id, papel: "editor" }]);
    await criarUsuario("admin@prefeitura.com", [{ municipioId: m, orgaoId: A.prefeitura._id, papel: "admin_orgao" }]);
    await criarUsuario("gadz@teste.com", [], true);
  });

  it("registra quem fez o que; admin ve so o seu orgao; editor nao ve; GADZ ve tudo", async () => {
    const tEditor = await login("editor@camara.com");
    const pub = await request(app)
      .post(`/api/admin/o/${A.camara._id}/publicacoes`)
      .set(auth(tEditor))
      .send({ tipo: "comunicado", titulo: "Sessão extraordinária", conteudo: "Texto" });
    expect(pub.status).toBe(201);
    await request(app).post(`/api/admin/o/${A.camara._id}/publicacoes/${pub.body.id}/publicar`).set(auth(tEditor));
    await request(app).post("/api/auth/login").send({ email: "editor@camara.com", senha: "errada-123" });

    // Admin da Camara
    const tAdmin = await login("admin@camara.com");
    const h = await request(app).get(`/api/admin/o/${A.camara._id}/historico`).set(auth(tAdmin));
    expect(h.status).toBe(200);
    const acoes = h.body.itens.map((i: { acao: string }) => i.acao);
    expect(acoes).toContain("publicacao.criar");
    expect(acoes).toContain("publicacao.publicar");
    const criar = h.body.itens.find((i: { acao: string }) => i.acao === "publicacao.criar");
    expect(criar.usuario.email).toBe("editor@camara.com");
    expect(criar.alvo).toBe("Sessão extraordinária");
    expect(criar.ip).toBeNull();

    // Filtros: por pessoa e por tipo de acao
    const soPub = await request(app).get(`/api/admin/o/${A.camara._id}/historico?acao=publicacao.publicar`).set(auth(tAdmin));
    expect(soPub.body.itens.every((i: { acao: string }) => i.acao === "publicacao.publicar")).toBe(true);
    const ninguem = await request(app).get(`/api/admin/o/${A.camara._id}/historico?q=ninguem`).set(auth(tAdmin));
    expect(ninguem.body.total).toBe(0);

    // Editor nao acessa o historico
    expect((await request(app).get(`/api/admin/o/${A.camara._id}/historico`).set(auth(tEditor))).status).toBe(403);

    // Prefeitura do mesmo municipio nao ve as acoes da Camara
    const tPref = await login("admin@prefeitura.com");
    const hp = await request(app).get(`/api/admin/o/${A.prefeitura._id}/historico`).set(auth(tPref));
    expect(hp.body.itens.some((i: { acao: string }) => i.acao.startsWith("publicacao."))).toBe(false);

    // GADZ ve tudo, inclusive a tentativa de login errada
    const tGadz = await login("gadz@teste.com");
    const hg = await request(app).get("/api/platform/historico").set(auth(tGadz));
    expect(hg.status).toBe(200);
    const falhou = hg.body.itens.find((i: { acao: string }) => i.acao === "auth.login_falhou");
    expect(falhou).toBeTruthy();
    expect(JSON.stringify(falhou.detalhes)).not.toContain("errada-123");
  });
});
