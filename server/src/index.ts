import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { healthRouter } from "./routes/health.js";
import { sessionsRouter } from "./routes/sessions.js";
import { templatesRouter } from "./routes/templates.js";
import { qrRouter, downloadPageRouter } from "./routes/download.js";
import { APP_ROOT } from "./lib/appRoot.js";

// Load .env eksplisit dari APP_ROOT (bukan "dotenv/config" yang defaultnya
// cari relatif ke process.cwd() — itu gak reliable kalau .exe di-double-click
// dari Windows Explorer, working directory-nya bisa beda-beda tergantung
// cara dibuka, jadi harus eksplisit).
dotenv.config({ path: path.join(APP_ROOT, ".env") });

// Pastikan folder penyimpanan foto ada sebelum server jalan.
const STORAGE_DIR = path.join(APP_ROOT, "storage");
fs.mkdirSync(STORAGE_DIR, { recursive: true });

// Path ke certificate mkcert. Sesuaikan nama file kalau beda
// (lihat mkcert-setup-guide.md — hasil `mkcert localhost 127.0.0.1 <IP-laptop>`).
// Taruh dua file cert ini di folder certs/ SEJAJAR dengan .exe (mode
// packaged) atau di server/certs/ (mode development).
const CERT_DIR = path.join(APP_ROOT, "certs");
const CERT_PATH = path.join(CERT_DIR, "localhost+2.pem");
const KEY_PATH = path.join(CERT_DIR, "localhost+2-key.pem");

const app = express();
app.use(cors());
app.use(express.json());
// Sajikan foto (mentah + hasil akhir) dan asset template statis langsung
// sebagai file — dipakai client untuk menampilkan <img> di halaman Editing.
app.use("/storage", express.static(STORAGE_DIR));
app.use("/templates", express.static(path.join(APP_ROOT, "templates")));
app.use("/api", healthRouter);
app.use("/api", sessionsRouter);
app.use("/api", templatesRouter);
app.use("/api", qrRouter);
// Endpoint /api yang gak ke-match router manapun di atas -> 404 JSON yang
// rapi (bukan ikut ke-fallback ke halaman HTML SPA di bawah).
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Endpoint tidak ditemukan." });
});
app.use(downloadPageRouter); // root-level: /download/:id (dibuka HP pengunjung)

// Sajikan build React (production/packaged mode). Saat development biasa,
// client dijalankan terpisah lewat Vite (npm run dev di folder client) untuk
// hot-reload, jadi folder ini belum tentu ada — dicek dulu biar gak error.
const CLIENT_DIST_DIR = path.join(APP_ROOT, "client-dist");
const clientBuildExists = fs.existsSync(path.join(CLIENT_DIST_DIR, "index.html"));
if (clientBuildExists) {
  app.use(express.static(CLIENT_DIST_DIR));
}

// SPA fallback — path apa pun yang bukan /api, /storage, /templates,
// /download (semua sudah ditangani route di atas) diserahkan ke index.html
// React, supaya buka langsung /queue atau /queue/:id gak 404. HARUS paling
// terakhir didaftarkan.
app.get("*", (_req, res) => {
  if (clientBuildExists) {
    res.sendFile(path.join(CLIENT_DIST_DIR, "index.html"));
  } else {
    res
      .status(404)
      .send(
        "Client build belum ada. Jalankan `npm run build` di folder client, " +
          "atau pakai Vite dev server terpisah (npm run dev) untuk development."
      );
  }
});

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