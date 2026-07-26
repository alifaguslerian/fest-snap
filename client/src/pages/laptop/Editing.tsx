import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Printer, QrCode, Trash2, ArrowLeft, Check } from 'lucide-react';
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
 * Ditulis ulang dari hasil AI Studio (yang pakai foto Unsplash mock dan
 * auto-fill round-robin) supaya sesuai Business Rule sebenarnya: pengunjung
 * PILIH SLOT dulu (klik area di preview), baru PILIH FOTO untuk mengisi slot
 * itu — bukan otomatis. Foto boleh dipakai berulang di banyak slot.
 * Compositing beneran pakai Canvas API (lib/compositing.ts), bukan lagi
 * sekadar overlay posisi absolut.
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

  // Muat data sesi + daftar template sekali saat halaman dibuka.
  useEffect(() => {
    Promise.all([fetchSessionDetail(sessionId), fetchTemplates()])
      .then(([sessionData, templateList]) => {
        setSession(sessionData);
        setTemplates(templateList);

        // Kalau sesi ini sudah pernah diedit sebelumnya, pulihkan pilihan lama
        // (Business Rule: sesi bisa dibuka & diedit ulang kapan saja).
        if (sessionData.templateId) {
          setSelectedTemplateId(sessionData.templateId);
          const tpl = templateList.find((t) => t.id === sessionData.templateId);
          if (tpl) {
            const restored = sessionData.slotAssignments ?? Array(tpl.slots.length).fill(null);
            setSlotPhotoIds(restored);
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
  };

  const handleSelectPhoto = (photoId: string) => {
    if (activeSlotIndex === null) return; // belum pilih slot mana yang mau diisi
    setSlotPhotoIds((prev) => {
      const next = [...prev];
      next[activeSlotIndex] = photoId;
      return next;
    });
  };

  const photoIdToUrl = useCallback(
    (photoId: string | null) => {
      if (!photoId || !session) return undefined;
      return session.photos.find((p) => p.id === photoId)?.url;
    },
    [session]
  );

  // Render ulang preview setiap kali template atau isi slot berubah.
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

  const allSlotsFilled = slotPhotoIds.length > 0 && slotPhotoIds.every((id) => id !== null);

  const handleFinish = async () => {
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
    <div className="min-h-screen bg-[#FAF6EC] p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToQueue}
            className="p-2 rounded-full border-2 border-[#2F4FE8] text-[#2F4FE8]"
            aria-label="Kembali ke queue"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading text-2xl italic font-extrabold text-[#2F4FE8]">FEST-SNAP</h1>
          <span className="bg-[#FFC93C] border-2 border-[#2F4FE8] text-[#5C4400] text-sm font-semibold px-3 py-1 rounded-full">
            {session.displayName}-{session.timestamp}
          </span>
        </div>
        <button
          onClick={onDeleteSession}
          className="p-2 rounded-full border-2 border-red-400 text-red-500"
          aria-label="Hapus sesi"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Kolom kiri: pilih template */}
        <div className="lg:w-48">
          <p className="text-sm font-semibold text-gray-700 mb-2">Pilih Template</p>
          <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
                className={`min-w-[100px] lg:w-full aspect-[3/4] rounded-xl border-2 overflow-hidden bg-white flex-shrink-0 ${
                  tpl.id === selectedTemplateId ? 'border-[#2F4FE8] border-[3px]' : 'border-gray-300'
                }`}
              >
                <img src={tpl.frameUrl} alt={tpl.name} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        </div>

        {/* Kolom tengah: preview (klik slot untuk aktifkan) */}
        <div className="flex-1 flex flex-col items-center">
          <p className="text-sm font-semibold text-gray-700 mb-2 self-start">
            Preview — klik slot foto untuk memilih, lalu klik foto di kanan
          </p>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="max-w-full border-2 border-[#2F4FE8] rounded-xl cursor-pointer bg-white"
            style={{ maxHeight: '70vh' }}
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleFinish}
              disabled={!allSlotsFilled || saving}
              className="flex items-center gap-2 bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] font-bold px-6 py-3 rounded-full disabled:opacity-40"
            >
              <Check className="w-5 h-5" />
              {saving ? 'Menyimpan...' : 'Selesai'}
            </button>
            <button
              disabled
              title="Tersedia setelah hasil akhir disimpan (Slice 3)"
              className="flex items-center gap-2 bg-white border-2 border-gray-300 text-gray-400 font-bold px-6 py-3 rounded-full"
            >
              <Printer className="w-5 h-5" />
              Cetak
            </button>
            <button
              disabled
              title="Tersedia di Slice 4"
              className="flex items-center gap-2 bg-white border-2 border-gray-300 text-gray-400 font-bold px-6 py-3 rounded-full"
            >
              <QrCode className="w-5 h-5" />
              QR Download
            </button>
          </div>
          {saveMessage && <p className="mt-2 text-sm font-semibold text-[#2F4FE8]">{saveMessage}</p>}
          {!allSlotsFilled && (
            <p className="mt-2 text-xs text-gray-500">Isi semua slot foto dulu sebelum bisa menyimpan.</p>
          )}
        </div>

        {/* Kolom kanan: foto mentah */}
        <div className="lg:w-56">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Foto Kamu {activeSlotIndex !== null && <span className="text-[#2F4FE8]">(mengisi slot {activeSlotIndex + 1})</span>}
          </p>
          <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
            {session.photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => handleSelectPhoto(photo.id)}
                disabled={activeSlotIndex === null}
                className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 disabled:opacity-50"
              >
                <img src={photo.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editing;