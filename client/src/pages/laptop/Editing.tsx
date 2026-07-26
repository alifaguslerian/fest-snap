import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Printer, QrCode, Trash2, Check } from 'lucide-react';
import {
  fetchTemplates,
  fetchSessionDetail,
  finalizeSession,
  type TemplateData,
  type SessionDetail,
} from '../../lib/api';
import { composeTemplate, canvasToBlob } from '../../lib/compositing';

export interface EditingProps {
  sessionId: string;
  onBackToQueue: () => void;
  onDeleteSession: () => void;
}

/**
 * Visual layout diadaptasi dari eksplorasi AI Studio (dekorasi, kartu sticker,
 * warna, tata letak Foto Kamu | Preview | Template). Logic interaksi TETAP
 * versi kita: klik slot di preview dulu, baru klik foto untuk mengisi slot
 * itu (bukan toggle-select + auto-fill round-robin dari versi mock), dan
 * preview beneran hasil compositing Canvas (lib/compositing.ts), bukan
 * grid statis 2x2. Warna kuning dikoreksi ke #FFC93C sesuai design-tokens.md
 * (versi AI Studio pakai #FFD93D, sedikit menyimpang).
 */
export const Editing: React.FC<EditingProps> = ({ sessionId, onBackToQueue, onDeleteSession }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [slotPhotoIds, setSlotPhotoIds] = useState<(string | null)[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSessionDetail(sessionId), fetchTemplates()])
      .then(([sessionData, templateList]) => {
        setSession(sessionData);
        setTemplates(templateList);

        if (sessionData.templateId) {
          setSelectedTemplateId(sessionData.templateId);
          const tpl = templateList.find((t) => t.id === sessionData.templateId);
          if (tpl) {
            setSlotPhotoIds(sessionData.slotAssignments ?? Array(tpl.slots.length).fill(null));
          }
        } else if (templateList.length > 0) {
          setSelectedTemplateId(templateList[0].id);
          setSlotPhotoIds(Array(templateList[0].slots.length).fill(null));
        }
      })
      .catch((err) => {
        console.error('Gagal memuat halaman editing:', err);
        setLoadError('Gagal memuat data sesi. Pastikan server jalan.');
      });
  }, [sessionId]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  const handleSelectTemplate = (tpl: TemplateData) => {
    setSelectedTemplateId(tpl.id);
    setSlotPhotoIds(Array(tpl.slots.length).fill(null));
    setActiveSlotIndex(null);
    setSaveMessage(null);
  };

  const handleSelectPhoto = (photoId: string) => {
    if (activeSlotIndex === null) return;
    setSlotPhotoIds((prev) => {
      const next = [...prev];
      next[activeSlotIndex] = photoId;
      return next;
    });
    setSaveMessage(null);
  };

  const photoIdToUrl = useCallback(
    (photoId: string | null) => (photoId ? session?.photos.find((p) => p.id === photoId)?.url : undefined),
    [session]
  );

  useEffect(() => {
    if (!selectedTemplate || !canvasRef.current) return;
    const slotPhotoUrls = slotPhotoIds.map(photoIdToUrl);
    composeTemplate({ canvas: canvasRef.current, template: selectedTemplate, slotPhotoUrls }).catch((err) =>
      console.error('Gagal render preview:', err)
    );
  }, [selectedTemplate, slotPhotoIds, photoIdToUrl]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedTemplate) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    const idx = selectedTemplate.slots.findIndex(
      (s) => clickX >= s.x && clickX <= s.x + s.width && clickY >= s.y && clickY <= s.y + s.height
    );
    if (idx !== -1) setActiveSlotIndex(idx);
  };

  const filledCount = slotPhotoIds.filter((id) => id !== null).length;
  const allSlotsFilled = slotPhotoIds.length > 0 && filledCount === slotPhotoIds.length;

  const handleSave = async () => {
    if (!canvasRef.current || !selectedTemplateId || !allSlotsFilled) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const blob = await canvasToBlob(canvasRef.current);
      await finalizeSession(sessionId, blob, selectedTemplateId, slotPhotoIds);
      setSaveMessage('Tersimpan — siap dicetak.');
    } catch (err) {
      console.error('Gagal menyimpan hasil akhir:', err);
      setSaveMessage('Gagal menyimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus sesi ini?')) {
      onDeleteSession();
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FAF6EC] flex items-center justify-center p-8">
        <p className="text-red-600 font-semibold">{loadError}</p>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="min-h-screen bg-[#FAF6EC] flex items-center justify-center p-8">
        <p className="text-[#2F4FE8] font-heading italic">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#FAF6EC] flex flex-col p-6 sm:p-10 relative overflow-x-hidden select-none">
      {/* Dekorasi background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-80">
        <div className="absolute top-12 left-[28%] text-[#FF6B4A] rotate-12">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z" />
          </svg>
        </div>
        <div className="absolute top-[32%] left-[2%] w-5 h-5 rounded-full bg-[#FFC93C]" />
        <div className="absolute top-20 right-10 text-[#FFC93C] -rotate-12">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <div className="absolute top-[28%] right-[6%] w-6 h-6 rounded-full bg-[#FF6B4A]" />
        <div className="absolute top-[42%] right-[3%] w-9 h-9 rounded-full bg-[#FF6B4A]" />
        <div className="absolute bottom-[22%] left-[6%] text-[#FFC93C]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <div className="absolute bottom-[5%] right-[6%] text-[#2F4FE8]">
          <svg width="80" height="20" viewBox="0 0 100 20" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
            <path d="M5 10c10-10 20 10 30 0s20-10 30 0 20 10 30 0" />
          </svg>
        </div>
      </div>

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between pb-4 z-10">
        <div className="flex items-center gap-4">
          <h1 className="font-heading text-3xl sm:text-4xl italic font-extrabold text-[#2F4FE8] tracking-tight">
            FEST-SNAP
          </h1>
          <div className="bg-[#FFC93C] border-2 border-[#2F4FE8] rounded-md px-3 py-1 text-sm font-extrabold text-[#1b1c17] shadow-[2px_2px_0px_0px_#2F4FE8]">
            {session.displayName}-{session.timestamp}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={onBackToQueue}
            className="font-bold text-sm text-[#2F4FE8] underline decoration-2 underline-offset-4 cursor-pointer"
          >
            Kembali ke queue
          </button>
          <button
            onClick={handleDeleteSession}
            className="text-red-600 hover:bg-red-50 p-2 rounded-full transition-all cursor-pointer"
            title="Hapus sesi"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-8 z-10 mt-2">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Foto Kamu */}
          <section className="md:col-span-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl sm:text-3xl italic font-extrabold text-[#2F4FE8]">
                Foto Kamu
              </h2>
              <span className="bg-[#f0eee6] border border-[#8d716a] text-[#59413c] font-bold text-xs px-3 py-1 rounded-md">
                {filledCount}/{slotPhotoIds.length || 0} Slot Terisi
              </span>
            </div>
            {activeSlotIndex !== null && (
              <p className="text-xs font-semibold text-[#2F4FE8] -mt-2">
                Klik foto di bawah untuk isi slot {activeSlotIndex + 1}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {session.photos.map((photo) => {
                const usedInSlot = slotPhotoIds.includes(photo.id);
                return (
                  <button
                    key={photo.id}
                    onClick={() => handleSelectPhoto(photo.id)}
                    disabled={activeSlotIndex === null}
                    className="relative aspect-square rounded-md border-[3px] border-[#2F4FE8] overflow-hidden shadow-[3px_3px_0px_0px_#2F4FE8] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                    {usedInSlot && (
                      <div className="absolute bottom-2 right-2 bg-[#FFC93C] text-[#2F4FE8] border-2 border-[#2F4FE8] rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Preview + aksi */}
          <section className="md:col-span-7 flex flex-col items-center gap-4">
            <div className="w-full max-w-[460px] bg-white border-[3px] border-[#2F4FE8] rounded-md p-4 shadow-[4px_4px_0px_0px_#2F4FE8] flex justify-center">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="max-w-full cursor-pointer"
                style={{ maxHeight: '55vh' }}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={!allSlotsFilled || saving}
              className="text-xs font-bold text-[#2F4FE8] underline decoration-2 underline-offset-4 disabled:opacity-40 disabled:no-underline cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Simpan hasil'}
            </button>
            {saveMessage && <p className="text-xs font-semibold text-[#2F4FE8]">{saveMessage}</p>}

            <div className="flex gap-4 w-full max-w-[400px]">
              <button
                disabled
                title="Tersedia setelah Slice 3"
                className="flex-1 bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] rounded-full py-2.5 px-4 flex items-center justify-center gap-2 font-bold text-sm shadow-[2px_2px_0px_0px_#2F4FE8] disabled:opacity-40 disabled:shadow-none cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak</span>
              </button>
              <button
                disabled
                title="Tersedia setelah Slice 4"
                className="flex-1 bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] rounded-full py-2.5 px-4 flex items-center justify-center gap-2 font-bold text-sm shadow-[2px_2px_0px_0px_#2F4FE8] disabled:opacity-40 disabled:shadow-none cursor-not-allowed"
              >
                <QrCode className="w-4 h-4" />
                <span>QR Download</span>
              </button>
            </div>
          </section>
        </div>

        <hr className="border-t-2 border-[#2F4FE8]/20 my-2" />

        {/* Template */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl sm:text-3xl italic font-extrabold text-[#2F4FE8]">
              Template
            </h2>
            <span className="bg-[#f0eee6] border border-[#8d716a] text-[#59413c] font-bold text-xs px-3 py-1 rounded-md">
              {templates.length} Tersedia
            </span>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto pb-4 pt-2 px-1">
            {templates.map((tpl) => {
              const isActive = tpl.id === selectedTemplateId;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`flex-shrink-0 w-32 h-44 bg-white border-[3px] rounded-md p-1.5 cursor-pointer transition-all relative overflow-hidden ${
                    isActive ? 'border-[#2F4FE8] shadow-[4px_4px_0px_0px_#2F4FE8]' : 'border-amber-200'
                  }`}
                >
                  {isActive && (
                    <div className="absolute -top-2 -right-2 bg-[#FFC93C] text-[#1b1c17] text-[10px] font-extrabold px-2 py-0.5 border-2 border-[#2F4FE8] rounded-md shadow-sm z-10 rotate-3">
                      Aktif
                    </div>
                  )}
                  <img src={tpl.frameUrl} alt={tpl.name} className="w-full h-full object-contain" />
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Editing;