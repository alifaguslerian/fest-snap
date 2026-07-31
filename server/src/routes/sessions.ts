import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { db } from "../db/index.js";
import { uploadToCloud } from "../lib/cloudStorage.js";

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

// ---- Nama folder penyimpanan yang gampang dibaca manual (buat kirim
// offline/manual), bukan UUID acak. Format: Nama-JamMenit-kodePendek.
// Kode pendek di belakang tetap menjamin folder tidak bentrok walau ada
// dua sesi dengan nama+jam yang sama persis (edge case di Business Rules 5.1). ----
function sanitizeForFilesystem(name: string): string {
  // Buang karakter yang tidak aman/tidak valid di nama folder Windows/Mac/Linux
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.length > 0 ? cleaned : "Sesi";
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 6);
}

function computeSessionFolderName(displayName: string, createdAt: number, id: string): string {
  const d = new Date(createdAt);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${sanitizeForFilesystem(displayName)}-${hh}${mm}-${shortId(id)}`;
}

// Cari folder sesi berdasarkan id — query display_name+created_at dulu,
// baru hitung nama foldernya (dipakai saat upload foto & saat hapus sesi).
function getSessionFolderPath(sessionId: string): string | null {
  const row = db
    .prepare(`SELECT display_name, created_at FROM sessions WHERE id = ?`)
    .get(sessionId) as { display_name: string; created_at: number } | undefined;

  if (!row) return null;
  const folderName = computeSessionFolderName(row.display_name, row.created_at, sessionId);
  return path.join(STORAGE_DIR, folderName);
}

// ---- Multer: simpan foto ke folder storage/<Nama-JamMenit-kodePendek>/ ----
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const sessionId = req.params.id;
      const dir = getSessionFolderPath(sessionId);
      if (!dir) {
        cb(new Error("Sesi tidak ditemukan."), "");
        return;
      }
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
  const session = db
    .prepare(`SELECT display_name, created_at FROM sessions WHERE id = ?`)
    .get(sessionId) as { display_name: string; created_at: number } | undefined;

  if (!session) {
    return res.status(404).json({ error: "Sesi tidak ditemukan." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "File foto tidak ditemukan di request." });
  }

  const photoId = crypto.randomUUID();
  const capturedAt = Date.now();
  const folderName = computeSessionFolderName(session.display_name, session.created_at, sessionId);
  const filePath = path.join(folderName, req.file.filename); // relatif terhadap storage/

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

  // Cari lokasi folder DULU — setelah row dihapus, display_name/created_at hilang
  // dan nama foldernya gak bisa dihitung ulang.
  const sessionDir = getSessionFolderPath(sessionId);

  db.prepare(`DELETE FROM photos WHERE session_id = ?`).run(sessionId);
  const result = db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);

  if (sessionDir && fs.existsSync(sessionDir)) {
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

// GET /api/sessions/:id — detail satu sesi + daftar foto mentahnya
// (dipakai halaman Editing untuk menampilkan foto & state tersimpan sebelumnya).
sessionsRouter.get("/sessions/:id", (req, res) => {
  const sessionId = req.params.id;

  const session = db
    .prepare(
      `SELECT id, display_name, created_at, status, template_id, slot_assignments,
              final_composite_path
       FROM sessions WHERE id = ?`
    )
    .get(sessionId) as
    | {
        id: string;
        display_name: string;
        created_at: number;
        status: string;
        template_id: string | null;
        slot_assignments: string | null;
        final_composite_path: string | null;
      }
    | undefined;

  if (!session) {
    return res.status(404).json({ error: "Sesi tidak ditemukan." });
  }

  const photos = db
    .prepare(`SELECT id, file_path FROM photos WHERE session_id = ? ORDER BY captured_at ASC`)
    .all(sessionId) as { id: string; file_path: string }[];

  res.json({
    id: session.id,
    displayName: session.display_name,
    timestamp: formatTimestamp(session.created_at),
    status: STATUS_LABEL[session.status] ?? session.status,
    templateId: session.template_id,
    slotAssignments: session.slot_assignments ? JSON.parse(session.slot_assignments) : null,
    finalCompositeUrl: session.final_composite_path
      ? `/storage/${session.final_composite_path}`
      : null,
    photos: photos.map((p) => ({ id: p.id, url: `/storage/${p.file_path}` })),
  });
});

// ---- Multer khusus buat upload hasil composite akhir (satu file per sesi) ----
const uploadFinal = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = getSessionFolderPath(req.params.id);
      if (!dir) {
        cb(new Error("Sesi tidak ditemukan."), "");
        return;
      }
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, _file, cb) => cb(null, "final.jpg"),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// POST /api/sessions/:id/finalize — simpan hasil composite + pilihan
// template/slot, status -> 'Ready to Print'. Bisa dipanggil ulang kapan saja
// (Business Rule: sesi bisa diedit ulang & digenerate ulang).
sessionsRouter.post(
  "/sessions/:id/finalize",
  uploadFinal.single("finalImage"),
  async (req, res) => {
    const sessionId = req.params.id;
    const session = db.prepare(`SELECT display_name, created_at FROM sessions WHERE id = ?`).get(sessionId) as
      | { display_name: string; created_at: number }
      | undefined;

    if (!session) {
      return res.status(404).json({ error: "Sesi tidak ditemukan." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "File hasil composite tidak ditemukan." });
    }

    const { templateId, slotAssignments } = req.body ?? {};
    const folderName = computeSessionFolderName(session.display_name, session.created_at, sessionId);
    const finalPath = path.join(folderName, req.file.filename);

    // Langkah 1: simpan lokal — SELALU, tanpa syarat (lihat
    // software-architecture.md section 7). Ini yang bikin status jadi
    // Ready to Print, apapun hasil upload cloud di bawah nanti.
    db.prepare(
      `UPDATE sessions SET template_id = ?, slot_assignments = ?, final_composite_path = ?, status = 'Ready to Print' WHERE id = ?`
    ).run(templateId ?? null, slotAssignments ?? null, finalPath, sessionId);

    // Langkah 2: coba upload ke cloud (best-effort, ada timeout internal).
    // Kalau gagal/timeout/belum dikonfigurasi, cloud_url tetap null — QR
    // nanti otomatis pakai jalur local (lihat routes/download.ts).
    const absolutePath = path.join(STORAGE_DIR, finalPath);
    const cloudUrl = await uploadToCloud(absolutePath, `${folderName}.jpg`);
    if (cloudUrl) {
      db.prepare(`UPDATE sessions SET cloud_url = ? WHERE id = ?`).run(cloudUrl, sessionId);
    }

    res.json({
      finalCompositeUrl: `/storage/${finalPath}`,
      status: "Ready to Print",
      cloudUrl,
    });
  }
);

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