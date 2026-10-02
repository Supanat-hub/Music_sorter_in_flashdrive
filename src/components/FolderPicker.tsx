import React, { useRef, useEffect } from 'react';
import { FolderOpen, Plus, RefreshCw, HardDrive } from 'lucide-react';
import { YouTubeIcon } from './YouTubeIcon';
import { isFileSystemAccessSupported, isAudioFile } from '../utils/fileSystem';

interface FolderPickerProps {
  folderName: string | null;
  trackCount: number;
  onSelectDirectory: () => void;
  onAddLocalFiles: (files: FileList) => void;
  onSelectFolderFiles: (files: File[], folderName: string) => void;
  onOpenYouTubeDownloader: () => void;
  onReset: () => void;
  isLoading: boolean;
  isDirectWriteSupported: boolean;
}

export const FolderPicker: React.FC<FolderPickerProps> = ({
  folderName,
  trackCount,
  onSelectDirectory,
  onAddLocalFiles,
  onSelectFolderFiles,
  onOpenYouTubeDownloader,
  onReset,
  isLoading,
  isDirectWriteSupported,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const isSupported = isFileSystemAccessSupported();

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  const handleFolderButtonClick = () => {
    if (isSupported) {
      onSelectDirectory();
    } else {
      folderInputRef.current?.click();
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allFiles = Array.from(e.target.files);
      const audioFiles = allFiles.filter((f) => isAudioFile(f.name));

      let detectedFolderName = 'โฟลเดอร์แฟลชไดร์ฟ';
      const firstRel = (e.target.files[0] as any).webkitRelativePath;
      if (firstRel) {
        detectedFolderName = firstRel.split('/')[0] || detectedFolderName;
      }

      onSelectFolderFiles(audioFiles, detectedFolderName);
    }
    e.target.value = '';
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddLocalFiles(e.target.files);
    }
    e.target.value = '';
  };

  return (
    <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center w-7 h-7 bg-emerald-600 text-white font-bold rounded-full text-base">
          1
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
          ขั้นตอนที่ 1: เลือกแฟลชไดร์ฟหรือโฟลเดอร์เพลง
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        {!folderName && trackCount === 0 ? (
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={handleFolderButtonClick}
              disabled={isLoading}
              className="flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-base sm:text-lg font-bold py-4 px-4 rounded-xl shadow-md transition"
            >
              <FolderOpen className="w-6 h-6 flex-shrink-0" />
              <span>
                {isLoading
                  ? 'กำลังโหลด...'
                  : isDirectWriteSupported
                  ? 'เลือกโฟลเดอร์ในแฟลชไดร์ฟ'
                  : 'เลือกโฟลเดอร์เพลง'}
              </span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex items-center justify-center gap-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-300 text-base sm:text-lg font-bold py-4 px-4 rounded-xl transition"
            >
              <Plus className="w-6 h-6 text-emerald-700 flex-shrink-0" />
              <span>เลือกไฟล์จากเครื่อง</span>
            </button>

            <button
              onClick={onOpenYouTubeDownloader}
              disabled={isLoading}
              className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:from-red-800 active:to-rose-800 disabled:opacity-50 text-white text-base sm:text-lg font-bold py-4 px-4 rounded-xl shadow-md transition"
            >
              <YouTubeIcon className="w-6 h-6 flex-shrink-0" />
              <span>ดาวน์โหลดจาก YouTube</span>
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 text-white p-3 rounded-lg">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <p className="text-slate-500 text-sm font-semibold">โฟลเดอร์ปัจจุบัน:</p>
                <p className="text-slate-800 text-lg sm:text-xl font-bold">
                  {folderName || 'ไฟล์ที่เลือกไว้'}
                </p>
                <p className="text-emerald-700 text-sm font-medium">
                  ทั้งหมด {trackCount} เพลง
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 font-semibold px-3 py-2 rounded-lg text-sm shadow-sm transition"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>เพิ่มไฟล์</span>
              </button>

              <button
                onClick={onOpenYouTubeDownloader}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold px-3 py-2 rounded-lg text-sm shadow-sm transition"
              >
                <YouTubeIcon className="w-4 h-4 text-red-600" />
                <span>โหลดจาก YouTube</span>
              </button>

              <button
                onClick={handleFolderButtonClick}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-2 rounded-lg text-sm shadow-sm transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>เปลี่ยนโฟลเดอร์</span>
              </button>

              <button
                onClick={onReset}
                className="text-slate-500 hover:text-rose-600 font-medium px-3 py-2 text-sm transition"
              >
                ล้างรายการ
              </button>
            </div>
          </div>
        )}


        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFolderInputChange}
          multiple
          className="hidden"
        />

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          multiple
          accept=".mp3,.wav,.m4a,.aac,.flac,.ogg"
          className="hidden"
        />
      </div>
    </section>
  );
};
