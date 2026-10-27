import { criarApp } from "./app";
import { conectarBanco } from "./config/db";
import { env } from "./config/env";
import { Publicacao } from "./models/Publicacao";

async function iniciar() {
  await conectarBanco();
  // Garante os indices de busca (troca o indice antigo pelo novo quando muda)
  await Publicacao.syncIndexes().catch((err) => console.error("[db] erro ao sincronizar indices:", err));
  const app = criarApp();
  app.listen(env.port, () => {
    console.log(`[api] rodando em http://localhost:${env.port}`);
  });
}

iniciar().catch((err) => {
  console.error("[api] falha ao iniciar:", err);
  process.exit(1);
});
