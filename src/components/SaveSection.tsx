import React from 'react';
import { Save, CheckCircle2, AlertCircle, HardDrive } from 'lucide-react';
import { ExportProgress } from '../types/audio';

interface SaveSectionProps {
  hasTracks: boolean;
  exportProgress: ExportProgress;
  onSaveToDirectory: () => void;
  folderName: string | null;
}

export const SaveSection: React.FC<SaveSectionProps> = ({
  hasTracks,
  exportProgress,
  onSaveToDirectory,
  folderName,
}) => {
  const isWriting = exportProgress.status === 'writing';
  const isCompleted = exportProgress.status === 'completed';
  const isError = exportProgress.status === 'error';

  const percentage =
    exportProgress.total > 0
      ? Math.round((exportProgress.current / exportProgress.total) * 100)
      : 0;

  return (
    <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center w-7 h-7 bg-emerald-600 text-white font-bold rounded-full text-base">
          3
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
          ขั้นตอนที่ 3: บันทึกลงแฟลชไดร์ฟ
        </h2>
      </div>

      <p className="text-slate-600 text-base mb-4">
        บันทึกไฟล์เรียงลำดับ <strong>001, 002, 003...</strong> แทนที่ในแฟลชไดร์ฟ {folderName ? `("${folderName}")` : ''} ทันที 
        <span className="text-emerald-700 font-semibold"> (บันทึกลงที่เดิม ไม่สร้างโฟลเดอร์ซ้อน)</span>
      </p>

      {/* Main Save Button */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onSaveToDirectory}
          disabled={!hasTracks || isWriting}
          className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xl sm:text-2xl font-bold py-5 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all"
        >
          <Save className="w-8 h-8" />
          <span>
            {isWriting
              ? 'กำลังบันทึก...'
              : 'บันทึกลงแฟลชไดร์ฟ'}
          </span>
        </button>
      </div>

      {/* Progress Bar when writing */}
      {isWriting && (
        <div className="mt-6 bg-slate-50 border border-emerald-200 p-5 rounded-xl space-y-3 animate-pulse">
          <div className="flex justify-between items-center text-slate-700 font-bold text-base">
            <span className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-emerald-600" />
              <span>
                กำลังบันทึกเพลงที่ {exportProgress.current} จากทั้งหมด {exportProgress.total} เพลง
              </span>
            </span>
            <span className="text-emerald-700 text-xl font-extrabold">{percentage}%</span>
          </div>

          <div className="w-full bg-slate-200 h-4 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {exportProgress.currentFileName && (
            <p className="text-sm text-slate-500 font-mono truncate">
              {exportProgress.currentFileName}
            </p>
          )}
        </div>
      )}

      {/* Success Notification */}
      {isCompleted && (
        <div className="mt-6 bg-emerald-50 border-2 border-emerald-400 p-5 rounded-2xl flex items-start gap-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xl font-bold text-emerald-900 mb-1">
              บันทึกเสร็จสิ้น
            </h4>
            <p className="text-emerald-800 text-base">
              บันทึกเพลงเรียงตามลำดับลงแฟลชไดร์ฟเรียบร้อย สามารถนำไปเปิดใช้งานกับลำโพงได้ทันที
            </p>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {isError && (
        <div className="mt-6 bg-rose-50 border-2 border-rose-400 p-5 rounded-2xl flex items-start gap-4">
          <AlertCircle className="w-8 h-8 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xl font-bold text-rose-900 mb-1">
              เกิดข้อผิดพลาดในการบันทึก
            </h4>
            <p className="text-rose-800 text-base">
              {exportProgress.errorMessage || 'กรุณาตรวจสอบการเชื่อมต่อแฟลชไดร์ฟหรือพื้นที่ว่าง แล้วลองใหม่อีกครั้ง'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
