import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';

const IDLE_TIMEOUT_MS = 45_000; // 45 detik, dalam rentang 30-60 detik sesuai requirement (FR-04)

export interface InputNameProps {
  onSubmit: (name: string) => void;
  onTimeout: () => void;
}

export const InputName: React.FC<InputNameProps> = ({ onSubmit, onTimeout }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Idle timeout (FR-04): kalau gak ada perubahan input dalam IDLE_TIMEOUT_MS,
  // sesi dianggap ditinggal dan dibatalkan otomatis.
  useEffect(() => {
    const timer = setTimeout(() => onTimeout(), IDLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [name, onTimeout]);

  // Regex to detect emojis
  const emojiRegex = /\p{Extended_Pictographic}/u;

  const validateAndSetName = (inputVal: string) => {
    setError(null);

    if (emojiRegex.test(inputVal)) {
      setError('Nama tidak boleh mengandung emoji.');
      return;
    }

    if (inputVal.length > 10) {
      setError('Maksimal 10 karakter.');
      return;
    }

    setName(inputVal);
  };

  const isValid = name.trim().length > 0 && name.trim().length <= 10 && !emojiRegex.test(name);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onSubmit(name.trim());
    } else if (name.trim().length === 0) {
      setError('Nama sesi wajib diisi.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF6EC] flex flex-col items-center justify-between p-6 sm:p-10 relative overflow-hidden select-none">
      {/* Header Logo */}
      <header className="w-full text-center pt-4 z-10">
        <h1 className="font-heading text-3xl sm:text-4xl italic font-extrabold text-[#2F4FE8] tracking-tight">
          FEST-SNAP
        </h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center my-auto z-10 w-full max-w-lg px-4 text-center">
        <div className="w-full bg-white border-[4px] border-[#2F4FE8] rounded-3xl p-8 sm:p-10 shadow-[8px_8px_0px_0px_#2F4FE8] flex flex-col items-center">
          {/* Heading */}
          <h2 className="font-heading text-3xl sm:text-4xl italic font-extrabold text-[#2F4FE8] mb-8">
            Nama sesi kamu
          </h2>

          <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-4">
            <div className="w-full relative">
              <input
                type="text"
                value={name}
                onChange={(e) => validateAndSetName(e.target.value)}
                placeholder="Masukkan nama sesi"
                maxLength={12} // Allow typing slightly over to show inline error message
                autoFocus
                className="w-full text-center text-2xl sm:text-3xl font-bold text-[#1b1c17] bg-[#FAF6EC] border-[3px] border-[#2F4FE8] rounded-2xl py-4 px-6 focus:outline-none focus:ring-4 focus:ring-[#FFC93C] transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Helper Caption */}
            <p className="text-sm sm:text-base font-semibold text-gray-800 tracking-wide">
              Tanpa emoji, maksimal 10 karakter
            </p>

            {/* Error Message */}
            {error && (
              <p className="text-sm font-bold text-red-600 bg-red-50 border border-red-300 rounded-lg px-3 py-1 animate-shake">
                {error}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isValid}
              className={`w-full mt-6 bg-white border-[4px] border-[#2F4FE8] text-[#2F4FE8] rounded-full py-4 px-8 flex items-center justify-center gap-3 font-bold text-xl shadow-[6px_6px_0px_0px_#2F4FE8] transition-all cursor-pointer ${
                isValid
                  ? 'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none opacity-100'
                  : 'opacity-40 cursor-not-allowed shadow-[2px_2px_0px_0px_#2F4FE8]'
              }`}
            >
              <Play className="w-6 h-6 fill-[#2F4FE8] text-[#2F4FE8]" />
              <span>Mulai foto</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default InputName;
