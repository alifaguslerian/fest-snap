import { Router } from "express";
import QRCode from "qrcode";
import { db } from "../db/index.js";
import { getLocalNetworkIp } from "../lib/network.js";

export const qrRouter = Router();
export const downloadPageRouter = Router();

const SERVER_PORT = 8443;

interface SessionRow {
  display_name: string;
  created_at: number;
}

interface CompositeRow {
  file_path: string;
  cloud_url: string | null;
}

function getSession(sessionId: string): SessionRow | undefined {
  return db
    .prepare(`SELECT display_name, created_at FROM sessions WHERE id = ?`)
    .get(sessionId) as SessionRow | undefined;
}

/** Composite TERAKHIR (versi tertinggi) buat sesi ini — QR/download SELALU
 * merujuk ke hasil yang paling baru disimpan, bukan daftar semua versi.
 * Versi-versi lama tetap ada di storage/DB (gak dihapus), cuma gak
 * ditampilkan lewat QR lagi — kalau operator butuh versi lama, ambil
 * manual lewat folder storage. */
function getLatestComposite(sessionId: string): CompositeRow | undefined {
  return db
    .prepare(
      `SELECT file_path, cloud_url FROM composites WHERE session_id = ? ORDER BY version DESC LIMIT 1`
    )
    .get(sessionId) as unknown as CompositeRow | undefined;
}

function formatTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// GET /api/sessions/:id/qr — QR code PNG menuju hasil TERAKHIR yang
// disimpan. Kalau upload cloud-nya sukses, QR LANGSUNG encode link cloud
// itu (skip halaman local sepenuhnya — sekali scan, langsung ke Supabase).
// Kalau enggak (belum dikonfigurasi / gagal / timeout), QR arah ke halaman
// download local, yang juga cuma nampilin hasil TERAKHIR itu doang.
qrRouter.get("/sessions/:id/qr", async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Sesi tidak ditemukan." });
  }
  const latest = getLatestComposite(req.params.id);
  if (!latest) {
    return res.status(400).json({ error: "Sesi belum punya hasil akhir — simpan dulu sebelum generate QR." });
  }

  const url = latest.cloud_url ?? `https://${getLocalNetworkIp()}:${SERVER_PORT}/download/${req.params.id}`;

  try {
    const qrPngBuffer = await QRCode.toBuffer(url, { width: 400, margin: 2 });
    res.set("Content-Type", "image/png");
    res.send(qrPngBuffer);
  } catch (err) {
    console.error("Gagal generate QR:", err);
    res.status(500).json({ error: "Gagal generate QR code." });
  }
});

// GET /download/:id — halaman download standalone, cuma dipakai kalau
// jalur cloud gak tersedia buat hasil TERAKHIR (lihat komentar di atas).
// Server-rendered langsung, TIDAK butuh Vite/React app jalan.
downloadPageRouter.get("/download/:id", (req, res) => {
  const session = getSession(req.params.id);
  const latest = session ? getLatestComposite(req.params.id) : undefined;

  if (!session || !latest) {
    res.status(404).send(renderNotFoundPage());
    return;
  }

  const label = `${session.display_name}-${formatTimestamp(session.created_at)}`;
  const imageUrl = latest.cloud_url ?? `/storage/${latest.file_path}`;
  res.send(renderDownloadPage(label, imageUrl));
});

function renderDownloadPage(label: string, imageUrl: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FEST-SNAP — ${escapeHtml(label)}</title>
<style>
  body {
    margin: 0; min-height: 100vh; background: #FAF6EC;
    font-family: -apple-system, "Segoe UI", sans-serif;
    display: flex; flex-direction: column; align-items: center;
    padding: 24px 16px; box-sizing: border-box;
  }
  .logo { font-style: italic; font-weight: 800; font-size: 22px; color: #2F4FE8; margin-bottom: 8px; }
  .badge {
    background: #FFC93C; border: 2px solid #2F4FE8; border-radius: 8px;
    padding: 4px 12px; font-weight: 800; font-size: 13px; color: #1b1c17; margin-bottom: 20px;
  }
  .frame {
    max-width: 420px; width: 100%; background: white; border: 3px solid #2F4FE8;
    border-radius: 10px; padding: 10px; box-sizing: border-box; margin-bottom: 20px;
  }
  .frame img { width: 100%; display: block; border-radius: 6px; }
  a.download-btn {
    display: inline-flex; align-items: center; gap: 8px;
    background: white; border: 2px solid #2F4FE8; color: #2F4FE8;
    border-radius: 999px; padding: 12px 28px; font-weight: 800; font-size: 15px;
    text-decoration: none;
  }
</style>
</head>
<body>
  <div class="logo">FEST-SNAP</div>
  <div class="badge">${escapeHtml(label)}</div>
  <div class="frame"><img src="${imageUrl}" alt="Hasil FEST-SNAP" /></div>
  <a class="download-btn" href="${imageUrl}" download="fest-snap-${escapeHtml(label)}.jpg">
    ⬇ Unduh Foto
  </a>
</body>
</html>`;
}

function renderNotFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Tidak ditemukan</title></head>
<body style="font-family:sans-serif; text-align:center; padding:40px;">
  <p>Sesi tidak ditemukan atau belum ada hasil akhir.</p>
</body></html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}