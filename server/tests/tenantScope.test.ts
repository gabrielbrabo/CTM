import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runWithTenant, semTenant } from "../src/context/tenant";
import { Orgao } from "../src/models/Orgao";
import { TenantError } from "../src/plugins/tenantScope";
import { criarMunicipio, iniciarBancoTeste, limparBanco, pararBancoTeste } from "./setup";

// Testes do plugin de isolamento direto nos models
describe("plugin tenantScope", () => {
  let A: Awaited<ReturnType<typeof criarMunicipio>>;
  let B: Awaited<ReturnType<typeof criarMunicipio>>;

  beforeAll(iniciarBancoTeste);
  afterAll(pararBancoTeste);
  beforeEach(async () => {
    await limparBanco();
    A = await criarMunicipio("municipio-a");
    B = await criarMunicipio("municipio-b");
  });

  const ctxA = () => ({ municipioId: String(A.municipio._id) });

  it("injeta o municipio do contexto automaticamente", async () => {
    const orgaos = await runWithTenant(ctxA(), () => Orgao.find());
    expect(orgaos).toHaveLength(2);
    expect(orgaos.every((o) => String(o.municipioId) === String(A.municipio._id))).toBe(true);
  });

  it("bloqueia consulta sem municipio e sem contexto", async () => {
    await expect(Orgao.find()).rejects.toBeInstanceOf(TenantError);
  });

  it("bloqueia pedir outro municipio dentro do contexto", async () => {
    await expect(runWithTenant(ctxA(), () => Orgao.find({ municipioId: B.municipio._id }))).rejects.toBeInstanceOf(
      TenantError
    );
  });

  it("nao encontra documento de outro municipio pelo _id", async () => {
    const achado = await runWithTenant(ctxA(), () => Orgao.findById(B.camara._id));
    expect(achado).toBeNull();
  });

  it("nao altera nem apaga documento de outro municipio", async () => {
    await runWithTenant(ctxA(), async () => {
      await Orgao.updateOne({ _id: B.camara._id }, { $set: { nome: "invadido" } });
      await Orgao.deleteOne({ _id: B.prefeitura._id });
    });
    const camaraB = await semTenant(() => Orgao.findById(B.camara._id));
    const prefeituraB = await semTenant(() => Orgao.findById(B.prefeitura._id));
    expect(camaraB?.nome).toBe("Camara municipio-b");
    expect(prefeituraB).not.toBeNull();
  });

  it("bloqueia trocar o municipioId de um documento", async () => {
    await expect(
      runWithTenant(ctxA(), () => Orgao.updateOne({ _id: A.camara._id }, { $set: { municipioId: B.municipio._id } }))
    ).rejects.toBeInstanceOf(TenantError);
  });

  it("preenche municipioId ao criar e bloqueia criar em outro municipio", async () => {
    const novo = await runWithTenant(ctxA(), () => Orgao.create({ tipo: "secretaria", nome: "Saude" }));
    expect(String(novo.municipioId)).toBe(String(A.municipio._id));

    await expect(
      runWithTenant(ctxA(), () => Orgao.create({ municipioId: B.municipio._id, tipo: "secretaria", nome: "X" }))
    ).rejects.toBeInstanceOf(TenantError);
  });

  it("aggregate fica restrito ao municipio do contexto", async () => {
    const total = await runWithTenant(ctxA(), () => Orgao.aggregate([{ $count: "n" }]));
    expect(total[0].n).toBe(2);
    await expect(Orgao.aggregate([{ $count: "n" }])).rejects.toBeInstanceOf(TenantError);
  });
});
