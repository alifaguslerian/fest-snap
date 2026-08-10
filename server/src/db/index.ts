import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../fest-snap.db");

// Migrasi dari better-sqlite3 ke node:sqlite (bawaan Node.js, stabil sejak
// v22.22, tidak perlu native addon terkompilasi) — supaya bisa dipaketkan
// jadi satu executable (SEA) tanpa komplikasi native binary terpisah.
// API-nya nyaris identik: exec()/prepare().run()/.get()/.all() sama persis,
// cuma pragma() gak ada method khusus, dipanggil lewat exec() biasa.
export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");

// Skema dasar sesuai data model di software-architecture.md (section 4).
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