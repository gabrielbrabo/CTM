import { PDFDocument } from "pdf-lib";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../src/app";
import { semTenant } from "../src/context/tenant";
import { Orgao } from "../src/models/Orgao";
import { SENHA_TESTE, criarMunicipio, criarUsuario, iniciarBancoTeste, limparBanco, pararBancoTeste } from "./setup";

// Painel do orgao: usuarios, fluxo editorial, anexos e portal publico
describe("painel do orgao e publicacoes", () => {
  const app = criarApp();
  let A: Awaited<ReturnType<typeof criarMunicipio>>;
  let tAdmin: string;
  let tEditor: string;
  let tRevisor: string;
  let tEditorPrefeitura: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const base = () => `/api/admin/o/${A.camara._id}`;
  async function login(email: string) {
    const r = await request(app).post("/api/auth/login").send({ email, senha: SENHA_TESTE });
    expect(r.status).toBe(200);
    return r.body.accessToken as string;
  }
  async function criarPub(token: string, titulo = "Sessão ordinária de outubro") {
    const r = await request(app)
      .post(`${base()}/publicacoes`)
      .set(auth(token))
      .send({ tipo: "comunicado", titulo, resumo: "Pauta da sessão", conteudo: "Texto completo" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body;
  }

  beforeAll(iniciarBancoTeste);
  afterAll(pararBancoTeste);
  beforeEach(async () => {
    await limparBanco();
    A = await criarMunicipio("municipio-a");
    const m = A.municipio._id;
    await criarUsuario("admin@camara.com", [{ municipioId: m, orgaoId: A.camara._id, papel: "admin_orgao" }]);
    await criarUsuario("editor@camara.com", [{ municipioId: m, orgaoId: A.camara._id, papel: "editor" }]);
    await criarUsuario("revisor@camara.com", [{ municipioId: m, orgaoId: A.camara._id, papel: "revisor" }]);
    await criarUsuario("editor@prefeitura.com", [{ municipioId: m, orgaoId: A.prefeitura._id, papel: "editor" }]);
    tAdmin = await login("admin@camara.com");
    tEditor = await login("editor@camara.com");
    tRevisor = await login("revisor@camara.com");
    tEditorPrefeitura = await login("editor@prefeitura.com");
  });

  it("editor publica direto quando o orgao nao exige revisao e aparece no portal", async () => {
    const pub = await criarPub(tEditor);
    expect(pub.estado).toBe("rascunho");

    // Rascunho nao aparece no portal
    let feed = await request(app).get("/api/public/m/municipio-a/feed");
    expect(feed.body.total).toBe(0);

    const r = await request(app).post(`${base()}/publicacoes/${pub.id}/publicar`).set(auth(tEditor));
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe("publicado");

    feed = await request(app).get("/api/public/m/municipio-a/feed?orgao=camara");
    expect(feed.body.total).toBe(1);
    expect(feed.body.itens[0].orgao.tipo).toBe("camara");
    const soPrefeitura = await request(app).get("/api/public/m/municipio-a/feed?orgao=prefeitura");
    expect(soPrefeitura.body.total).toBe(0);

    // Busca por palavra (sem acento tambem encontra)
    const busca = await request(app).get("/api/public/m/municipio-a/feed?q=sessao");
    expect(busca.body.total).toBe(1);
    const nada = await request(app).get("/api/public/m/municipio-a/feed?q=licitacao");
    expect(nada.body.total).toBe(0);

    const det = await request(app).get(`/api/public/m/municipio-a/p/${pub.slug}`);
    expect(det.status).toBe(200);
    expect(det.body.publicacao.titulo).toBe("Sessão ordinária de outubro");
  });

  it("com revisao obrigatoria: editor envia, revisor devolve e depois publica", async () => {
    const cfg = await request(app).patch(`${base()}/config`).set(auth(tAdmin)).send({ exigeRevisao: true });
    expect(cfg.status).toBe(200);

    const pub = await criarPub(tEditor);
    const negado = await request(app).post(`${base()}/publicacoes/${pub.id}/publicar`).set(auth(tEditor));
    expect(negado.status).toBe(403);

    let r = await request(app).post(`${base()}/publicacoes/${pub.id}/enviar-revisao`).set(auth(tEditor));
    expect(r.body.estado).toBe("em_revisao");

    r = await request(app).post(`${base()}/publicacoes/${pub.id}/devolver`).set(auth(tRevisor)).send({ motivo: "Faltou a pauta" });
    expect(r.body.estado).toBe("rascunho");

    await request(app).post(`${base()}/publicacoes/${pub.id}/enviar-revisao`).set(auth(tEditor));
    r = await request(app).post(`${base()}/publicacoes/${pub.id}/publicar`).set(auth(tRevisor));
    expect(r.body.estado).toBe("publicado");
    expect(r.body.historico.map((h: { evento: string }) => h.evento)).toEqual([
      "criado",
      "enviado_revisao",
      "devolvido",
      "enviado_revisao",
      "publicado",
    ]);
  });

  it("corrigir publicacao exige motivo e fica marcada como corrigida", async () => {
    const pub = await criarPub(tEditor);
    await request(app).post(`${base()}/publicacoes/${pub.id}/publicar`).set(auth(tEditor));

    let r = await request(app).patch(`${base()}/publicacoes/${pub.id}`).set(auth(tEditor)).send({ titulo: "Novo título" });
    expect(r.status).toBe(400);

    r = await request(app)
      .patch(`${base()}/publicacoes/${pub.id}`)
      .set(auth(tEditor))
      .send({ titulo: "Novo título", motivo: "Data errada" });
    expect(r.status).toBe(200);
    expect(r.body.corrigidoEm).toBeTruthy();

    const det = await request(app).get(`/api/public/m/municipio-a/p/${pub.slug}`);
    expect(det.body.publicacao.historico.some((h: { evento: string; motivo: string }) => h.evento === "corrigido" && h.motivo === "Data errada")).toBe(true);
  });

  it("anexo: envia, aparece no portal e baixa; tipo nao aceito e recusado", async () => {
    const pub = await criarPub(tEditor);
    let r = await request(app)
      .post(`${base()}/publicacoes/${pub.id}/anexos`)
      .set(auth(tEditor))
      .attach("arquivo", Buffer.from("%PDF-1.4 teste"), { filename: "relatório.pdf", contentType: "application/pdf" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.anexos[0].nome).toBe("relatório.pdf");

    const ruim = await request(app)
      .post(`${base()}/publicacoes/${pub.id}/anexos`)
      .set(auth(tEditor))
      .attach("arquivo", Buffer.from("MZ"), { filename: "virus.exe", contentType: "application/x-msdownload" });
    expect(ruim.status).toBe(400);

    // Antes de publicar, o link publico nao funciona
    const urlPublica = `/api/public/m/municipio-a/p/${pub.slug}/anexos/${r.body.anexos[0].id}`;
    expect((await request(app).get(urlPublica)).status).toBe(404);

    await request(app).post(`${base()}/publicacoes/${pub.id}/publicar`).set(auth(tEditor));
    r = await request(app).get(urlPublica);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");
    expect(r.body.toString()).toContain("%PDF-1.4 teste");
  });

  it("despublicar: so admin, com motivo, e some do portal", async () => {
    const pub = await criarPub(tEditor);
    await request(app).post(`${base()}/publicacoes/${pub.id}/publicar`).set(auth(tEditor));

    expect((await request(app).post(`${base()}/publicacoes/${pub.id}/despublicar`).set(auth(tEditor)).send({ motivo: "x" })).status).toBe(403);
    const r = await request(app).post(`${base()}/publicacoes/${pub.id}/despublicar`).set(auth(tAdmin)).send({ motivo: "Publicado por engano" });
    expect(r.body.estado).toBe("despublicado");
    expect((await request(app).get("/api/public/m/municipio-a/feed")).body.total).toBe(0);
    expect((await request(app).get(`/api/public/m/municipio-a/p/${pub.slug}`)).status).toBe(404);
  });

  it("usuario da Prefeitura nao mexe nas publicacoes da Camara do mesmo municipio", async () => {
    const pub = await criarPub(tEditor);
    expect((await request(app).get(`${base()}/publicacoes`).set(auth(tEditorPrefeitura))).status).toBe(403);
    expect((await request(app).post(`${base()}/publicacoes/${pub.id}/publicar`).set(auth(tEditorPrefeitura))).status).toBe(403);
    // Pelo painel da propria Prefeitura, o id da Camara nao e encontrado
    const r = await request(app).get(`/api/admin/o/${A.prefeitura._id}/publicacoes/${pub.id}`).set(auth(tEditorPrefeitura));
    expect(r.status).toBe(404);
  });

  it("orgao suspenso some do portal com suas publicacoes e o painel fica so leitura", async () => {
    const pub = await criarPub(tEditor);
    await request(app).post(`${base()}/publicacoes/${pub.id}/publicar`).set(auth(tEditor));
    await semTenant(() => Orgao.updateOne({ _id: A.camara._id }, { $set: { situacao: "suspenso" } }));

    expect((await request(app).get("/api/public/m/municipio-a/feed")).body.total).toBe(0);
    expect((await request(app).get(`${base()}/publicacoes`).set(auth(tEditor))).status).toBe(200);
    expect((await request(app).post(`${base()}/publicacoes`).set(auth(tEditor)).send({ tipo: "aviso", titulo: "Teste" })).status).toBe(403);
  });

  it("admin do orgao gerencia usuarios; editor nao; nao pode ficar sem admin", async () => {
    expect((await request(app).get(`${base()}/usuarios`).set(auth(tEditor))).status).toBe(403);

    let r = await request(app)
      .post(`${base()}/usuarios`)
      .set(auth(tAdmin))
      .send({ nome: "Novo Editor", email: "novo@camara.com", senha: "senha-forte-1", papel: "editor" });
    expect(r.status).toBe(201);

    const lista = await request(app).get(`${base()}/usuarios`).set(auth(tAdmin));
    expect(lista.body).toHaveLength(4);

    const eu = lista.body.find((u: { email: string }) => u.email === "admin@camara.com");
    r = await request(app).delete(`${base()}/usuarios/${eu.id}`).set(auth(tAdmin));
    expect(r.status).toBe(400);
    r = await request(app).patch(`${base()}/usuarios/${eu.id}`).set(auth(tAdmin)).send({ papel: "editor" });
    expect(r.status).toBe(400);

    const novo = lista.body.find((u: { email: string }) => u.email === "novo@camara.com");
    r = await request(app).patch(`${base()}/usuarios/${novo.id}`).set(auth(tAdmin)).send({ papel: "revisor" });
    expect(r.body.papel).toBe("revisor");
  });

  it("tipos por orgao: Camara usa projeto de lei com campos proprios e nao usa decreto", async () => {
    // Decreto e da Prefeitura
    let r = await request(app).post(`${base()}/publicacoes`).set(auth(tEditor)).send({ tipo: "decreto", titulo: "Decreto 1" });
    expect(r.status).toBe(400);

    // Projeto de lei sem os campos obrigatorios
    r = await request(app).post(`${base()}/publicacoes`).set(auth(tEditor)).send({ tipo: "projeto_lei", titulo: "PL 45/2026" });
    expect(r.status).toBe(400);
    expect(r.body.message).toContain("Ementa");

    r = await request(app)
      .post(`${base()}/publicacoes`)
      .set(auth(tEditor))
      .send({
        tipo: "projeto_lei",
        titulo: "PL 45/2026",
        detalhes: {
          especie: "Projeto de Lei Ordinária",
          autor: "Vereadora Maria",
          ementa: "Institui o programa de hortas comunitárias",
          situacao: "Em tramitação",
          campoQueNaoExiste: "ignorado",
        },
      });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.detalhes.autor).toBe("Vereadora Maria");
    expect(r.body.detalhes.campoQueNaoExiste).toBeUndefined();

    await request(app).post(`${base()}/publicacoes/${r.body.id}/publicar`).set(auth(tEditor));
    // Busca encontra pelo texto da ementa (campo especifico)
    const busca = await request(app).get("/api/public/m/municipio-a/feed?q=hortas");
    expect(busca.body.total).toBe(1);
    expect(busca.body.itens[0].detalhes.situacao).toBe("Em tramitação");

    // Comunicado e compartilhado: Prefeitura tambem pode
    const pref = await request(app)
      .post(`/api/admin/o/${A.prefeitura._id}/publicacoes`)
      .set(auth(tEditorPrefeitura))
      .send({ tipo: "licitacao", titulo: "Pregão 10/2026", detalhes: { modalidade: "Pregão eletrônico", objeto: "Merenda", situacao: "Aberta", valorEstimado: "1500,50" } });
    expect(pref.status, JSON.stringify(pref.body)).toBe(201);
    expect(pref.body.detalhes.valorEstimado).toBe(1500.5);

    const catalogo = await request(app).get("/api/public/tipos-publicacao");
    expect(catalogo.body.find((t: { id: string }) => t.id === "comunicado").orgaos).toEqual(["camara", "prefeitura"]);
  });

  it("extrai texto de arquivo para criar publicacao (TXT e Word)", async () => {
    let r = await request(app)
      .post(`${base()}/extrair-texto`)
      .set(auth(tEditor))
      .attach("arquivo", Buffer.from("Ata da 5ª Sessão Ordinária\n\nAos vinte dias do mês..."), { filename: "ata.txt", contentType: "text/plain" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.tituloSugerido).toBe("Ata da 5ª Sessão Ordinária");
    expect(r.body.texto).toContain("Aos vinte dias");

    r = await request(app)
      .post(`${base()}/extrair-texto`)
      .set(auth(tEditor))
      .attach("arquivo", Buffer.from("MZ"), { filename: "x.exe", contentType: "application/x-msdownload" });
    expect(r.status).toBe(400);

    // Sem login nao pode
    r = await request(app).post(`${base()}/extrair-texto`);
    expect(r.status).toBe(401);
  });

  it("documento escaneado/imagem no lugar do texto", async () => {
    // PDF sem texto (escaneado): nao da erro, avisa semTexto
    const vazio = await PDFDocument.create();
    vazio.addPage();
    const pdfEscaneado = Buffer.from(await vazio.save());
    let r = await request(app)
      .post(`${base()}/extrair-texto`)
      .set(auth(tEditor))
      .attach("arquivo", pdfEscaneado, { filename: "decreto_escaneado.pdf", contentType: "application/pdf" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.semTexto).toBe(true);
    expect(r.body.tituloSugerido).toBe("decreto escaneado");

    // Publicacao so com titulo + documento no lugar do texto
    const pub = (await request(app).post(`${base()}/publicacoes`).set(auth(tEditor)).send({ tipo: "comunicado", titulo: "Convocação 10/2026" })).body;
    r = await request(app)
      .post(`${base()}/publicacoes/${pub.id}/anexos`)
      .set(auth(tEditor))
      .field("noCorpo", "1")
      .attach("arquivo", pdfEscaneado, { filename: "decreto.pdf", contentType: "application/pdf" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.anexos[0].noCorpo).toBe(true);

    // Word nao pode ir no lugar do texto
    r = await request(app)
      .post(`${base()}/publicacoes/${pub.id}/anexos`)
      .set(auth(tEditor))
      .field("noCorpo", "1")
      .attach("arquivo", Buffer.from("x"), { filename: "a.txt", contentType: "text/plain" });
    expect(r.body.anexos[1].noCorpo).toBe(false);
    const recusa = await request(app)
      .patch(`${base()}/publicacoes/${pub.id}/anexos/${r.body.anexos[1].id}`)
      .set(auth(tEditor))
      .send({ noCorpo: true });
    expect(recusa.status).toBe(400);

    await request(app).post(`${base()}/publicacoes/${pub.id}/publicar`).set(auth(tEditor));
    const det = await request(app).get(`/api/public/m/municipio-a/p/${pub.slug}`);
    expect(det.body.publicacao.anexos.find((a: { nome: string }) => a.nome === "decreto.pdf").noCorpo).toBe(true);

    // Impressao "somente a publicacao" inclui o documento do corpo
    const imp = await request(app)
      .get(`/api/public/m/municipio-a/p/${pub.slug}/impressao.pdf`)
      .buffer(true)
      .parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on("data", (c: Buffer) => partes.push(c));
        res.on("end", () => cb(null, Buffer.concat(partes)));
      });
    expect((await PDFDocument.load(imp.body as Buffer)).getPageCount()).toBe(2);

    // Desmarcar: volta a ser so anexo
    const ok = await request(app)
      .patch(`${base()}/publicacoes/${pub.id}/anexos/${det.body.publicacao.anexos[0].id}`)
      .set(auth(tAdmin))
      .send({ noCorpo: false });
    expect(ok.status).toBe(200);
    expect(ok.body.anexos[0].noCorpo).toBe(false);
  });

  it("impressao em PDF: dois caminhos (somente publicacao / somente anexos)", async () => {
    const pub = await criarPub(tEditor, "Decreto de feriado");
    // Anexo PDF valido de 2 paginas
    const anexoPdf = await PDFDocument.create();
    anexoPdf.addPage();
    anexoPdf.addPage();
    await request(app)
      .post(`${base()}/publicacoes/${pub.id}/anexos`)
      .set(auth(tEditor))
      .attach("arquivo", Buffer.from(await anexoPdf.save()), { filename: "decreto.pdf", contentType: "application/pdf" });

    // No painel da pra imprimir mesmo antes de publicar
    let r = await request(app).get(`${base()}/publicacoes/${pub.id}/impressao.pdf`).set(auth(tEditor)).buffer(true);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");

    await request(app).post(`${base()}/publicacoes/${pub.id}/publicar`).set(auth(tEditor));
    const url = `/api/public/m/municipio-a/p/${pub.slug}/impressao.pdf`;
    const ler = async (u: string) => {
      const resp = await request(app).get(u).buffer(true).parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on("data", (c: Buffer) => partes.push(c));
        res.on("end", () => cb(null, Buffer.concat(partes)));
      });
      expect(resp.status).toBe(200);
      return (await PDFDocument.load(resp.body as Buffer)).getPageCount();
    };
    const soPublicacao = await ler(url);
    expect(soPublicacao).toBeGreaterThanOrEqual(1);
    // Somente os anexos: exatamente as 2 paginas do PDF anexado
    expect(await ler(`${url}?parte=anexos`)).toBe(2);

    // Publicacao sem anexos: o caminho "anexos" avisa que nao ha o que imprimir
    const outra = await criarPub(tEditor, "Aviso sem anexo");
    await request(app).post(`${base()}/publicacoes/${outra.id}/publicar`).set(auth(tEditor));
    const r404 = await request(app).get(`/api/public/m/municipio-a/p/${outra.slug}/impressao.pdf?parte=anexos`);
    expect(r404.status).toBe(404);
  });
});
