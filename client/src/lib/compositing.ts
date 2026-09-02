import type { TemplateData } from "./api";

/**
 * Compositing dijalankan di client (browser), bukan di server — lihat
 * software-architecture.md section 9. Kode yang sama dipakai untuk preview
 * interaktif maupun hasil akhir yang dicetak/diunduh, supaya keduanya selalu
 * identik.
 */

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuat gambar: ${url}`));
    img.src = url;
  });
}

/**
 * Gambar satu foto ke area slot dengan perilaku "cover" (seperti CSS
 * object-fit: cover) — foto di-crop supaya mengisi penuh area slot tanpa
 * gepeng. offsetX/offsetY (rentang -1..1, default 0) menggeser TITIK crop
 * dari tengah (0) ke salah satu ujung (-1 atau +1) — dipakai fitur "geser
 * foto" biar operator bisa pas-in bagian foto yang kepotong.
 *
 * Catatan penting: cover-fit cuma motong SATU sumbu (lebar ATAU tinggi,
 * gak dua-duanya sekaligus) — sumbu satunya udah pas 100% terpakai, gak ada
 * "ruang" buat digeser. Jadi offsetX cuma berpengaruh kalau foto lebih
 * lebar dari slot (crop kiri-kanan), offsetY cuma berpengaruh kalau foto
 * lebih tinggi dari slot (crop atas-bawah) — bukan bug, itu konsekuensi
 * matematis dari cover-fit itu sendiri.
 */
function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  slotX: number,
  slotY: number,
  slotW: number,
  slotH: number,
  offsetX = 0,
  offsetY = 0
) {
  const imgRatio = img.width / img.height;
  const slotRatio = slotW / slotH;

  let sx: number, sy: number, sw: number, sh: number;

  if (imgRatio > slotRatio) {
    // gambar lebih lebar dari slot -> crop kiri-kanan, offsetX berlaku
    sh = img.height;
    sw = sh * slotRatio;
    sx = ((img.width - sw) / 2) * (1 + clampOffset(offsetX));
    sy = 0;
  } else {
    // gambar lebih tinggi dari slot -> crop atas-bawah, offsetY berlaku
    sw = img.width;
    sh = sw / slotRatio;
    sx = 0;
    sy = ((img.height - sh) / 2) * (1 + clampOffset(offsetY));
  }

  ctx.drawImage(img, sx, sy, sw, sh, slotX, slotY, slotW, slotH);
}

function clampOffset(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

/** Satu slot terisi: foto mana + seberapa digeser dari posisi tengah default. */
export interface SlotPlacement {
  photoUrl: string;
  offsetX: number; // -1..1, 0 = tengah (default)
  offsetY: number; // -1..1, 0 = tengah (default)
}

export interface ComposeOptions {
  canvas: HTMLCanvasElement;
  template: TemplateData;
  // Map index slot (0-based) -> placement foto di situ. Slot yang belum
  // diisi (undefined) dibiarkan kosong (transparan/background).
  slotPlacements: (SlotPlacement | undefined)[];
}

/**
 * Render composite ke sebuah <canvas>. Dipakai untuk preview (canvas kecil
 * yang keliatan di layar) MAUPUN hasil akhir (canvas ukuran penuh sebelum
 * di-export ke Blob) — resolusi ditentukan oleh ukuran canvas yang dikasih,
 * bukan oleh fungsi ini.
 */
export async function composeTemplate({ canvas, template, slotPlacements }: ComposeOptions): Promise<void> {
  canvas.width = template.canvasWidth;
  canvas.height = template.canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context tidak tersedia.");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Gambar semua foto dulu di posisi slot masing-masing.
  for (let i = 0; i < template.slots.length; i++) {
    const placement = slotPlacements[i];
    if (!placement) continue;
    const slot = template.slots[i];
    try {
      const img = await loadImage(placement.photoUrl);
      drawPhotoCover(ctx, img, slot.x, slot.y, slot.width, slot.height, placement.offsetX, placement.offsetY);
    } catch (err) {
      console.error(`Gagal render foto di slot ${i}:`, err);
    }
  }

  // 2. Gambar frame template (dengan lubang transparan) DI ATAS foto-foto.
  const frameImg = await loadImage(template.frameUrl);
  ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
}

/** Export isi canvas jadi Blob JPEG, dipakai saat "Selesai" untuk dikirim ke server. */
export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Gagal mengekspor canvas menjadi gambar."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}