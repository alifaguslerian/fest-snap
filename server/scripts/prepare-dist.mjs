// Nyusun/update folder FEST-SNAP-dist/ berisi semua yang dibutuhin buat
// jalanin FEST-SNAP tanpa install apapun.
//
// PENTING: script ini SENGAJA cuma nyentuh client-dist/ dan templates/ —
// TIDAK menghapus FEST-SNAP.exe, certs/, isi storage/, atau .env yang udah
// ada. Aman dijalankan berkali-kali buat update client/template doang,
// tanpa perlu bikin ulang .exe atau sertifikat tiap kali.
//
// Jalanin ini SETELAH:
//   1. `npm run build` di folder client/  (hasilnya otomatis masuk server/client-dist/)
//   2. `npm run bundle` di folder server/ (hasilnya server/dist-bundle/app.cjs) —
//      cuma perlu diulang kalau ada perubahan KODE SERVER.
//
// Cara pakai (dari folder server/):
//   node scripts/prepare-dist.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(SERVER_ROOT, "FEST-SNAP-dist");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Hapus+bikin ulang SATU subfolder tertentu (bukan seluruh DIST_DIR), biar
 * gak ada risiko kehapus punya orang lain di folder yang sama. Kalau gagal
 * karena file lagi dipakai (kemungkinan besar FEST-SNAP.exe masih jalan),
 * kasih pesan yang jelas, bukan stack trace mentah. */
function refreshSubfolder(subfolderPath, label) {
  try {
    fs.rmSync(subfolderPath, { recursive: true, force: true });
  } catch (err) {
    console.error(
      `\n[GAGAL] Gak bisa menghapus folder lama "${label}".\n` +
        `Penyebab paling umum: FEST-SNAP.exe MASIH JALAN (buka Task Manager,\n` +
        `cari proses "FEST-SNAP.exe" atau "node.exe", End Task dulu), atau folder\n` +
        `itu lagi kebuka di File Explorer/editor lain.\n\n` +
        `Tutup semua itu, lalu coba jalankan ulang script ini.\n\n` +
        `(Detail error asli: ${err.message})\n`
    );
    process.exit(1);
  }
}

function main() {
  const clientDistSrc = path.join(SERVER_ROOT, "client-dist");
  const templatesSrc = path.join(SERVER_ROOT, "templates");
  const envExampleSrc = path.join(SERVER_ROOT, ".env.example");

  if (!fs.existsSync(path.join(clientDistSrc, "index.html"))) {
    console.error(
      "\n[GAGAL] server/client-dist/index.html tidak ditemukan.\n" +
        "Jalankan `npm run build` di folder client/ dulu sebelum script ini.\n"
    );
    process.exit(1);
  }
  if (!fs.existsSync(templatesSrc)) {
    console.error("\n[GAGAL] server/templates/ tidak ditemukan.\n");
    process.exit(1);
  }

  fs.mkdirSync(DIST_DIR, { recursive: true });

  console.log("Update client-dist/ ...");
  refreshSubfolder(path.join(DIST_DIR, "client-dist"), "FEST-SNAP-dist/client-dist");
  copyDir(clientDistSrc, path.join(DIST_DIR, "client-dist"));

  console.log("Update templates/ ...");
  refreshSubfolder(path.join(DIST_DIR, "templates"), "FEST-SNAP-dist/templates");
  copyDir(templatesSrc, path.join(DIST_DIR, "templates"));

  // storage/ dan certs/ CUMA dibikin kalau belum ada — TIDAK PERNAH dihapus
  // isinya (storage/ mungkin ada foto hasil testing, certs/ hasil kerja
  // manual generate mkcert yang gak boleh ke-reset tiap kali script ini jalan).
  const storageDir = path.join(DIST_DIR, "storage");
  if (!fs.existsSync(storageDir)) {
    console.log("Menyiapkan storage/ (baru, kosong) ...");
    fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(path.join(storageDir, ".gitkeep"), "");
  }

  const certsDir = path.join(DIST_DIR, "certs");
  if (!fs.existsSync(certsDir)) {
    console.log("Menyiapkan certs/ (baru, kosong — generate mkcert sendiri) ...");
    fs.mkdirSync(certsDir, { recursive: true });
  }

  const envExampleDest = path.join(DIST_DIR, ".env.example");
  if (fs.existsSync(envExampleSrc) && !fs.existsSync(envExampleDest)) {
    console.log("Menyalin .env.example ...");
    fs.copyFileSync(envExampleSrc, envExampleDest);
  }

  const exeExists = fs.existsSync(path.join(DIST_DIR, "FEST-SNAP.exe"));
  console.log(
    `\nSelesai. Folder distribusi ada di:\n  ${DIST_DIR}\n\n` +
      (exeExists
        ? "FEST-SNAP.exe SUDAH ada di folder ini (gak disentuh script ini).\n" +
          "Kalau ada perubahan KODE SERVER, generate ulang .exe manual (lihat\n" +
          "package-for-windows.md Bagian 2), lalu timpa manual ke folder ini.\n"
        : "FEST-SNAP.exe BELUM ada di folder ini. Generate dulu (lihat\n" +
          "package-for-windows.md Bagian 2), lalu taruh di folder ini.\n")
  );
}

main();
