import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload {
  sub: string; // id do usuario (ou do cidadao)
  tv: number; // tokenVersion
  tp?: "cidadao"; // conta da populacao (os servidores nao tem "tp")
}

export function gerarAccessToken(usuarioId: string, tokenVersion: number): string {
  const payload: TokenPayload = { sub: usuarioId, tv: tokenVersion };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.accessTokenTtl } as SignOptions);
}

export function gerarRefreshToken(usuarioId: string, tokenVersion: number): string {
  const payload: TokenPayload = { sub: usuarioId, tv: tokenVersion };
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.refreshTokenTtl } as SignOptions);
}

export function verificarAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}

export function verificarRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as TokenPayload;
}

export const REFRESH_COOKIE = "ctm_refresh";

// Configuracao do cookie do refresh token (httpOnly: o JavaScript do navegador nao le)
export function opcoesCookieRefresh() {
  return {
    httpOnly: true,
    secure: env.isProd,
    // Em producao front e API ficam em dominios diferentes -> precisa "none"
    sameSite: (env.isProd ? "none" : "lax") as "none" | "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

// ---------- Conta da populacao (cidadao) ----------
export function gerarAccessTokenCidadao(id: string, tokenVersion: number): string {
  const payload: TokenPayload = { sub: id, tv: tokenVersion, tp: "cidadao" };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.accessTokenTtl } as SignOptions);
}

export function gerarRefreshTokenCidadao(id: string, tokenVersion: number): string {
  const payload: TokenPayload = { sub: id, tv: tokenVersion, tp: "cidadao" };
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: "30d" } as SignOptions);
}

export const REFRESH_COOKIE_CIDADAO = "ctm_cidadao";

export function opcoesCookieCidadao() {
  return { ...opcoesCookieRefresh(), path: "/api/cidadao/auth", maxAge: 30 * 24 * 60 * 60 * 1000 };
}
