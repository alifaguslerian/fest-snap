import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Printer, QrCode, Trash2, Check, Maximize2, X, RotateCcw } from 'lucide-react';
import {
  fetchTemplates,
  fetchSessionDetail,
  finalizeSession,
  updateSessionStatus,
  type TemplateData,
  type SessionDetail,
  type SlotAssignment,
} from '../../lib/api';
import { composeTemplate, canvasToBlob } from '../../lib/compositing';
import { printCompositeImage } from '../../lib/print';

export interface EditingProps {
  sessionId: string;
  onBackToQueue: () => void;
  onDeleteSession: () => void;
}

function makeEmptySlots(count: number): SlotAssignment[] {
  return Array.from({ length: count }, () => ({ photoId: null, offsetX: 0, offsetY: 0 }));
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
  const [slotAssignments, setSlotAssignments] = useState<SlotAssignment[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    Promise.all([fetchSessionDetail(sessionId), fetchTemplates()])
      .then(([sessionData, templateList]) => {
        setSession(sessionData);
        setTemplates(templateList);

        if (sessionData.templateId) {
          setSelectedTemplateId(sessionData.templateId);
          const tpl = templateList.find((t) => t.id === sessionData.templateId);
          if (tpl) {
            setSlotAssignments(sessionData.slotAssignments ?? makeEmptySlots(tpl.slots.length));
          }
        } else if (templateList.length > 0) {
          setSelectedTemplateId(templateList[0].id);
          setSlotAssignments(makeEmptySlots(templateList[0].slots.length));
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
    setSlotAssignments(makeEmptySlots(tpl.slots.length));
    setActiveSlotIndex(null);
    setSaveMessage(null);
  };

  const handleSelectPhoto = (photoId: string) => {
    if (activeSlotIndex === null) return;
    setSlotAssignments((prev) => {
      const next = [...prev];
      // Foto baru selalu mulai dari tengah (offset 0,0) — gak nurunin offset
      // dari foto sebelumnya di slot ini, biar gak bingung.
      next[activeSlotIndex] = { photoId, offsetX: 0, offsetY: 0 };
      return next;
    });
    setSaveMessage(null);
  };

  const handleResetOffset = () => {
    if (activeSlotIndex === null) return;
    setSlotAssignments((prev) => {
      const current = prev[activeSlotIndex];
      if (!current) return prev;
      const next = [...prev];
      next[activeSlotIndex] = { ...current, offsetX: 0, offsetY: 0 };
      return next;
    });
    setSaveMessage(null);
  };

  /**
   * Drag langsung di atas preview buat geser posisi foto dalam slotnya —
   * gantiin tombol panah (kurang natural, harus klik berkali-kali). Model
   * interaksinya "direct manipulation": foto seolah-olah ditarik pakai
   * kursor, seperti drag foto di Instagram/Canva.
   *
   * mousedown di slot KOSONG -> langsung pilih slot itu jadi aktif (gak ada
   * yang bisa di-drag di situ). mousedown di slot yang UDAH ADA FOTO ->
   * nunggu dulu: kalau kursor gak banyak gerak sebelum dilepas, dianggap
   * "klik biasa" (pilih slot jadi aktif, buat ganti foto lewat grid). Kalau
   * gerak melewati DRAG_THRESHOLD_PX, dianggap drag (geser posisi foto).
   */
  const DRAG_THRESHOLD_PX = 4;

  const dragStateRef = useRef<{
    slotIndex: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    moved: boolean;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const canvasClientToSlotIndex = (clientX: number, clientY: number): number => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedTemplate) return -1;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    return selectedTemplate.slots.findIndex((s) => x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const idx = canvasClientToSlotIndex(e.clientX, e.clientY);
    if (idx === -1) return;

    const hasPhoto = Boolean(slotAssignments[idx]?.photoId);
    if (!hasPhoto) {
      // Slot kosong: gak ada yang bisa di-drag, langsung pilih aktif seperti biasa.
      setActiveSlotIndex(idx);
      return;
    }

    dragStateRef.current = {
      slotIndex: idx,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: slotAssignments[idx].offsetX,
      startOffsetY: slotAssignments[idx].offsetY,
      moved: false,
    };
    setIsDragging(true);

    const canvas = canvasRef.current;
    if (!canvas || !selectedTemplate) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const slot = selectedTemplate.slots[idx];

    const handleWindowPointerMove = (ev: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const deltaClientX = ev.clientX - drag.startClientX;
      const deltaClientY = ev.clientY - drag.startClientY;

      if (!drag.moved && Math.hypot(deltaClientX, deltaClientY) > DRAG_THRESHOLD_PX) {
        drag.moved = true;
      }
      if (!drag.moved) return;

      // Konversi delta dari koordinat layar (CSS px) ke koordinat internal
      // canvas, lalu ke perubahan offset (-1..1) relatif lebar/tinggi slot.
      // Drag ke kiri/atas -> menampakkan bagian foto yang tadinya
      // tersembunyi di kanan/bawah -> offset bertambah (lihat penjelasan
      // arah di lib/compositing.ts).
      const deltaCanvasX = deltaClientX * scaleX;
      const deltaCanvasY = deltaClientY * scaleY;
      const newOffsetX = drag.startOffsetX - (deltaCanvasX / slot.width) * 2;
      const newOffsetY = drag.startOffsetY - (deltaCanvasY / slot.height) * 2;

      setSlotAssignments((prev) => {
        const current = prev[drag.slotIndex];
        if (!current) return prev;
        const next = [...prev];
        next[drag.slotIndex] = {
          ...current,
          offsetX: Math.max(-1, Math.min(1, newOffsetX)),
          offsetY: Math.max(-1, Math.min(1, newOffsetY)),
        };
        return next;
      });
    };

    const handleWindowPointerUp = () => {
      const drag = dragStateRef.current;
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      setIsDragging(false);
      dragStateRef.current = null;
      if (drag && !drag.moved) {
        // Gak kegeser sama sekali -> ini klik biasa, bukan drag.
        setActiveSlotIndex(drag.slotIndex);
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
  };

  const photoIdToUrl = useCallback(
    (photoId: string | null) => (photoId ? session?.photos.find((p) => p.id === photoId)?.url : undefined),
    [session]
  );

  useEffect(() => {
    if (!selectedTemplate || !canvasRef.current) return;
    const slotPlacements = slotAssignments.map((a) => {
      const url = photoIdToUrl(a.photoId);
      if (!url) return undefined;
      return { photoUrl: url, offsetX: a.offsetX, offsetY: a.offsetY };
    });
    composeTemplate({ canvas: canvasRef.current, template: selectedTemplate, slotPlacements }).catch((err) =>
      console.error('Gagal render preview:', err)
    );
  }, [selectedTemplate, slotAssignments, photoIdToUrl]);

  const filledCount = slotAssignments.filter((a) => a.photoId !== null).length;
  const allSlotsFilled = slotAssignments.length > 0 && filledCount === slotAssignments.length;

  const handleSave = async () => {
    if (!canvasRef.current || !selectedTemplateId || !allSlotsFilled) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const blob = await canvasToBlob(canvasRef.current);
      await finalizeSession(sessionId, blob, selectedTemplateId, slotAssignments);
      setSaveMessage('Tersimpan sebagai versi baru — siap dicetak/diunduh.');
      // Refetch (bukan patch manual sebagian) — supaya daftar composites
      // (semua versi hasil akhir) ke-update lengkap dan konsisten sama yang
      // beneran ada di server, bukan cuma nebak-nebak bentuknya di client.
      const refreshed = await fetchSessionDetail(sessionId);
      setSession(refreshed);
    } catch (err) {
      console.error('Gagal menyimpan hasil akhir:', err);
      setSaveMessage('Gagal menyimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  // Ada perubahan yang belum disimpan? (template/slot/offset beda dari yang
  // tersimpan terakhir) — dipakai buat kasih hint sebelum cetak versi lama.
  const hasUnsavedChanges =
    session != null &&
    (session.templateId !== selectedTemplateId ||
      JSON.stringify(session.slotAssignments) !== JSON.stringify(slotAssignments));

  const handlePrint = async () => {
    if (!session?.finalCompositeUrl || !session.templateId) return;
    const savedTemplate = templates.find((t) => t.id === session.templateId);
    if (!savedTemplate) return;

    setPrinting(true);
    try {
      // Cetak pakai hasil yang TERSIMPAN terakhir (bukan preview yang lagi
      // diedit sekarang kalau belum di-"Simpan hasil") — sengaja begitu,
      // supaya "Cetak" selalu mencetak versi yang sudah dikonfirmasi.
      await printCompositeImage(session.finalCompositeUrl, savedTemplate.canvasWidth, savedTemplate.canvasHeight);
      await updateSessionStatus(sessionId, 'Printed');
      setSession((prev) => (prev ? { ...prev, status: 'Tercetak' } : prev));
    } catch (err) {
      console.error('Gagal mencetak:', err);
    } finally {
      setPrinting(false);
    }
  };

  const handleOpenZoom = () => {
    if (!canvasRef.current) return;
    setZoomImageUrl(canvasRef.current.toDataURL('image/jpeg', 0.92));
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
                {filledCount}/{slotAssignments.length || 0} Slot Terisi
              </span>
            </div>
            {activeSlotIndex !== null && (
              <p className="text-xs font-semibold text-[#2F4FE8] -mt-2">
                Klik foto di bawah untuk isi slot {activeSlotIndex + 1}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              {session.photos.map((photo) => {
                const usedInSlot = slotAssignments.some((a) => a.photoId === photo.id);
                return (
                  <button
                    key={photo.id}
                    onClick={() => handleSelectPhoto(photo.id)}
                    disabled={activeSlotIndex === null}
                    className="relative aspect-square rounded-md border-[2.5px] border-[#2F4FE8] overflow-hidden shadow-[2px_2px_0px_0px_#2F4FE8] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                    {usedInSlot && (
                      <div className="absolute bottom-1 right-1 bg-[#FFC93C] text-[#2F4FE8] border-2 border-[#2F4FE8] rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Preview + aksi */}
          <section className="md:col-span-7 flex flex-col items-center gap-4">
            <div className="relative w-full max-w-[420px] bg-white border-[3px] border-[#2F4FE8] rounded-md p-3 shadow-[4px_4px_0px_0px_#2F4FE8] flex justify-center">
              <button
                onClick={handleOpenZoom}
                title="Lihat besar"
                className="absolute top-2 right-2 z-10 bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] rounded-full p-1.5 shadow-[2px_2px_0px_0px_#2F4FE8]"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <canvas
                ref={canvasRef}
                onPointerDown={handleCanvasPointerDown}
                className={`max-w-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ maxHeight: '42vh', touchAction: 'none' }}
              />
            </div>

            {activeSlotIndex !== null && slotAssignments[activeSlotIndex]?.photoId && (
              <div className="flex items-center gap-2 text-xs">
                <p className="font-semibold text-[#2F4FE8]">
                  Tips: klik-tahan lalu geser foto langsung di preview buat atur posisinya
                </p>
                {(slotAssignments[activeSlotIndex].offsetX !== 0 || slotAssignments[activeSlotIndex].offsetY !== 0) && (
                  <button
                    onClick={handleResetOffset}
                    className="flex items-center gap-1 text-[#2F4FE8] font-bold underline cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!allSlotsFilled || saving}
              className="text-xs font-bold text-[#2F4FE8] underline decoration-2 underline-offset-4 disabled:opacity-40 disabled:no-underline cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Simpan hasil'}
            </button>
            {saveMessage && <p className="text-xs font-semibold text-[#2F4FE8]">{saveMessage}</p>}
            {hasUnsavedChanges && (
              <p className="text-xs text-amber-600 font-semibold">
                Ada perubahan belum disimpan — Cetak akan pakai versi terakhir yang tersimpan.
              </p>
            )}
            {session.status === 'Tercetak' && !hasUnsavedChanges && (
              <p className="text-xs text-green-700 font-semibold">Sudah pernah dicetak.</p>
            )}

            <div className="flex gap-4 w-full max-w-[400px]">
              <button
                onClick={handlePrint}
                disabled={!session.finalCompositeUrl || printing}
                title={!session.finalCompositeUrl ? 'Simpan hasil dulu sebelum bisa cetak' : undefined}
                className="flex-1 bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] rounded-full py-2.5 px-4 flex items-center justify-center gap-2 font-bold text-sm shadow-[2px_2px_0px_0px_#2F4FE8] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{printing ? 'Menyiapkan cetak...' : session.status === 'Tercetak' ? 'Cetak ulang' : 'Cetak'}</span>
              </button>
              <button
                onClick={() => setQrModalOpen(true)}
                disabled={!session.finalCompositeUrl}
                title={!session.finalCompositeUrl ? 'Simpan hasil dulu sebelum bisa generate QR' : undefined}
                className="flex-1 bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] rounded-full py-2.5 px-4 flex items-center justify-center gap-2 font-bold text-sm shadow-[2px_2px_0px_0px_#2F4FE8] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
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

      {/* Modal lihat preview besar */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
          onClick={() => setZoomImageUrl(null)}
        >
          <button
            onClick={() => setZoomImageUrl(null)}
            className="absolute top-5 right-5 bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] rounded-full p-2"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={zoomImageUrl}
            alt="Preview besar"
            className="max-w-full max-h-full rounded-md border-[3px] border-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Modal QR download */}
      {qrModalOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
          onClick={() => setQrModalOpen(false)}
        >
          <button
            onClick={() => setQrModalOpen(false)}
            className="absolute top-5 right-5 bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] rounded-full p-2"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="bg-white rounded-md p-6 flex flex-col items-center gap-3 max-w-[360px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-heading italic font-extrabold text-[#2F4FE8] text-lg">Scan buat unduh</p>
            <img
              src={`/api/sessions/${sessionId}/qr?t=${Date.now()}`}
              alt="QR download"
              className="w-64 h-64 border-2 border-[#2F4FE8] rounded-md"
            />
            <p className="text-xs text-gray-500 text-center">
              Pastikan HP kamu di jaringan WiFi yang sama, kecuali kalau muncul sebagai link cloud.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editing;