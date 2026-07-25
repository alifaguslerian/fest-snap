import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { db } from "../db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, "../storage");

export const sessionsRouter = Router();

// ---- Validasi nama sesi (Business Rules 5.1) — juga divalidasi di client,
// tapi server tidak boleh cuma percaya client (defense in depth). ----
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

function validateDisplayName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 10) return null;
  if (EMOJI_REGEX.test(trimmed)) return null;
  return trimmed;
}

// ---- Mapping status internal (English, source of truth) -> label Indonesia
// yang ditampilkan di Queue dashboard (design-tokens.md section 4). ----
const STATUS_LABEL: Record<string, string> = {
  Waiting: "Menunggu",
  Editing: "Diedit",
  "Ready to Print": "Siap Cetak",
  Printed: "Tercetak",
};

function formatTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ---- Multer: simpan foto langsung ke folder storage/<sessionId>/ ----
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const sessionId = req.params.id;
      const dir = path.join(STORAGE_DIR, sessionId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, _file, cb) => {
      cb(null, `${crypto.randomUUID()}.jpg`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per foto, cukup longgar
});

// POST /api/sessions — buat sesi baru, status awal 'Capturing'
sessionsRouter.post("/sessions", (req, res) => {
  const displayName = validateDisplayName(req.body?.displayName);
  if (!displayName) {
    return res.status(400).json({
      error:
        "Nama sesi tidak valid — wajib diisi, maksimal 10 karakter, tanpa emoji.",
    });
  }

  const id = crypto.randomUUID();
  const createdAt = Date.now();

  db.prepare(
    `INSERT INTO sessions (id, display_name, created_at, status) VALUES (?, ?, ?, 'Capturing')`
  ).run(id, displayName, createdAt);

  res.status(201).json({ id, displayName, createdAt, status: "Capturing" });
});

// POST /api/sessions/:id/photos — upload satu foto mentah
sessionsRouter.post("/sessions/:id/photos", upload.single("photo"), (req, res) => {
  const sessionId = req.params.id;
  const session = db.prepare(`SELECT id FROM sessions WHERE id = ?`).get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Sesi tidak ditemukan." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "File foto tidak ditemukan di request." });
  }

  const photoId = crypto.randomUUID();
  const capturedAt = Date.now();
  const filePath = path.join(sessionId, req.file.filename); // relatif terhadap storage/

  db.prepare(
    `INSERT INTO photos (id, session_id, file_path, captured_at) VALUES (?, ?, ?, ?)`
  ).run(photoId, sessionId, filePath, capturedAt);

  res.status(201).json({ photoId, filePath });
});

// PATCH /api/sessions/:id/status — update status (mis. Capturing -> Waiting)
sessionsRouter.patch("/sessions/:id/status", (req, res) => {
  const sessionId = req.params.id;
  const { status } = req.body ?? {};

  const validStatuses = ["Capturing", "Waiting", "Editing", "Ready to Print", "Printed"];
  if (typeof status !== "string" || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status tidak valid: ${status}` });
  }

  const result = db.prepare(`UPDATE sessions SET status = ? WHERE id = ?`).run(status, sessionId);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Sesi tidak ditemukan." });
  }

  res.json({ id: sessionId, status });
});

// DELETE /api/sessions/:id — hapus satu sesi permanen (file + record)
sessionsRouter.delete("/sessions/:id", (req, res) => {
  const sessionId = req.params.id;

  db.prepare(`DELETE FROM photos WHERE session_id = ?`).run(sessionId);
  const result = db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);

  const sessionDir = path.join(STORAGE_DIR, sessionId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }

  if (result.changes === 0) {
    return res.status(404).json({ error: "Sesi tidak ditemukan." });
  }

  res.status(204).send();
});

// DELETE /api/sessions — hapus SELURUH data event (FR-22)
sessionsRouter.delete("/sessions", (_req, res) => {
  db.prepare(`DELETE FROM photos`).run();
  db.prepare(`DELETE FROM sessions`).run();

  if (fs.existsSync(STORAGE_DIR)) {
    fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  res.status(204).send();
});

// GET /api/sessions — daftar sesi untuk Queue dashboard.
// Sesi berstatus 'Capturing' sengaja TIDAK ditampilkan — belum relevan buat
// laptop sampai capture-nya selesai (jadi 'Waiting').
sessionsRouter.get("/sessions", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, display_name, created_at, status FROM sessions
       WHERE status != 'Capturing'
       ORDER BY created_at ASC`
    )
    .all() as { id: string; display_name: string; created_at: number; status: string }[];

  const sessions = rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    timestamp: formatTimestamp(row.created_at),
    status: STATUS_LABEL[row.status] ?? row.status,
  }));

  res.json({ sessions });
});
