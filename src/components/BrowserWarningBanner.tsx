import React from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';

interface BrowserWarningBannerProps {
  isSupported: boolean;
  onDismiss: () => void;
  isDismissed: boolean;
}

export const BrowserWarningBanner: React.FC<BrowserWarningBannerProps> = ({
  isSupported,
  onDismiss,
  isDismissed,
}) => {
  if (isSupported || isDismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-900 transition-all">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="bg-amber-500 text-white p-1.5 rounded-lg flex-shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-sm sm:text-base">
            <p className="font-bold text-amber-950">
              เบราว์เซอร์นี้ไม่รองรับการเขียนไฟล์ลงแฟลชไดร์ฟโดยตรง
            </p>
            <p className="text-amber-800 text-sm">
              แนะนำให้เปิดผ่าน <strong>Google Chrome</strong> หรือ <strong>Microsoft Edge</strong> บนคอมพิวเตอร์ หรือใช้งานต่อในโหมดดาวน์โหลดไฟล์ ZIP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold px-3 py-1.5 rounded-lg text-xs sm:text-sm transition"
          >
            <Check className="w-4 h-4" />
            <span>ใช้โหมด ZIP</span>
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 text-amber-700 hover:text-amber-900 rounded-lg hover:bg-amber-100 transition"
            title="ปิดการแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
