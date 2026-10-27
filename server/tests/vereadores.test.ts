import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../src/app";
import { SENHA_TESTE, criarMunicipio, criarUsuario, iniciarBancoTeste, limparBanco, pararBancoTeste } from "./setup";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

describe("vereadores", () => {
  const app = criarApp();
  let A: Awaited<ReturnType<typeof criarMunicipio>>;
  let B: Awaited<ReturnType<typeof criarMunicipio>>;
  let tAdmin: string;
  let tEditor: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const base = () => `/api/admin/o/${A.camara._id}`;
  async function login(email: string) {
    const r = await request(app).post("/api/auth/login").send({ email, senha: SENHA_TESTE });
    return r.body.accessToken as string;
  }
  async function novoVereador(t: string, dados: Record<string, unknown>, orgao = A.camara._id) {
    return request(app).post(`/api/admin/o/${orgao}/vereadores`).set(auth(t)).send(dados);
  }

  beforeAll(iniciarBancoTeste);
  afterAll(pararBancoTeste);
  beforeEach(async () => {
    await limparBanco();
    A = await criarMunicipio("municipio-a");
    B = await criarMunicipio("municipio-b");
    await criarUsuario("admin@camara.com", [{ municipioId: A.municipio._id, orgaoId: A.camara._id, papel: "admin_orgao" }]);
    await criarUsuario("editor@camara.com", [{ municipioId: A.municipio._id, orgaoId: A.camara._id, papel: "editor" }]);
    await criarUsuario("admin@pref.com", [{ municipioId: A.municipio._id, orgaoId: A.prefeitura._id, papel: "admin_orgao" }]);
    await criarUsuario("admin@camarab.com", [{ municipioId: B.municipio._id, orgaoId: B.camara._id, papel: "admin_orgao" }]);
    tAdmin = await login("admin@camara.com");
    tEditor = await login("editor@camara.com");
  });

  it("cadastro, foto, autoria, votos, presenca, portal e exclusao", async () => {
    // Cadastro (so admin); editor so lista; Prefeitura nao tem
    const ana = (await novoVereador(tAdmin, { nome: "Ana Maria Souza", nomeParlamentar: "Ana Souza", partido: "ABC", cargoMesa: "presidente" })).body;
    const beto = (await novoVereador(tAdmin, { nome: "Roberto Lima", partido: "XYZ" })).body;
    const caio = (await novoVereador(tAdmin, { nome: "Caio Prado" })).body;
    expect(ana.id).toBeTruthy();
    expect((await novoVereador(tEditor, { nome: "Fulano" })).status).toBe(403);
    expect((await request(app).get(`${base()}/vereadores`).set(auth(tEditor))).body).toHaveLength(3);
    const tPref = await login("admin@pref.com");
    // Prefeitura: so ve a lista da Camara (para lancar votacao), nao cadastra
    expect((await request(app).get(`/api/admin/o/${A.prefeitura._id}/vereadores`).set(auth(tPref))).body).toHaveLength(3);
    expect((await novoVereador(tPref, { nome: "Fulano" }, A.prefeitura._id)).status).toBe(404);

    // Foto
    const foto = await request(app).post(`${base()}/vereadores/${ana.id}/foto`).set(auth(tAdmin)).attach("imagem", PNG, { filename: "a.png", contentType: "image/png" });
    expect(foto.status).toBe(200);
    expect(foto.body.fotoUrl).toContain(`/imagens/vereador/${ana.id}`);
    expect((await request(app).get(foto.body.fotoUrl)).status).toBe(200);

    // Projeto de lei: autor obrigatorio (vereador da lista OU "Outros autores")
    const detalhesPL = { especie: "Projeto de Lei Ordinária", ementa: "Dispõe sobre praças", situacao: "Apresentado" };
    let r = await request(app).post(`${base()}/publicacoes`).set(auth(tEditor)).send({ tipo: "projeto_lei", titulo: "PL 1/2026", detalhes: detalhesPL });
    expect(r.status).toBe(400);
    r = await request(app)
      .post(`${base()}/publicacoes`)
      .set(auth(tEditor))
      .send({ tipo: "projeto_lei", titulo: "PL 1/2026", detalhes: detalhesPL, autoresIds: [ana.id, beto.id] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.autoresIds).toEqual([ana.id, beto.id]);
    const pl = r.body;

    // Vereador de outra Camara nao pode
    const tB = await login("admin@camarab.com");
    const deB = (await novoVereador(tB, { nome: "De Outra Cidade" }, B.camara._id)).body;
    r = await request(app).patch(`${base()}/publicacoes/${pl.id}`).set(auth(tEditor)).send({ autoresIds: [deB.id] });
    expect(r.status).toBe(400);

    // Votacao nominal: a contagem vem dos votos
    r = await request(app)
      .post(`${base()}/publicacoes`)
      .set(auth(tEditor))
      .send({
        tipo: "votacao",
        titulo: "Votação do PL 1/2026",
        detalhes: { materia: "PL 1/2026", dataVotacao: "2026-10-20", resultado: "Aprovado" },
        votos: [
          { vereadorId: ana.id, voto: "sim" },
          { vereadorId: beto.id, voto: "nao" },
          { vereadorId: caio.id, voto: "sim" },
        ],
      });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.detalhes.votosSim).toBe(2);
    expect(r.body.detalhes.votosNao).toBe(1);
    const vot = r.body;

    // Presenca na sessao
    r = await request(app)
      .post(`${base()}/publicacoes`)
      .set(auth(tEditor))
      .send({
        tipo: "sessao",
        titulo: "20ª Sessão Ordinária",
        detalhes: { tipoSessao: "Ordinária", dataHora: "2026-10-20T19:00" },
        presencas: [
          { vereadorId: ana.id, situacao: "presente" },
          { vereadorId: beto.id, situacao: "justificada" },
        ],
      });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const ses = r.body;

    for (const p of [pl, vot, ses]) await request(app).post(`${base()}/publicacoes/${p.id}/publicar`).set(auth(tEditor));

    // Portal: lista, perfil, autores na publicacao e filtro do feed
    const lista = await request(app).get("/api/public/m/municipio-a/vereadores");
    expect(lista.status).toBe(200);
    expect(lista.body.vereadores[0].nome).toBe("Ana Maria Souza"); // presidente primeiro
    const perfil = await request(app).get(`/api/public/m/municipio-a/vereadores/${ana.id}`);
    expect(perfil.body.autorias.total).toBe(1);
    expect(perfil.body.votos[0].voto).toBe("sim");
    expect(perfil.body.presencas.presente).toBe(1);
    const det = await request(app).get(`/api/public/m/municipio-a/p/${pl.slug}`);
    expect(det.body.publicacao.vereadores.autores.map((a: { nome: string }) => a.nome)).toEqual(["Ana Souza", "Roberto Lima"]);
    const feed = await request(app).get(`/api/public/m/municipio-a/feed?vereador=${beto.id}`);
    expect(feed.body.itens.map((i: { titulo: string }) => i.titulo)).toEqual(["PL 1/2026"]);
    expect(feed.body.itens[0].autores).toHaveLength(2);
    // Contagem por tipo (etiquetas da lista), inclusive com busca por palavra
    const todos = await request(app).get("/api/public/m/municipio-a/feed?orgao=camara");
    expect(todos.body.porTipo).toEqual(expect.arrayContaining([{ tipo: "projeto_lei", total: 1 }, { tipo: "votacao", total: 1 }]));
    const busca = await request(app).get("/api/public/m/municipio-a/feed?orgao=camara&q=praças&tipo=projeto_lei");
    expect(busca.status, JSON.stringify(busca.body)).toBe(200);
    expect(busca.body.porTipo).toEqual([{ tipo: "projeto_lei", total: 1 }]);
    expect((await request(app).get(`/api/public/m/municipio-a/p/${vot.slug}/impressao.pdf`)).status).toBe(200);

    // Lei da Prefeitura com a votacao da Camara: aparece no perfil do vereador
    const lei = await request(app)
      .post(`/api/admin/o/${A.prefeitura._id}/publicacoes`)
      .set(auth(tPref))
      .send({
        tipo: "lei",
        titulo: "Lei 50/2026",
        numero: "50/2026",
        detalhes: { ementa: "Cria o programa", dataSancao: "2026-10-22" },
        votos: [{ vereadorId: ana.id, voto: "sim" }],
        autoresIds: [ana.id], // Prefeitura nao tem autoria de vereador: e ignorado
      });
    expect(lei.status, JSON.stringify(lei.body)).toBe(201);
    expect(lei.body.votos).toHaveLength(1);
    expect(lei.body.autoresIds).toHaveLength(0);
    await request(app).post(`/api/admin/o/${A.prefeitura._id}/publicacoes/${lei.body.id}/publicar`).set(auth(tPref));
    const perfil2 = await request(app).get(`/api/public/m/municipio-a/vereadores/${ana.id}`);
    expect(perfil2.body.votos.map((x: { titulo: string }) => x.titulo)).toContain("Lei 50/2026");

    // Nao deixa cadastrar a mesma publicacao duas vezes (mesmo numero, com zero a esquerda)
    const repetida = await request(app)
      .post(`/api/admin/o/${A.prefeitura._id}/publicacoes`)
      .set(auth(tPref))
      .send({ tipo: "lei", titulo: "Lei nº 050/2026 de novo", numero: "nº 050/2026", detalhes: { ementa: "x", dataSancao: "2026-10-22" } });
    expect(repetida.status).toBe(409);
    expect(repetida.body.existenteId).toBe(lei.body.id);
    // Sem numero: mesmo titulo tambem e barrado
    const semNumero = await request(app)
      .post(`${base()}/publicacoes`)
      .set(auth(tEditor))
      .send({ tipo: "sessao", titulo: "20ª sessão ordinária ", detalhes: { tipoSessao: "Ordinária", dataHora: "2026-10-20T19:00" } });
    expect(semNumero.status).toBe(409);

    // Exclusao: quem esta em publicacao nao pode (vira ex-vereador); quem nao esta, pode
    expect((await request(app).delete(`${base()}/vereadores/${beto.id}`).set(auth(tAdmin))).status).toBe(409);
    const tirarCaio = await request(app)
      .patch(`${base()}/publicacoes/${vot.id}`)
      .set(auth(tAdmin))
      .send({ motivo: "Correção dos votos", votos: [{ vereadorId: ana.id, voto: "sim" }, { vereadorId: beto.id, voto: "nao" }] });
    expect(tirarCaio.status).toBe(200);
    expect(tirarCaio.body.detalhes.votosSim).toBe(1);
    expect((await request(app).delete(`${base()}/vereadores/${caio.id}`).set(auth(tAdmin))).status).toBe(200);

    // Ex-vereador oculto do portal
    await request(app).patch(`${base()}/vereadores/${beto.id}`).set(auth(tAdmin)).send({ situacao: "ex", mostrarNoPortal: false });
    expect((await request(app).get(`/api/public/m/municipio-a/vereadores/${beto.id}`)).status).toBe(404);
  });
});
