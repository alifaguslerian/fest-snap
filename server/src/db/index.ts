import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../fest-snap.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Skema dasar sesuai data model di software-architecture.md (section 4).
// Dipakai mulai Slice 1 — belum ada endpoint yang menulis ke sini di Slice 0,
// tapi tabel disiapkan dari awal biar Slice 1 tinggal pakai.
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
`);
