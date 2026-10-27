import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { protect } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import { municipioAdmin } from "./middleware/municipio";
import { orgaoAdmin } from "./middleware/orgao";
import authRoutes from "./modules/auth/authRoutes";
import orgaoRoutes from "./modules/orgao/orgaoRoutes";
import painelOrgaoRoutes from "./modules/orgao/painelOrgaoRoutes";
import platformRoutes from "./modules/platform/platformRoutes";
import publicRoutes from "./modules/public/publicRoutes";
import cidadaoRoutes from "./modules/cidadao/cidadaoRoutes";

export function criarApp() {
  const app = express();

  // Necessario no Render/proxy para pegar o IP real e cookies "secure"
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Login, refresh, logout, me
  app.use("/api/auth", authRoutes);

  // Portal publico (sem login)
  app.use("/api/public", publicRoutes);

  // Conta da populacao: mensagens aos orgaos e notificacoes
  app.use("/api/cidadao", cidadaoRoutes);

  // Painel admin de um municipio: login + vinculo com o municipio
  const admin = express.Router({ mergeParams: true });
  admin.use(protect, municipioAdmin);
  admin.use("/orgaos", orgaoRoutes);
  app.use("/api/admin/m/:municipioId", admin);

  // Painel do orgao (Prefeitura/Camara): usuarios, publicacoes, configuracoes
  const painelOrgao = express.Router({ mergeParams: true });
  painelOrgao.use(protect, orgaoAdmin);
  painelOrgao.use("/", painelOrgaoRoutes);
  app.use("/api/admin/o/:orgaoId", painelOrgao);

  // Plataforma (GADZ)
  app.use("/api/platform", platformRoutes);

  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ message: "Rota nao encontrada" });
  });

  app.use(errorHandler);
  return app;
}
