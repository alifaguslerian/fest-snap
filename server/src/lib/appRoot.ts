import path from "node:path";
import { isSea } from "node:sea";

/**
 * Folder "root" aplikasi — tempat semua data runtime (database SQLite,
 * folder storage foto, folder templates, build client, folder certs)
 * berada relatif terhadapnya. SEMUA path runtime di seluruh codebase harus
 * lewat sini — jangan hitung __dirname sendiri-sendiri di file lain.
 *
 * Kenapa perlu sentralisasi: sebelum ini, tiap file (db/index.ts,
 * routes/sessions.ts, routes/templates.ts, index.ts) hitung __dirname
 * masing-masing dengan offset ../ berbeda-beda sesuai lokasi filenya.
 * Itu jalan normal pas development (tiap file emang file terpisah beneran),
 * tapi PECAH begitu semua digabung jadi satu file lewat bundler buat SEA
 * packaging — karena hasil bundle cuma punya SATU __dirname buat semuanya,
 * bukan per-file lagi.
 *
 * Sengaja PAKAI process.argv[1], BUKAN import.meta.url — karena bundler
 * (esbuild) yang dipakai buat packaging output-nya format CJS, dan
 * import.meta.url gak berfungsi (jadi kosong) di CJS. process.argv[1]
 * jalan konsisten di kedua mode (ESM lewat tsx saat dev, maupun CJS hasil
 * bundle), jadi gak perlu cabang logic beda untuk itu.
 *
 * - Mode packaged (.exe hasil SEA): __dirname pada script yang di-inject
 *   otomatis sama dengan folder tempat .exe itu sendiri berada (ketentuan
 *   resmi Node.js SEA) — struktur folder hasil packaging sengaja dibuat
 *   FLAT di sekitar .exe (lihat package-for-windows.md), jadi root = folder
 *   itu juga.
 * - Mode development (jalan dari source lewat `npm run dev` / tsx watch):
 *   process.argv[1] adalah path ke entry script (server/src/index.ts).
 *   Root = satu level di atas folder tempat entry script itu berada
 *   (server/src/ -> server/).
 */
function computeAppRoot(): string {
  if (isSea()) {
    return path.dirname(process.execPath);
  }
  const entryScriptDir = path.dirname(process.argv[1]);
  return path.join(entryScriptDir, "..");
}

export const APP_ROOT = computeAppRoot();
