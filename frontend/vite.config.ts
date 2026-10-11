import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    const backendUrl = process.env.VITE_BACKEND_URL || loadEnv(mode, process.cwd(), "VITE_").VITE_BACKEND_URL;
    if (!backendUrl) throw new Error("Set VITE_BACKEND_URL to the backend origin before building");
    const origin = new globalThis.URL(backendUrl);
    if (!["http:", "https:"].includes(origin.protocol) || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
      throw new Error("VITE_BACKEND_URL must be an HTTP(S) origin without /api/v1, credentials, query, or fragment");
    }
    if (origin.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) {
      throw new Error("VITE_BACKEND_URL must use HTTPS for a hosted backend");
    }
  }
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
