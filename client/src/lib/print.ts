/**
 * Logic cetak — pola CSS @page + window.print() yang sudah divalidasi di
 * feasibility spike (spike-print-test.html). Belum bisa divalidasi ke printer
 * fisik asli (belum tersedia), jadi dibangun dengan asumsi yang jelas dicatat
 * di bawah, gampang disesuaikan begitu printer sudah ada.
 */

// Asumsi: gambar composite dianggap dicetak di 300 DPI (standar kualitas cetak).
// Kalau nanti ukuran cetak fisik yang diinginkan panitia berbeda, cukup ganti
// PRINT_DPI ini — seluruh perhitungan ukuran fisik ikut menyesuaikan otomatis.
const PRINT_DPI = 300;
const MM_PER_INCH = 25.4;

function pxToMm(px: number): number {
  return (px / PRINT_DPI) * MM_PER_INCH;
}

const PRINT_STYLE_ID = 'fest-snap-print-page-style';
const PRINT_ROOT_ID = 'fest-snap-print-root';

/**
 * Cetak satu gambar (hasil composite) dengan ukuran fisik mengikuti resolusi
 * pixel aslinya (di 300 DPI). Elemen lain di halaman otomatis disembunyikan
 * saat dialog print muncul (CSS @media print), lalu balik normal setelahnya.
 */
export function printCompositeImage(imageUrl: string, pixelWidth: number, pixelHeight: number): Promise<void> {
  return new Promise((resolve) => {
    const widthMm = pxToMm(pixelWidth);
    const heightMm = pxToMm(pixelHeight);

    // Suntik/timpa <style> berisi @page — ukurannya beda-beda tergantung
    // template yang dipilih, jadi harus dihitung ulang tiap kali cetak.
    let styleEl = document.getElementById(PRINT_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = PRINT_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @media print {
        body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
        #${PRINT_ROOT_ID} {
          display: block !important;
          position: fixed;
          top: 0; left: 0;
          width: ${widthMm}mm;
          height: ${heightMm}mm;
        }
        #${PRINT_ROOT_ID} img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
      }
      @media screen {
        #${PRINT_ROOT_ID} { display: none; }
      }
    `;

    // Elemen yang beneran dicetak — disembunyikan di layar biasa (lihat CSS di atas).
    let rootEl = document.getElementById(PRINT_ROOT_ID);
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = PRINT_ROOT_ID;
      document.body.appendChild(rootEl);
    }
    rootEl.innerHTML = `<img src="${imageUrl}" alt="Hasil cetak" />`;

    const handleAfterPrint = () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      resolve();
    };
    window.addEventListener('afterprint', handleAfterPrint);

    // Sedikit delay biar <img> sempat ke-render sebelum dialog print dipanggil.
    setTimeout(() => window.print(), 50);
  });
}
