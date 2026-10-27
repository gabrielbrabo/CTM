import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../src/app";
import { CampoTipo, TIPOS_PUBLICACAO_DEF } from "../src/config/tiposPublicacao";
import { SENHA_TESTE, criarMunicipio, criarUsuario, iniciarBancoTeste, limparBanco, pararBancoTeste } from "./setup";

// Valor de exemplo para cada tipo de campo
function exemplo(c: CampoTipo): unknown {
  switch (c.tipo) {
    case "data":
      return "2026-10-01";
    case "datahora":
      return "2026-10-01T10:00";
    case "numero":
      return 2026;
    case "moeda":
      return 1500.5;
    case "selecao":
      return c.opcoes![0];
    case "url":
      return "https://exemplo.gov.br";
    default:
      return `Texto de ${c.rotulo}`;
  }
}

describe("catalogo de tipos", () => {
  const app = criarApp();
  let A: Awaited<ReturnType<typeof criarMunicipio>>;
  const tokens: Record<string, string> = {};

  beforeAll(iniciarBancoTeste);
  afterAll(pararBancoTeste);
  beforeEach(async () => {
    await limparBanco();
    A = await criarMunicipio("municipio-a");
    for (const o of ["camara", "prefeitura"] as const) {
      await criarUsuario(`admin@${o}.com`, [{ municipioId: A.municipio._id, orgaoId: A[o]._id, papel: "admin_orgao" }]);
      tokens[o] = (await request(app).post("/api/auth/login").send({ email: `admin@${o}.com`, senha: SENHA_TESTE })).body.accessToken;
    }
  });

  it("todo tipo tem cor unica e da para publicar em cada orgao onde ele vale", async () => {
    const cores = TIPOS_PUBLICACAO_DEF.map((t) => t.cor);
    expect(new Set(cores).size).toBe(cores.length);

    for (const o of ["camara", "prefeitura"] as const) {
      const tipos = TIPOS_PUBLICACAO_DEF.filter((t) => t.orgaos.includes(o));
      for (const [i, t] of tipos.entries()) {
        const detalhes = Object.fromEntries(t.campos.map((c) => [c.nome, exemplo(c)]));
        const r = await request(app)
          .post(`/api/admin/o/${A[o]._id}/publicacoes`)
          .set({ Authorization: `Bearer ${tokens[o]}` })
          .send({ tipo: t.id, titulo: `${t.nome} ${i}`, numero: `${i + 1}/2026`, detalhes });
        expect(r.status, `${o}/${t.id}: ${JSON.stringify(r.body)}`).toBe(201);
      }
    }
    // Tipo que nao vale para o orgao e recusado
    const r = await request(app)
      .post(`/api/admin/o/${A.prefeitura._id}/publicacoes`)
      .set({ Authorization: `Bearer ${tokens.prefeitura}` })
      .send({ tipo: "prestacao_contas_legislativo", titulo: "Contas", detalhes: { exercicio: 2025 } });
    expect(r.status).toBe(400);
  });
});
