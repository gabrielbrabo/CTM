import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Em dev, /api vai para o server local (evita problema de CORS/cookie)
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
