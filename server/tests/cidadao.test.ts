import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../src/app";
import { semTenant } from "../src/context/tenant";
import { Orgao } from "../src/models/Orgao";
import { SENHA_TESTE, criarMunicipio, criarUsuario, iniciarBancoTeste, limparBanco, pararBancoTeste } from "./setup";

describe("conta da populacao: notificacoes e mensagens", () => {
  const app = criarApp();
  let A: Awaited<ReturnType<typeof criarMunicipio>>;
  let tCamara: string;
  let tPref: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const loginServidor = async (email: string) =>
    (await request(app).post("/api/auth/login").send({ email, senha: SENHA_TESTE })).body.accessToken as string;

  beforeAll(iniciarBancoTeste);
  afterAll(pararBancoTeste);
  beforeEach(async () => {
    await limparBanco();
    A = await criarMunicipio("municipio-a");
    await criarUsuario("editor@camara.com", [{ municipioId: A.municipio._id, orgaoId: A.camara._id, papel: "editor" }]);
    await criarUsuario("admin@pref.com", [{ municipioId: A.municipio._id, orgaoId: A.prefeitura._id, papel: "admin_orgao" }]);
    tCamara = await loginServidor("editor@camara.com");
    tPref = await loginServidor("admin@pref.com");
  });

  it("cadastro, notificacao ao publicar, mensagem e resposta", async () => {
    // Ler o portal continua sem conta
    expect((await request(app).get("/api/public/m/municipio-a")).status).toBe(200);

    // Cadastro e login do cidadao
    let r = await request(app).post("/api/cidadao/auth/cadastro").send({ nome: "José Cidadão", email: "jose@email.com", senha: "senha-jose-1" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect((await request(app).post("/api/cidadao/auth/cadastro").send({ nome: "Outro", email: "JOSE@email.com", senha: "senha-jose-2" })).status).toBe(409);
    r = await request(app).post("/api/cidadao/auth/login").send({ email: "jose@email.com", senha: "senha-jose-1" });
    const tJose = r.body.accessToken as string;
    expect(tJose).toBeTruthy();

    // Token de cidadao nao entra no painel; token de servidor nao entra na conta do cidadao
    expect((await request(app).get(`/api/admin/o/${A.camara._id}`).set(auth(tJose))).status).toBe(401);
    expect((await request(app).get("/api/cidadao/eu").set(auth(tCamara))).status).toBe(401);

    // Ativa as notificacoes do municipio; publicacao nova gera notificacao
    await request(app).post("/api/cidadao/inscricoes").set(auth(tJose)).send({ municipio: "municipio-a" });
    let eu = await request(app).get("/api/cidadao/eu").set(auth(tJose));
    expect(eu.body.seguindo.map((m: { slug: string }) => m.slug)).toEqual(["municipio-a"]);
    const pub = await request(app).post(`/api/admin/o/${A.camara._id}/publicacoes`).set(auth(tCamara)).send({ tipo: "aviso", titulo: "Sessão solene" });
    await request(app).post(`/api/admin/o/${A.camara._id}/publicacoes/${pub.body.id}/publicar`).set(auth(tCamara));
    eu = await request(app).get("/api/cidadao/eu").set(auth(tJose));
    expect(eu.body.notificacoesNaoLidas).toBe(1);
    const notifs = await request(app).get("/api/cidadao/notificacoes").set(auth(tJose));
    expect(notifs.body.itens[0].link).toBe(`/municipio-a/p/${pub.body.slug}`);
    await request(app).post("/api/cidadao/notificacoes/lidas").set(auth(tJose)).send({});
    expect((await request(app).get("/api/cidadao/eu").set(auth(tJose))).body.notificacoesNaoLidas).toBe(0);

    // Mensagem para a Camara
    r = await request(app)
      .post("/api/cidadao/mensagens")
      .set(auth(tJose))
      .send({ orgaoId: String(A.camara._id), assunto: "Iluminação da praça", texto: "A praça central está sem luz há uma semana." });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.protocolo).toMatch(/^\d{4}\.00001$/);
    const msgId = r.body.id;

    // Sininho do servidor da Camara mostra 1; a Prefeitura nao ve a mensagem da Camara
    expect((await request(app).get("/api/auth/avisos").set(auth(tCamara))).body.total).toBe(1);
    expect((await request(app).get("/api/auth/avisos").set(auth(tPref))).body.total).toBe(0);
    expect((await request(app).get(`/api/admin/o/${A.prefeitura._id}/mensagens/${msgId}`).set(auth(tPref))).status).toBe(404);

    // Servidor abre (fica lida) e responde -> cidadao recebe notificacao
    const aberta = await request(app).get(`/api/admin/o/${A.camara._id}/mensagens/${msgId}`).set(auth(tCamara));
    expect(aberta.body.cidadao.email).toBe("jose@email.com");
    expect((await request(app).get("/api/auth/avisos").set(auth(tCamara))).body.total).toBe(0);
    r = await request(app).post(`/api/admin/o/${A.camara._id}/mensagens/${msgId}/responder`).set(auth(tCamara)).send({ texto: "Já acionamos a Prefeitura. Obrigado!" });
    expect(r.body.situacao).toBe("respondida");
    eu = await request(app).get("/api/cidadao/eu").set(auth(tJose));
    expect(eu.body.mensagensNaoLidas).toBe(1);
    expect(eu.body.notificacoesNaoLidas).toBe(1);

    // Cidadao le a resposta e responde de novo
    const conversa = await request(app).get(`/api/cidadao/mensagens/${msgId}`).set(auth(tJose));
    expect(conversa.body.respostas).toHaveLength(2);
    expect((await request(app).get("/api/cidadao/eu").set(auth(tJose))).body.mensagensNaoLidas).toBe(0);
    r = await request(app).post(`/api/cidadao/mensagens/${msgId}/responder`).set(auth(tJose)).send({ texto: "Obrigado pelo retorno." });
    expect(r.body.situacao).toBe("aberta");

    // Outro cidadao nao ve a conversa do Jose
    const tMaria = (await request(app).post("/api/cidadao/auth/cadastro").send({ nome: "Maria Souza", email: "maria@email.com", senha: "senha-maria-1" })).body.accessToken;
    expect((await request(app).get(`/api/cidadao/mensagens/${msgId}`).set(auth(tMaria))).status).toBe(404);

    // Orgao que nao recebe mensagens
    await semTenant(() => Orgao.updateOne({ _id: A.prefeitura._id }, { $set: { recebeMensagens: false } }));
    r = await request(app).post("/api/cidadao/mensagens").set(auth(tMaria)).send({ orgaoId: String(A.prefeitura._id), assunto: "Teste", texto: "Mensagem de teste" });
    expect(r.status).toBe(400);
  });
});
