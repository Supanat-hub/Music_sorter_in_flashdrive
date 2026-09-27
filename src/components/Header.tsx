import React from 'react';
import { HelpCircle, Download, Music2 } from 'lucide-react';

interface HeaderProps {
  onOpenHelp: () => void;
  canInstallPwa: boolean;
  onInstallPwa: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHelp,
  canInstallPwa,
  onInstallPwa,
}) => {
  return (
    <header className="bg-emerald-700 text-white shadow-md border-b-4 border-emerald-800">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Title & Logo */}
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="bg-white/10 p-2.5 rounded-xl border border-white/20">
            <Music2 className="w-8 h-8 text-emerald-200" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              โปรแกรมจัดเรียงและตัดเพลงแฟลชไดร์ฟ
            </h1>
            <p className="text-emerald-100 text-sm sm:text-base">
              จัดเรียงเพลงและบันทึกตามลำดับสำหรับเปิดกับลำโพง
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
          {canInstallPwa && (
            <button
              onClick={onInstallPwa}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-900 font-bold px-4 py-2.5 rounded-xl shadow transition text-base"
              title="ติดตั้งเป็นแอปพลิเคชัน"
            >
              <Download className="w-5 h-5" />
              <span>ติดตั้งแอป</span>
            </button>
          )}

          <button
            onClick={onOpenHelp}
            className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-emerald-100 font-semibold px-4 py-2.5 rounded-xl border border-emerald-600 transition text-base"
          >
            <HelpCircle className="w-5 h-5" />
            <span>วิธีใช้งาน</span>
          </button>
        </div>
      </div>
    </header>
  );
};
