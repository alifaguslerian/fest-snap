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
 * gepeng, bagian yang kelebihan dipotong dari tengah.
 */
function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  slotX: number,
  slotY: number,
  slotW: number,
  slotH: number
) {
  const imgRatio = img.width / img.height;
  const slotRatio = slotW / slotH;

  let sx: number, sy: number, sw: number, sh: number;

  if (imgRatio > slotRatio) {
    // gambar lebih lebar dari slot -> crop kiri-kanan
    sh = img.height;
    sw = sh * slotRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    // gambar lebih tinggi dari slot -> crop atas-bawah
    sw = img.width;
    sh = sw / slotRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, slotX, slotY, slotW, slotH);
}

export interface ComposeOptions {
  canvas: HTMLCanvasElement;
  template: TemplateData;
  // Map index slot (0-based) -> URL foto yang ditempatkan di situ.
  // Slot yang belum diisi (undefined) dibiarkan kosong (transparan/background).
  slotPhotoUrls: (string | undefined)[];
}

/**
 * Render composite ke sebuah <canvas>. Dipakai untuk preview (canvas kecil
 * yang keliatan di layar) MAUPUN hasil akhir (canvas ukuran penuh sebelum
 * di-export ke Blob) — resolusi ditentukan oleh ukuran canvas yang dikasih,
 * bukan oleh fungsi ini.
 */
export async function composeTemplate({ canvas, template, slotPhotoUrls }: ComposeOptions): Promise<void> {
  canvas.width = template.canvasWidth;
  canvas.height = template.canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context tidak tersedia.");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Gambar semua foto dulu di posisi slot masing-masing.
  for (let i = 0; i < template.slots.length; i++) {
    const url = slotPhotoUrls[i];
    if (!url) continue;
    const slot = template.slots[i];
    try {
      const img = await loadImage(url);
      drawPhotoCover(ctx, img, slot.x, slot.y, slot.width, slot.height);
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
