import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

// Path ke certificate mkcert yang sama dipakai server (lihat server/src/index.ts
// dan mkcert-setup-guide.md). Taruh dua file cert ini di folder /certs pada root project.
const CERT_DIR = path.resolve(__dirname, "../certs");
const CERT_PATH = path.join(CERT_DIR, "localhost+2.pem");
const KEY_PATH = path.join(CERT_DIR, "localhost+2-key.pem");

const hasCerts = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

if (!hasCerts) {
  console.warn(
    `\nCertificate belum ditemukan di ${CERT_DIR} — client jalan tanpa HTTPS.\n` +
      `Kamera (getUserMedia) TIDAK akan bisa diakses tanpa HTTPS. ` +
      `Generate cert dulu (lihat mkcert-setup-guide.md).\n`
  );
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    https: hasCerts
      ? {
          cert: fs.readFileSync(CERT_PATH),
          key: fs.readFileSync(KEY_PATH),
        }
      : undefined,
    host: true, // biar bisa diakses dari device lain di jaringan lokal (iPad, laptop lain)
    proxy: {
      // Semua request /api, /storage (foto), dan /templates (asset template)
      // diteruskan ke server Express di port 8443
      "/api": {
        target: "https://localhost:8443",
        secure: false, // izinkan cert self-signed/mkcert saat proxy
        changeOrigin: true,
      },
      "/storage": {
        target: "https://localhost:8443",
        secure: false,
        changeOrigin: true,
      },
      "/templates": {
        target: "https://localhost:8443",
        secure: false,
        changeOrigin: true,
      },
    },
  },
});