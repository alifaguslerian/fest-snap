import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Play } from 'lucide-react';

const IDLE_TIMEOUT_MS = 45_000; // 45 detik, sama seperti InputName (FR-04)

export interface CapturingProps {
  onPhotoCaptured: (photoBlob: Blob) => void;
  onSessionComplete: () => void;
  onCaptureError: (error: Error) => void;
  onTimeout: () => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Catatan integrasi (dikoreksi dari hasil AI Studio + revisi setelah bug ditemukan):
 * - Fitur "Mode Simulasi" & fallback foto palsu DIHAPUS (lihat histori sebelumnya) —
 *   bertentangan dengan Business Rule: capture gagal = sesi gagal, mulai ulang.
 * - Ditambah fase "ready": kamera nyala duluan, countdown baru mulai setelah
 *   tombol "Mulai" ditekan.
 * - REVISI PENTING: sekuens 5 foto sekarang pakai SATU alur async berurutan
 *   (bukan dua useEffect terpisah yang saling react ke perubahan state).
 *   Versi sebelumnya punya race condition — begitu photoIndex berubah, effect
 *   ke-trigger ulang SEBELUM countdown sempat direset balik ke 3, jadi sistem
 *   langsung capture ulang tanpa jeda dan salah anggap sesi selesai padahal
 *   baru 1 foto. Pendekatan async sekarang menghindari itu sepenuhnya.
 */
export const Capturing: React.FC<CapturingProps> = ({
  onPhotoCaptured,
  onSessionComplete,
  onCaptureError,
  onTimeout,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [photoIndex, setPhotoIndex] = useState<number>(0); // 0 to 5, buat progress dots
  const [countdown, setCountdown] = useState<number | null>(null); // null = belum mulai
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Inisialisasi kamera sekali saat mount
  useEffect(() => {
    let cancelled = false;

    async function initCamera() {
      try {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          userMediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = userMediaStream;
        if (videoRef.current) videoRef.current.srcObject = userMediaStream;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Akses kamera ditolak atau tidak tersedia');
        setCameraError(errorObj.message);
        onCaptureError(errorObj);
      }
    }

    initCamera();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle timeout (FR-04) — cuma aktif selama fase "ready" (nunggu tombol Mulai)
  useEffect(() => {
    if (hasStarted || cameraError) return;
    const timer = setTimeout(() => onTimeout(), IDLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasStarted, cameraError, onTimeout]);

  // Ambil satu frame dari video sebagai Blob JPEG. Video belum ready = error asli,
  // BUKAN fallback foto palsu.
  function captureFrame(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        reject(new Error('Video kamera belum siap saat pengambilan foto.'));
        return;
      }

      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 960;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context tidak tersedia di browser ini.'));
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Gagal mengonversi frame kamera menjadi gambar.'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg');
    });
  }

  // Sekuens 5 foto — SATU alur async berurutan, dimulai sekali saat hasStarted=true.
  useEffect(() => {
    if (!hasStarted) return;
    let cancelled = false;

    async function runSequence() {
      for (let i = 0; i < 5; i++) {
        for (let c = 3; c >= 1; c--) {
          if (cancelled) return;
          setCountdown(c);
          await sleep(1000);
        }
        if (cancelled) return;
        setCountdown(0); // tampil "SENYUM!" sesaat

        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 200);

        const blob = await captureFrame(); // melempar error kalau video belum siap
        if (cancelled) return;

        onPhotoCaptured(blob);
        setPhotoIndex(i + 1);

        if (i < 4) {
          await sleep(600); // jeda singkat sebelum countdown foto berikutnya
        }
      }

      if (!cancelled) {
        await sleep(800);
        onSessionComplete();
      }
    }

    runSequence().catch((err) => {
      if (cancelled) return;
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setCameraError(errorObj.message);
      onCaptureError(errorObj);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted]);

  return (
    <div className="min-h-screen w-full bg-[#FAF6EC] flex flex-col items-center justify-between p-4 sm:p-8 relative overflow-hidden select-none">
      {isFlashing && (
        <div className="fixed inset-0 bg-white z-50 animate-ping opacity-90 pointer-events-none" />
      )}

      <header className="w-full text-center pt-2 z-10">
        <h1 className="font-heading text-3xl sm:text-4xl italic font-extrabold text-[#2F4FE8] tracking-tight">
          FEST-SNAP
        </h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-xl mx-auto my-auto z-10 px-2">
        <div className="relative w-full aspect-[4/3] bg-black border-[4px] border-[#2F4FE8] rounded-3xl shadow-[8px_8px_0px_0px_#2F4FE8] overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraError ? 'hidden' : 'block'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-4 border border-dashed border-white/40 rounded-2xl pointer-events-none flex items-center justify-center">
            <div className="w-8 h-8 border-t-2 border-l-2 border-white/70 absolute top-4 left-4" />
            <div className="w-8 h-8 border-t-2 border-r-2 border-white/70 absolute top-4 right-4" />
            <div className="w-8 h-8 border-b-2 border-l-2 border-white/70 absolute bottom-4 left-4" />
            <div className="w-8 h-8 border-b-2 border-r-2 border-white/70 absolute bottom-4 right-4" />
          </div>

          {!cameraError && !hasStarted && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center z-20 p-6">
              <h3 className="font-heading text-2xl sm:text-3xl italic font-extrabold text-white mb-2 drop-shadow">
                Siap Foto?
              </h3>
              <p className="text-sm text-white/90 mb-5 max-w-xs drop-shadow">
                Cek posisi & senyum kamu dulu, tekan Mulai kalau sudah siap.
              </p>
              <button
                onClick={() => setHasStarted(true)}
                className="flex items-center gap-2 bg-white text-[#2F4FE8] font-heading italic font-bold text-lg px-8 py-3 rounded-full border-[4px] border-[#2F4FE8] active:scale-95 transition-transform"
              >
                <Play className="w-5 h-5" fill="#2F4FE8" />
                Mulai
              </button>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 bg-white/95 p-6 flex flex-col items-center justify-center text-center z-20">
              <AlertCircle className="w-16 h-16 text-red-500 mb-3" />
              <h3 className="font-heading text-xl italic font-bold text-[#2F4FE8] mb-2">
                Kamera Tidak Bisa Diakses
              </h3>
              <p className="text-sm text-gray-700 max-w-xs">Sesi ini dibatalkan. Silakan mulai sesi baru.</p>
            </div>
          )}
        </div>

        <div className="my-4 flex items-center justify-center h-20">
          {hasStarted && countdown !== null && (
            <span className="font-heading text-6xl sm:text-7xl italic font-extrabold text-[#2F4FE8] animate-bounce">
              {countdown > 0 ? countdown : 'SENYUM!'}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            {[0, 1, 2, 3, 4].map((idx) => {
              const isCaptured = idx < photoIndex;
              return (
                <div
                  key={idx}
                  className={`w-5 h-5 rounded-full border-[2.5px] border-[#2F4FE8] transition-all duration-300 ${
                    isCaptured ? 'bg-[#2F4FE8]' : 'bg-white'
                  }`}
                />
              );
            })}
          </div>
          <p className="font-heading text-lg italic font-bold text-[#2F4FE8] tracking-wide uppercase">
            {hasStarted ? `Foto ${Math.min(photoIndex + 1, 5)} dari 5` : 'Bersiap-siap...'}
          </p>
        </div>
      </main>

      <footer className="w-full text-center pb-2 z-10">
        <p className="text-xs text-gray-500 font-medium">Tatap langsung ke lensa kamera</p>
      </footer>
    </div>
  );
};

export default Capturing;
