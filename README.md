# FEST-SNAP

A browser-based photobooth system designed for on-site events. Visitors capture a series of photos on a tablet, then move to an operator station to select a template, arrange their favorite shots, and produce a print-ready composite — available either as a physical print or a downloadable file via QR code.

The system is built local-first: it runs entirely over a local network without requiring an internet connection, using a lightweight Node.js/Express backend with SQLite for storage and a React/TypeScript frontend. This makes it straightforward to deploy on ordinary consumer hardware for short-term, on-site use.

**Status:** work in progress — Slice 1 (capture → upload → session queue) is complete and functional. See `implementation-plan.md` for the full roadmap.

---

## Slice 1 (Capture → Upload → Muncul di Queue)

Hasil scaffold Slice 0 + Slice 1 sesuai `implementation-plan.md`. iPad flow (Idle → Input Nama → Capturing) sekarang beneran nyambung ke server: sesi & foto tersimpan di database/file, dan muncul di Queue dashboard laptop.

## Struktur

```
fest-snap/
  server/     Express + TypeScript + SQLite
    src/routes/sessions.ts   API: create/upload/status/delete/list sessions
    src/storage/              foto tersimpan di sini (per sub-folder session id)
  client/     React + TypeScript + Vite + Tailwind
    src/pages/ipad/          Idle, InputName, Capturing
    src/pages/laptop/        Queue (sudah terintegrasi), Editing (Slice 2, belum di-wire)
    src/pages/download/      Download (Slice 4, belum di-wire)
    src/lib/api.ts            helper manggil API server
  certs/      taruh certificate mkcert di sini
```

## Cara Menjalankan

### 1. Siapkan certificate HTTPS

Ikuti `mkcert-setup-guide.md` sampai langkah 3 (generate certificate). Setelah dapat dua file (`localhost+2.pem` dan `localhost+2-key.pem`, atau nama sesuai yang di-generate mkcert kamu), **copy dua file itu ke folder `certs/` di root project ini**.

Kalau nama file cert kamu beda dari `localhost+2.pem`/`localhost+2-key.pem`, sesuaikan nama file di dua tempat:
- `server/src/index.ts` (bagian `CERT_PATH` dan `KEY_PATH`)
- `client/vite.config.ts` (bagian `CERT_PATH` dan `KEY_PATH`)

### 2. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 3. Jalankan server (terminal 1)

```bash
cd server
npm run dev
```
Harus muncul: `FEST-SNAP server jalan di https://localhost:8443`

### 4. Jalankan client (terminal 2, biarkan terminal 1 tetap jalan)

```bash
cd client
npm run dev
```
Buka `https://localhost:5173` di browser.

### 5. Cek berhasil

Buka dua URL berbeda sesuai device:

- **Di iPad (atau laptop untuk simulasi iPad):** `https://<IP-laptop>:5173/` — ini flow capture (Idle → Input Nama → Capturing).
- **Di laptop (dashboard operator):** `https://localhost:5173/queue` — ini daftar antrian sesi.

(Selama masih di laptop yang sama untuk dua-duanya, bisa juga buka dua tab berbeda dengan dua URL di atas.)

Alur tes:
1. Buka `/` → layar Idle muncul → tekan "Mulai".
2. Isi nama sesi (coba juga isi kosong/emoji/>10 karakter — harus ditolak).
3. Tekan "Mulai foto" → kamera nyala → di layar "Siap Foto?" tekan "Mulai" → countdown 3-2-1 jalan, foto captured, ulang sampai 5 foto.
4. Setelah 5 foto, otomatis balik ke Idle.
5. Buka `/queue` di tab/device lain → sesi yang baru dibuat harus muncul dengan status "Menunggu".

Kalau ini semua jalan, berarti Slice 1 selesai — data beneran tersimpan di server (`server/fest-snap.db` dan `server/src/storage/`), bukan cuma di browser.

Ada juga link kecil "dashboard operator (dev)" di pojok kanan-bawah layar Idle — cuma buat kemudahan testing sekarang, karena iPad asli nanti kemungkinan di-kunci ke mode kiosk (browser gak bisa navigasi ke URL lain), jadi link ini otomatis gak relevan lagi saat itu.

## Kalau ada masalah

- **Browser warning "not secure"** → cert belum ke-trust, pastikan sudah jalankan `mkcert -install` (lihat mkcert-setup-guide.md langkah 2).
- **"Certificate tidak ditemukan"** di terminal server → file cert belum ditaruh di folder `certs/`, atau nama filenya beda dari yang direferensikan di kode.
- **Nama sesi ditolak terus padahal udah bener** → cek karakter aneh (spasi ganda, dsb), validasi cukup ketat sesuai Business Rules 5.1.
- **Kamera gak nyala** → pastikan akses lewat HTTPS (bukan HTTP), dan izin kamera browser sudah di-allow.
- **Queue gak update** → dia polling tiap 5 detik, tunggu sebentar atau refresh manual.

## Selanjutnya

Slice 2 (`implementation-plan.md`): halaman Editing (pilih template + foto + preview + compositing) — filenya (`Editing.tsx`) sudah ada di `client/src/pages/laptop/` tapi belum di-wire ke App.tsx, menunggu giliran compositing logic dibangun.
