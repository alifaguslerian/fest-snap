import express from "express";
import cors from "cors";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { healthRouter } from "./routes/health.js";
import { sessionsRouter } from "./routes/sessions.js";
import { templatesRouter } from "./routes/templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pastikan folder penyimpanan foto ada sebelum server jalan.
const STORAGE_DIR = path.join(__dirname, "storage");
fs.mkdirSync(STORAGE_DIR, { recursive: true });

// Path ke certificate mkcert. Sesuaikan nama file kalau beda
// (lihat mkcert-setup-guide.md — hasil `mkcert localhost 127.0.0.1 <IP-laptop>`).
// Taruh dua file cert ini di folder /certs di root project (lihat README).
const CERT_DIR = path.join(__dirname, "../../certs");
const CERT_PATH = path.join(CERT_DIR, "localhost+2.pem");
const KEY_PATH = path.join(CERT_DIR, "localhost+2-key.pem");

const app = express();
app.use(cors());
app.use(express.json());
// Sajikan foto (mentah + hasil akhir) dan asset template statis langsung
// sebagai file — dipakai client untuk menampilkan <img> di halaman Editing.
app.use("/storage", express.static(STORAGE_DIR));
app.use("/templates", express.static(path.join(__dirname, "templates")));
app.use("/api", healthRouter);
app.use("/api", sessionsRouter);
app.use("/api", templatesRouter);

const PORT = 8443;

if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
  console.error(
    `\nCertificate tidak ditemukan di ${CERT_DIR}.\n` +
      `Generate dulu pakai mkcert (lihat mkcert-setup-guide.md), lalu taruh ` +
      `localhost+2.pem dan localhost+2-key.pem di folder certs/ pada root project.\n`
  );
  process.exit(1);
}

const server = https.createServer(
  {
    cert: fs.readFileSync(CERT_PATH),
    key: fs.readFileSync(KEY_PATH),
  },
  app
);

server.listen(PORT, () => {
  console.log(`FEST-SNAP server jalan di https://localhost:${PORT}`);
  console.log(`Cek endpoint dummy: https://localhost:${PORT}/api/health`);
});