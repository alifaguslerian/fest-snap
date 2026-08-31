# FEST-SNAP

A browser-based photobooth system designed for on-site events. Visitors capture a series of photos on a tablet, then move to an operator station to select a template, arrange their favorite shots, and produce a print-ready composite — available either as a physical print or a downloadable file via QR code.

The system is built local-first: it runs entirely over a local network without requiring an internet connection, using a lightweight Node.js/Express backend with SQLite for storage and a React/TypeScript frontend. This makes it straightforward to deploy on ordinary consumer hardware for short-term, on-site use.

**Status:** Sistem flow dari awal sampai akhir (Capture, Queue, Editing, dan Download) sudah lengkap dan terintegrasi secara fungsional.

---

## Fitur Utama

Sistem ini mendukung alur photobooth end-to-end:
- **Capture:** Flow pada iPad (Idle → Input Nama → Capturing) tersambung ke server. Sesi & foto tersimpan dengan aman di database (SQLite) dan sistem file.
- **Queue:** Dashboard laptop untuk operator memantau daftar antrian pengunjung.
- **Editing:** Operator dapat membuka sesi dari Queue, memilih template yang tersedia, menyusun foto ke dalam slot, dan menyimpan hasil composite.
- **Cetak & Download:** Setelah hasil tersimpan, operator dapat mencetak foto atau memunculkan QR Code untuk pengunjung mengunduh hasil foto ke handphone masing-masing melalui jaringan lokal.

## Struktur

```
fest-snap/
  server/     Express + TypeScript + SQLite
    src/routes/sessions.ts   API: create/upload/status/delete/list/finalize sessions
    src/routes/download.ts   Halaman statis untuk download foto via scan QR
    src/routes/templates.ts  API untuk membaca template yang tersedia
    src/storage/             Foto mentah & hasil akhir (per sub-folder session id)
  client/     React + TypeScript + Vite + Tailwind
    src/pages/ipad/          Idle, InputName, Capturing
    src/pages/laptop/        Queue, Editing (Sudah terintegrasi dengan App.tsx)
    src/pages/download/      Download UI
    src/lib/api.ts           Helper memanggil API server
  certs/      Folder untuk menyimpan certificate HTTPS (mkcert)
```

## Cara Menjalankan

### 1. Siapkan certificate HTTPS

Karena butuh akses kamera, harus menggunakan HTTPS. Gunakan `mkcert` untuk generate certificate (contoh: `localhost+2.pem` dan `localhost+2-key.pem`), lalu **copy dua file itu ke folder `certs/` di root project ini**.

Kalau nama file cert kamu beda, sesuaikan di dua tempat:
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

### 5. Cek Berhasil & Alur Penggunaan

Buka dua URL berbeda sesuai device:

- **Di iPad (atau laptop untuk simulasi iPad):** `https://<IP-laptop>:5173/` — ini flow capture (Idle → Input Nama → Capturing).
- **Di laptop (dashboard operator):** `https://localhost:5173/queue` — ini daftar antrian sesi.

Alur tes keseluruhan fitur:
1. Buka `/` → layar Idle muncul → tekan "Mulai".
2. Isi nama sesi (coba validasi dengan input kosong/emoji/>10 karakter — harus ditolak).
3. Tekan "Mulai foto" → kamera menyala → di layar "Siap Foto?" tekan "Mulai" → countdown jalan dan foto di-capture berulang hingga batas foto tercapai.
4. Setelah selesai, layar akan otomatis kembali ke Idle.
5. Buka `/queue` di tab/device lain → sesi yang baru dibuat harus muncul dengan status "Waiting" (Menunggu).
6. Klik sesi tersebut untuk masuk ke halaman **Editing** (`/queue/<id>`).
7. Pada mode Editing, pilih salah satu Template yang tersedia.
8. Pilih foto dari galeri untuk mengisi slot di template.
9. Setelah semua slot terisi, tekan **Simpan hasil**.
10. Setelah tersimpan, opsi **QR Download** dan **Cetak** akan aktif. Klik QR Download untuk memunculkan kode.

## Kalau Ada Masalah

- **Browser warning "not secure"** → Certificate belum di-trust, pastikan sudah install CA-nya (`mkcert -install`).
- **"Certificate tidak ditemukan"** di terminal server → File cert belum ditaruh di folder `certs/`, atau nama filenya tidak sesuai.
- **Kamera tidak menyala** → Pastikan diakses menggunakan HTTPS (bukan HTTP), dan izin kamera browser sudah diizinkan (allow).
- **Scan QR error/tidak bisa dibuka** → Pastikan handphone yang men-scan berada di jaringan WiFi yang sama dengan laptop server.
