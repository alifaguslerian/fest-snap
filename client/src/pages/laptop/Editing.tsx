import React, { useState } from 'react';
import { Printer, QrCode, Trash2, ArrowLeft, Check } from 'lucide-react';

export interface TemplateItem {
  id: string;
  name: string;
  slotsCount: number;
  aspectRatio: string; // e.g. '1/2' or '3/4'
  accentColor: string;
}

export interface EditingProps {
  sessionLabel?: string; // e.g. "Najwa-14:32"
  onPrint: () => void;
  onRequestQR: () => void;
  onDeleteSession: () => void;
  onBackToQueue: () => void;
}

// Sample photo thumbnails
const MOCK_PHOTOS = [
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80',
];

const MOCK_TEMPLATES: TemplateItem[] = [
  { id: 't1', name: '4-Grid Klasik', slotsCount: 4, aspectRatio: '1/1', accentColor: '#2F4FE8' },
  { id: 't2', name: 'Strip 3 Vertikal', slotsCount: 3, aspectRatio: '1/2', accentColor: '#FF6B4A' },
  { id: 't3', name: 'Frame Festival 4', slotsCount: 4, aspectRatio: '3/4', accentColor: '#FFD93D' },
  { id: 't4', name: 'Duo Horizon', slotsCount: 2, aspectRatio: '4/3', accentColor: '#16A34A' },
];

