import dotenv from "dotenv";

dotenv.config();

// Le uma variavel obrigatoria (em teste usa o valor padrao informado)
function obrigatoria(nome: string, padraoTeste?: string): string {
  const valor = process.env[nome];
  if (valor) return valor;
  if (process.env.NODE_ENV === "test" && padraoTeste !== undefined) return padraoTeste;
  throw new Error(`Variavel de ambiente ${nome} nao definida (veja o .env.example)`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT) || 4000,
  // Aceita MONGO_URI ou MONGODB_URI (nome usado em outros projetos)
  mongoUri: process.env.MONGODB_URI || obrigatoria("MONGO_URI", ""),
  jwtSecret: obrigatoria("JWT_SECRET", "segredo-teste"),
  jwtRefreshSecret: obrigatoria("JWT_REFRESH_SECRET", "segredo-refresh-teste"),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  // Pasta dos anexos quando nao ha S3 (desenvolvimento)
  uploadsDir: process.env.UPLOADS_DIR || "uploads",
  // Amazon S3 (opcional). Credenciais: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY no .env
  s3: {
    bucket: process.env.S3_BUCKET || "",
    region: process.env.S3_REGION || process.env.AWS_REGION || "sa-east-1",
  },
  // Tamanho maximo de cada anexo (MB)
  anexoMaxMb: Number(process.env.ANEXO_MAX_MB) || 20,
  accessTokenTtl: "15m",
  refreshTokenTtl: "7d",
};
