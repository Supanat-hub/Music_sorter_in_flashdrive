import React, { useEffect } from 'react';
import { X, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl">
              <HelpCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-800">วิธีใช้งาน</h3>
              <p className="text-slate-500 text-base">ขั้นตอนการจัดเรียงเพลงลงแฟลชไดร์ฟ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6 text-slate-700 text-base sm:text-lg leading-relaxed overflow-y-auto flex-1">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-9 h-9 bg-emerald-600 text-white font-bold rounded-full flex-shrink-0 text-lg shadow-sm">
              1
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-lg sm:text-xl mb-1">
                เลือกแฟลชไดร์ฟหรือโฟลเดอร์เพลง
              </h4>
              <p className="text-slate-600">
                กดปุ่ม "เลือกโฟลเดอร์ในแฟลชไดร์ฟ" เพื่อโหลดเพลงทั้งหมดเข้าสู่ระบบ
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-9 h-9 bg-emerald-600 text-white font-bold rounded-full flex-shrink-0 text-lg shadow-sm">
              2
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-lg sm:text-xl mb-1">
                จัดเรียงลำดับหรือตัดเพลง
              </h4>
              <p className="text-slate-600">
                - กดปุ่ม <strong>[▶]</strong> เพื่อฟังตัวอย่างเสียง<br />
                - ลากสลับแถวหรือกดปุ่มลูกศร <strong>[▲] [▼]</strong> เพื่อเปลี่ยนลำดับเพลง<br />
                - กดปุ่ม <strong>[ตัดเพลง]</strong> เพื่อตัดท่อนอินโทรหรือท่อนจบ
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-9 h-9 bg-emerald-600 text-white font-bold rounded-full flex-shrink-0 text-lg shadow-sm">
              3
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-lg sm:text-xl mb-1">
                บันทึกลงแฟลชไดร์ฟ
              </h4>
              <p className="text-slate-600">
                กดปุ่ม "บันทึกลงแฟลชไดร์ฟ" ระบบจะใส่เลข 001, 002... และบันทึกแทนที่ลงแฟลชไดร์ฟตามลำดับทันที
              </p>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 text-sm sm:text-base">
            <p className="font-bold mb-1">(*) หมายเหตุเกี่ยวกับลำโพงแฟลชไดร์ฟ</p>
            <p>
              เครื่องเล่น MP3 และลำโพงพกพาส่วนใหญ่จะเล่นเพลงตามลำดับการเขียนไฟล์ลงแฟลชไดร์ฟ ระบบนี้จึงเขียนไฟล์ทีละเพลงตามลำดับเพื่อให้เปิดเล่นได้เรียงกันอย่างถูกต้อง
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0 bg-slate-50/50">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl transition text-base shadow-sm"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
