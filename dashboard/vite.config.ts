import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// In dev, Vite proxies /api to the local FastAPI and adds the key on the server side.
// The key is read from the repo's .env without a VITE_ prefix, so it is never bundled.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          headers: { "X-API-Key": env.FASTAPI_KEY ?? "" },
        },
      },
    },
  };
});
