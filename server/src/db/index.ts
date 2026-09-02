import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { APP_ROOT } from "../lib/appRoot.js";

const dbPath = path.join(APP_ROOT, "fest-snap.db");

// Migrasi dari better-sqlite3 ke node:sqlite (bawaan Node.js, stabil sejak
// v22.22, tidak perlu native addon terkompilasi) — supaya bisa dipaketkan
// jadi satu executable (SEA) tanpa komplikasi native binary terpisah.
// API-nya nyaris identik: exec()/prepare().run()/.get()/.all() sama persis,
// cuma pragma() gak ada method khusus, dipanggil lewat exec() biasa.
export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");

// Skema dasar sesuai data model di software-architecture.md (section 4).
//
// sessions.template_id/slot_assignments/final_composite_path/cloud_url masih
// dipertahankan sebagai "cache" dari composite TERBARU (memudahkan query
// Queue yang cuma butuh status, gak perlu join) — tapi sumber kebenaran
// yang sebenarnya sekarang ada di tabel `composites`, karena satu sesi bisa
// punya BANYAK hasil akhir (tiap kali "Simpan hasil" = 1 versi baru, bukan
// menimpa yang lama) — biar template/foto lama tetap bisa diunduh ulang
// walau operator udah lanjut coba template lain di sesi yang sama.
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Capturing',
    template_id TEXT,
    slot_assignments TEXT,
    final_composite_path TEXT,
    cloud_url TEXT
  );

  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    file_path TEXT NOT NULL,
    captured_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS composites (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    version INTEGER NOT NULL,
    template_id TEXT NOT NULL,
    slot_assignments TEXT,
    file_path TEXT NOT NULL,
    cloud_url TEXT,
    created_at INTEGER NOT NULL
  );
`);