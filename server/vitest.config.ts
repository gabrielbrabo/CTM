import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Anexos dos testes vao para uma pasta temporaria
    env: { NODE_ENV: "test", UPLOADS_DIR: "tests/.uploads-tmp" },
    // Baixar o MongoDB na primeira execucao pode demorar
    hookTimeout: 120_000,
    testTimeout: 30_000,
    // Arquivos rodam um de cada vez (cada um sobe seu banco em memoria)
    fileParallelism: false,
  },
});
