import mongoose from "mongoose";
import { env } from "./env";

// Modo estrito: campos que nao estao no schema sao ignorados nas consultas
mongoose.set("strictQuery", true);

export async function conectarBanco(uri: string = env.mongoUri): Promise<void> {
  await mongoose.connect(uri);
  console.log(`[db] conectado em ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function desconectarBanco(): Promise<void> {
  await mongoose.disconnect();
}