export const Editing: React.FC<EditingProps> = ({
  sessionLabel = 'Najwa-14:32',
  onPrint,
  onRequestQR,
  onDeleteSession,
  onBackToQueue,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('t1');
  const [selectedPhotoIndices, setSelectedPhotoIndices] = useState<number[]>([0, 1, 2, 3]);

  const currentTemplate = MOCK_TEMPLATES.find((t) => t.id === selectedTemplateId) || MOCK_TEMPLATES[0];

  const togglePhotoSelection = (index: number) => {
    if (selectedPhotoIndices.includes(index)) {
      setSelectedPhotoIndices(selectedPhotoIndices.filter((i) => i !== index));
    } else {
      setSelectedPhotoIndices([...selectedPhotoIndices, index]);
    }
  };

  const handleDeleteSession = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus sesi ini?')) {
      onDeleteSession();
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF6EC] flex flex-col p-6 sm:p-8 relative overflow-x-hidden select-none">
      {/* Light Density Decorative Elements */}
      <div className="absolute top-12 left-12 text-[#FF6B4A] opacity-60 pointer-events-none">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <div className="absolute top-20 right-14 text-[#FFD93D] pointer-events-none opacity-80">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>

      {/* Top Header Bar */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between pb-4 border-b-2 border-[#2F4FE8]/20 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToQueue}
            className="bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] hover:bg-[#2F4FE8] hover:text-white rounded-full p-2.5 shadow-[2px_2px_0px_0px_#2F4FE8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
            title="Kembali ke antrian"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* FEST-SNAP Logo */}
          <h1 className="font-heading text-2xl sm:text-3xl italic font-extrabold text-[#2F4FE8] tracking-tight">
            FEST-SNAP
          </h1>

          {/* Session Identity Badge */}
          <div className="bg-[#FFD93D] border-2 border-[#2F4FE8] rounded-full px-4 py-1 text-sm font-extrabold text-[#1b1c17] shadow-[2px_2px_0px_0px_#2F4FE8]">
            {sessionLabel}
          </div>
        </div>

        {/* Action Buttons: Back & Delete */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToQueue}
            className="hidden sm:block bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] hover:bg-[#2F4FE8] hover:text-white rounded-full px-5 py-2 font-bold text-sm shadow-[2px_2px_0px_0px_#2F4FE8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
          >
            Kembali ke antrian
          </button>

          <button
            onClick={handleDeleteSession}
            className="bg-white border-2 border-red-600 text-red-600 hover:bg-red-50 rounded-full px-4 py-2 flex items-center gap-2 font-bold text-sm shadow-[2px_2px_0px_0px_#DC2626] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            <span className="hidden sm:inline">Hapus sesi</span>
          </button>
        </div>
      </header>

      {/* Main Content: 3 COLUMNS ARRANGEMENT */}
      <main className="w-full max-w-7xl mx-auto flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 z-10">
        
        {/* LEFT COLUMN: Pilih Template */}
        <section className="bg-white border-2 border-[#2F4FE8] rounded-2xl p-5 shadow-[4px_4px_0px_0px_#2F4FE8] flex flex-col h-[600px]">
          <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-gray-100">
            <h2 className="font-heading text-xl italic font-extrabold text-[#2F4FE8]">
              Pilih Template
            </h2>
            <span className="bg-[#FAF6EC] border border-[#2F4FE8] text-[#2F4FE8] font-bold text-xs px-3 py-1 rounded-full">
              12 Tersedia
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
            {MOCK_TEMPLATES.map((tmpl) => {
              const isSelected = tmpl.id === selectedTemplateId;
              return (
                <div
                  key={tmpl.id}
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`relative p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'border-[#2F4FE8] bg-[#FAF6EC] shadow-[3px_3px_0px_0px_#2F4FE8]'
                      : 'border-gray-300 hover:border-[#2F4FE8] bg-white'
                  }`}
                >
                  {/* Template Mini Preview Slot Graphic */}
                  <div className="w-16 h-20 bg-gray-100 border-2 border-[#2F4FE8] rounded-lg p-1.5 flex flex-col gap-1 items-center justify-center relative overflow-hidden">
                    <div className="grid grid-cols-2 gap-1 w-full h-full">
                      {Array.from({ length: tmpl.slotsCount }).map((_, i) => (
                        <div key={i} className="bg-gray-300 rounded-[2px]" />
                      ))}
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-sm">{tmpl.name}</h3>
                    <p className="text-xs text-gray-500 font-medium">{tmpl.slotsCount} Slot Foto</p>
                  </div>

                  {/* Active Tag */}
                  {isSelected && (
                    <span className="bg-[#2F4FE8] text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Aktif
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* MIDDLE COLUMN: Foto Kamu */}
        <section className="bg-white border-2 border-[#2F4FE8] rounded-2xl p-5 shadow-[4px_4px_0px_0px_#2F4FE8] flex flex-col h-[600px]">
          <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-gray-100">
            <h2 className="font-heading text-xl italic font-extrabold text-[#2F4FE8]">
              Foto Kamu
            </h2>
            <span className="bg-[#FAF6EC] border border-[#2F4FE8] text-[#2F4FE8] font-bold text-xs px-3 py-1 rounded-full">
              {selectedPhotoIndices.length}/5 Terpilih
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 gap-3 content-start">
            {MOCK_PHOTOS.map((photoUrl, idx) => {
              const isSelected = selectedPhotoIndices.includes(idx);
              return (
                <div
                  key={idx}
                  onClick={() => togglePhotoSelection(idx)}
                  className={`relative aspect-square rounded-xl border-2 overflow-hidden transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-[#2F4FE8] shadow-[3px_3px_0px_0px_#2F4FE8]'
                      : 'border-gray-200 hover:border-[#2F4FE8] opacity-75 hover:opacity-100'
                  }`}
                >
                  <img src={photoUrl} alt={`Captured ${idx}`} className="w-full h-full object-cover" />
                  
                  {/* Selected Checkmark Badge */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-[#FFD93D] text-[#2F4FE8] border-2 border-[#2F4FE8] rounded-full p-1 shadow-sm">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}

                  <div className="absolute bottom-1 left-2 text-[10px] font-bold text-white drop-shadow-md">
                    #{idx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT COLUMN: Final Preview Card & Action Buttons */}
        <section className="bg-white border-2 border-[#2F4FE8] rounded-2xl p-5 shadow-[4px_4px_0px_0px_#2F4FE8] flex flex-col justify-between h-[600px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-gray-100">
            <h2 className="font-heading text-xl italic font-extrabold text-[#2F4FE8]">
              Hasil Photostrip
            </h2>
            <span className="text-xs font-bold text-gray-500">{currentTemplate.name}</span>
          </div>

          {/* Template Slots Visual Preview Placeholder */}
          <div className="flex-1 my-auto flex items-center justify-center p-2">
            <div className="w-full max-w-[240px] bg-[#FAF6EC] border-[3px] border-[#2F4FE8] rounded-2xl p-4 shadow-[4px_4px_0px_0px_#2F4FE8] flex flex-col gap-3 items-center">
              {/* Header inside strip */}
              <div className="text-center">
                <p className="font-heading text-xs italic font-black text-[#2F4FE8]">FEST-SNAP 2026</p>
              </div>

              {/* Slots layout */}
              <div
                className={`w-full grid gap-2 ${
                  currentTemplate.slotsCount === 2
                    ? 'grid-cols-1'
                    : currentTemplate.slotsCount === 3
                    ? 'grid-cols-1'
                    : 'grid-cols-2'
                }`}
              >
                {Array.from({ length: currentTemplate.slotsCount }).map((_, slotIdx) => {
                  const photoIndexToUse = selectedPhotoIndices[slotIdx % selectedPhotoIndices.length];
                  const photoSrc = photoIndexToUse !== undefined ? MOCK_PHOTOS[photoIndexToUse] : null;

                  return (
                    <div
                      key={slotIdx}
                      className="aspect-square bg-white border-2 border-[#2F4FE8] rounded-lg overflow-hidden relative flex items-center justify-center"
                    >
                      {photoSrc ? (
                        <img
                          src={photoSrc}
                          alt={`Slot ${slotIdx}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-gray-400">Slot {slotIdx + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer inside strip */}
              <div className="w-full flex items-center justify-between text-[10px] font-bold text-[#2F4FE8]">
                <span>HUMANIORA FEST</span>
                <span>{sessionLabel.split('-')[1] || '14:32'}</span>
              </div>
            </div>
          </div>

          {/* Two Equal-Weight Pill Buttons Below Preview */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t-2 border-gray-100">
            {/* Cetak Button */}
            <button
              onClick={onPrint}
              className="w-full bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] hover:bg-[#2F4FE8] hover:text-white rounded-full py-3 px-4 flex items-center justify-center gap-2 font-bold text-sm shadow-[3px_3px_0px_0px_#2F4FE8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </button>

            {/* QR Download Button */}
            <button
              onClick={onRequestQR}
              className="w-full bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] hover:bg-[#2F4FE8] hover:text-white rounded-full py-3 px-4 flex items-center justify-center gap-2 font-bold text-sm shadow-[3px_3px_0px_0px_#2F4FE8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>QR Download</span>
            </button>
          </div>
        </section>

      </main>
    </div>
  );
};

export default Editing;
