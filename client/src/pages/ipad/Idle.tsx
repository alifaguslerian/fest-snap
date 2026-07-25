import React from 'react';
import { Camera, Play } from 'lucide-react';

export interface IdleProps {
  onStart: () => void;
}

export const Idle: React.FC<IdleProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen w-full bg-[#FAF6EC] flex flex-col items-center justify-between p-6 sm:p-10 relative overflow-hidden select-none">
      {/* Decorative Background Elements (Light density) */}
      <div className="absolute top-12 left-10 text-[#FF6B4A] opacity-80 pointer-events-none animate-pulse">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <div className="absolute top-20 right-12 text-[#FFC93C] pointer-events-none">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <div className="absolute bottom-20 left-12 text-[#2F4FE8] pointer-events-none">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M4 12 Q 9 4 14 12 T 24 12" />
        </svg>
      </div>
      <div className="absolute bottom-12 right-12 w-4 h-4 rounded-full bg-[#FF6B4A] pointer-events-none" />

      {/* Header Logo */}
      <header className="w-full text-center pt-4 z-10">
        <h1 className="font-heading text-3xl sm:text-4xl italic font-extrabold text-[#2F4FE8] tracking-tight">
          FEST-SNAP
        </h1>
      </header>

      {/* Central Content Container */}
      <main className="flex-1 flex flex-col items-center justify-center my-auto z-10 w-full max-w-md text-center px-4">
        {/* Large Camera Icon in Circle */}
        <div className="relative mb-8 group cursor-pointer" onClick={onStart}>
          <div className="absolute inset-0 bg-[#FFC93C] rounded-full blur-xl opacity-40 scale-125" />
          <div className="relative bg-white border-[4px] border-[#2F4FE8] rounded-full p-8 shadow-[6px_6px_0px_0px_#2F4FE8] transition-transform duration-200 active:scale-95 flex items-center justify-center">
            <Camera className="w-24 h-24 sm:w-28 sm:h-28 text-[#2F4FE8]" strokeWidth={1.8} />
          </div>
          <div className="absolute -top-2 -right-2 bg-[#FF6B4A] text-white border-[2px] border-[#2F4FE8] rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider rotate-12 shadow-[2px_2px_0px_0px_#2F4FE8]">
            SENTUH!
          </div>
        </div>

        {/* Heading & Subtitle */}
        <h2 className="font-heading text-3xl sm:text-4xl italic font-extrabold text-[#2F4FE8] mb-3 leading-tight">
          Sentuh untuk mulai
        </h2>
        <p className="text-base sm:text-lg font-medium text-gray-700 max-w-xs mb-8">
          Photobooth Humaniora Fest
        </p>

        {/* Primary Action Button */}
        <button
          onClick={onStart}
          className="w-full max-w-xs bg-white border-[4px] border-[#2F4FE8] text-[#2F4FE8] rounded-full py-4 px-8 flex items-center justify-center gap-3 font-bold text-xl shadow-[6px_6px_0px_0px_#2F4FE8] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all cursor-pointer"
        >
          <Play className="w-6 h-6 fill-[#2F4FE8] text-[#2F4FE8]" />
          <span>Mulai</span>
        </button>
      </main>

      {/* Link dev-only ke dashboard Queue — buat kemudahan testing sekarang.
          Kalau nanti iPad di-set kiosk mode buat event beneran, browser
          biasanya dikunci gak bisa navigasi ke URL lain, jadi link ini
          otomatis gak relevan lagi. Boleh dihapus kalau sudah tidak perlu. */}
      <a
        href="/queue"
        className="absolute bottom-3 right-3 text-[10px] text-gray-400 underline z-10"
      >
        dashboard operator (dev)
      </a>
    </div>
  );
};

export default Idle;
