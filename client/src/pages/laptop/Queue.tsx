import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { fetchSessions, deleteAllSessions } from '../../lib/api';

export type SessionStatus = 'Menunggu' | 'Diedit' | 'Siap Cetak' | 'Tercetak';

export interface QueueSession {
  id: string;
  name: string;
  timestamp: string; // "14:32"
  status: SessionStatus;
}

export interface QueueProps {
  onOpenSession: (sessionId: string) => void;
  onDeleteAll: () => void;
}

export const Queue: React.FC<QueueProps> = ({ onOpenSession, onDeleteAll }) => {
  const [sessions, setSessions] = useState<QueueSession[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSessions = () => {
    fetchSessions()
      .then((data) => {
        setSessions(data);
        setLoadError(null);
      })
      .catch((err) => {
        console.error('Gagal memuat antrian sesi:', err);
        setLoadError('Gagal memuat data. Pastikan server jalan.');
      });
  };

  // Polling tiap 5 detik (lihat software-architecture.md section 5 —
  // cukup untuk skala event ini, tidak perlu WebSocket)
  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteAll = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus semua data antrian sesi?')) {
      deleteAllSessions()
        .then(() => {
          setSessions([]);
          onDeleteAll();
        })
        .catch((err) => console.error('Gagal menghapus semua data:', err));
    }
  };

  const getActionButtonLabel = (status: SessionStatus): string => {
    switch (status) {
      case 'Menunggu':
        return 'Buka';
      case 'Diedit':
        return 'Lanjut edit';
      case 'Siap Cetak':
        return 'Cetak';
      case 'Tercetak':
        return 'Cetak ulang';
      default:
        return 'Buka';
    }
  };

  const getStatusBadgeStyle = (status: SessionStatus): string => {
    switch (status) {
      case 'Menunggu':
        return 'bg-[#FFC93C] text-[#1b1c17] border border-[#2F4FE8]';
      case 'Diedit':
        return 'bg-[#2F4FE8] text-white border border-[#2F4FE8]';
      case 'Siap Cetak':
        return 'bg-[#22C55E] text-white border border-[#16A34A]';
      case 'Tercetak':
        return 'bg-gray-200 text-gray-700 border border-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF6EC] flex flex-col p-6 sm:p-10 relative overflow-x-hidden select-none">
      {/* Light Density Decorative Elements */}
      <div className="absolute top-16 left-8 text-[#FF6B4A] opacity-60 pointer-events-none">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <div className="absolute top-28 right-16 text-[#FFC93C] pointer-events-none opacity-80">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <div className="absolute bottom-16 left-16 text-[#2F4FE8] pointer-events-none opacity-50">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M4 12 Q 10 4 16 12 T 28 12" />
        </svg>
      </div>

      {/* Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between pb-6 border-b-2 border-[#2F4FE8]/20 z-10">
        {/* Logo */}
        <h1 className="font-heading text-3xl sm:text-4xl italic font-extrabold text-[#2F4FE8] tracking-tight">
          FEST-SNAP
        </h1>

        {/* Delete All Danger Button */}
        <button
          onClick={handleDeleteAll}
          className="bg-white border-2 border-red-600 text-red-600 hover:bg-red-50 rounded-full px-5 py-2.5 flex items-center gap-2 font-bold text-sm shadow-[3px_3px_0px_0px_#DC2626] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
          <span>Hapus semua data</span>
        </button>
      </header>

      {loadError && (
        <div className="w-full max-w-5xl mx-auto mt-4 bg-red-50 border-2 border-red-300 text-red-700 text-sm font-semibold rounded-xl px-4 py-2 z-10">
          {loadError}
        </div>
      )}

      {/* Main Content Area */}
      <main className="w-full max-w-5xl mx-auto flex-1 mt-8 z-10">
        {/* Section Heading & Counter */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-2xl sm:text-3xl italic font-extrabold text-[#2F4FE8]">
            Antrian Sesi
          </h2>
          <span className="bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] font-bold text-sm px-4 py-1.5 rounded-full shadow-[2px_2px_0px_0px_#2F4FE8]">
            {sessions.length} Sesi Aktif
          </span>
        </div>

        {/* Vertical List of Session Row Cards */}
        {sessions.length === 0 ? (
          <div className="bg-white border-2 border-[#2F4FE8] rounded-2xl p-12 text-center shadow-[4px_4px_0px_0px_#2F4FE8]">
            <p className="font-heading text-xl italic font-bold text-gray-500">
              Tidak ada antrian sesi aktif
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white border-2 border-[#2F4FE8] rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#2F4FE8] flex items-center justify-between gap-4 transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                {/* Avatar + Session Name/Timestamp Badge */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#2F4FE8] text-white flex items-center justify-center font-bold text-lg border-2 border-[#2F4FE8] shadow-sm">
                    {session.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Session identity badge: pill shape, yellow fill, blue border */}
                  <div className="bg-[#FFC93C] border-2 border-[#2F4FE8] rounded-full px-4 py-1.5 text-sm font-extrabold text-[#1b1c17]">
                    {session.name}-{session.timestamp}
                  </div>
                </div>

                {/* Status Badge */}
                <div className="hidden sm:flex items-center">
                  <span
                    className={`rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider ${getStatusBadgeStyle(
                      session.status
                    )}`}
                  >
                    {session.status}
                  </span>
                </div>

                {/* Compact Action Button (No icon in list row) */}
                <button
                  onClick={() => onOpenSession(session.id)}
                  className="bg-white border-2 border-[#2F4FE8] text-[#2F4FE8] hover:bg-[#2F4FE8] hover:text-white rounded-full px-6 py-2 font-bold text-sm shadow-[3px_3px_0px_0px_#2F4FE8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                >
                  {getActionButtonLabel(session.status)}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Queue;
