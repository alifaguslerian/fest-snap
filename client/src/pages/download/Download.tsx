import React from 'react';
import { Download as DownloadIcon } from 'lucide-react';

export interface DownloadProps {
  sessionLabel?: string; // e.g. "Najwa-14:32"
  finalImageUrl?: string;
}

export const Download: React.FC<DownloadProps> = ({
  sessionLabel = 'Najwa-14:32',
  finalImageUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
}) => {
  const handleDownload = () => {
    // Create temporary <a> element to trigger image download
    const link = document.createElement('a');
    link.href = finalImageUrl;
    link.download = `FEST-SNAP_${sessionLabel.replace(':', '-')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF6EC] flex flex-col items-center justify-between p-6 relative overflow-hidden select-none max-w-md mx-auto">
      {/* Light Density Decorative Elements */}
      <div className="absolute top-10 left-6 text-[#FF6B4A] opacity-70 pointer-events-none">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <div className="absolute top-16 right-8 text-[#FFD93D] pointer-events-none opacity-80">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <div className="absolute bottom-24 left-8 text-[#2F4FE8] pointer-events-none opacity-60">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M4 12 Q 10 4 16 12 T 28 12" />
        </svg>
      </div>

      {/* Header: Small Logo + Session Badge */}
      <header className="w-full flex flex-col items-center pt-2 z-10 gap-3">
        <h1 className="font-heading text-2xl italic font-extrabold text-[#2F4FE8] tracking-tight">
          FEST-SNAP
        </h1>

        {/* Session Badge */}
        <div className="bg-[#FFD93D] border-2 border-[#2F4FE8] rounded-full px-5 py-1.5 text-sm font-extrabold text-[#1b1c17] shadow-[3px_3px_0px_0px_#2F4FE8]">
          {sessionLabel}
        </div>
      </header>

      {/* Main Content: Large Result Preview Image */}
      <main className="flex-1 flex flex-col items-center justify-center my-6 z-10 w-full px-2">
        <div className="relative w-full max-w-[320px] aspect-[3/4] bg-white border-[4px] border-[#2F4FE8] rounded-3xl p-3 shadow-[8px_8px_0px_0px_#2F4FE8] overflow-hidden flex items-center justify-center">
          <img
            src={finalImageUrl}
            alt="Final Photobooth Result"
            className="w-full h-full object-cover rounded-2xl"
          />
        </div>
      </main>

      {/* Footer / Action: Unduh foto button */}
      <footer className="w-full flex flex-col items-center pb-6 z-10 gap-4">
        <button
          onClick={handleDownload}
          className="w-full max-w-xs bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] hover:bg-[#2F4FE8] hover:text-white rounded-full py-4 px-8 flex items-center justify-center gap-3 font-bold text-lg shadow-[4px_4px_0px_0px_#2F4FE8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
        >
          <DownloadIcon className="w-5 h-5" />
          <span>Unduh foto</span>
        </button>

        <p className="text-xs text-gray-500 font-medium text-center">
          Simpan kenangan kamu dari Humaniora Fest!
        </p>
      </footer>
    </div>
  );
};

export default Download;
