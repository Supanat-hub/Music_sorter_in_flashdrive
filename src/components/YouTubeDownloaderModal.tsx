import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Link as LinkIcon,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  ListMusic,
  CheckSquare,
  Square,
  Radio,
  ClockAlert,
  Play,
  Volume2,
} from 'lucide-react';
import { YouTubeIcon } from './YouTubeIcon';
import { YouTubeSearchResult, YouTubeUrlInfo } from '../types/audio';
import {
  searchYouTube,
  getYouTubeUrlInfo,
  downloadYouTubeTrack,
  getBackendUrl,
  setBackendUrl,
  detectBestBackendUrl,
} from '../utils/youtubeApi';

interface YouTubeDownloaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackDownloaded: (file: File) => void;
}

interface PreviewTrack {
  id: string;
  title: string;
  channel?: string;
  url: string;
  duration_str?: string;
  is_live?: boolean;
  is_too_long?: boolean;
}

export const YouTubeDownloaderModal: React.FC<YouTubeDownloaderModalProps> = ({
  isOpen,
  onClose,
  onTrackDownloaded,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'url'>('search');

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // URL State
  const [urlInput, setUrlInput] = useState<string>('');
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);
  const [urlInfo, setUrlInfo] = useState<YouTubeUrlInfo | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);

  // Downloading State
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgressText, setDownloadProgressText] = useState<string>('');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Preview State
  const [previewTrack, setPreviewTrack] = useState<PreviewTrack | null>(null);

  // Backend Connection Mode State (Local vs Cloud)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'local' | 'cloud'>('checking');
  const [isLocalMode, setIsLocalMode] = useState<boolean>(false);

  // Auto-detect best backend (Localhost vs Render) on modal open
  useEffect(() => {
    if (isOpen) {
      detectBestBackendUrl().then((url) => {
        const local = url.includes('localhost') || url.includes('127.0.0.1');
        setIsLocalMode(local);
        setBackendStatus(local ? 'local' : 'cloud');
      });
    }
  }, [isOpen]);

  // Stop preview whenever modal closes
  useEffect(() => {
    if (!isOpen) {
      setPreviewTrack(null);
    }
  }, [isOpen]);

  const handleTogglePreview = (track: PreviewTrack) => {
    if (previewTrack?.id === track.id) {
      setPreviewTrack(null);
    } else {
      setPreviewTrack(track);
    }
  };

  // Hidden Developer Mode (Click logo 5 times)
  const [logoClickCount, setLogoClickCount] = useState<number>(0);
  const lastLogoClickTimeRef = useRef<number>(0);

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastLogoClickTimeRef.current > 1500) {
      setLogoClickCount(1);
    } else {
      const nextCount = logoClickCount + 1;
      setLogoClickCount(nextCount);
      if (nextCount >= 5) {
        setLogoClickCount(0);
        const currentUrl = getBackendUrl();
        const newUrl = prompt('ตั้งค่า Developer Backend URL (สำหรับผู้ดูแลระบบ):', currentUrl);
        if (newUrl !== null) {
          setBackendUrl(newUrl);
          alert('บันทึก Backend URL เรียบร้อย');
        }
      }
    }
    lastLogoClickTimeRef.current = now;
  };

  // Perform search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchYouTube(searchQuery.trim(), 12);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('ไม่พบเพลงที่ตรงกับการค้นหา กรุณาลองใช้คำค้นหาอื่น');
      }
    } catch (err: any) {
      setSearchError(err.message || 'การค้นหาขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSearching(false);
    }
  };

  // Inspect URL
  const handleInspectUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    setIsLoadingUrl(true);
    setUrlError(null);
    setUrlInfo(null);
    try {
      const info = await getYouTubeUrlInfo(urlInput.trim());
      setUrlInfo(info);
      if (info.type === 'playlist' && info.items) {
        // Only select items that are not live and not too long (< 20 mins)
        setSelectedPlaylistIds(
          info.items.filter((i) => !i.is_live && !i.is_too_long).map((i) => i.id)
        );
      }
    } catch (err: any) {
      setUrlError(err.message || 'ไม่สามารถเปิดข้อมูลลิงก์นี้ได้ กรุณาตรวจสอบว่าเป็นลิงก์ YouTube ที่ถูกต้อง');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Download single track
  const handleDownloadSingle = async (url: string, id: string, titleHint?: string) => {
    setDownloadingId(id);
    setDownloadProgressText(`กำลังดาวน์โหลดและเตรียมเพลง "${titleHint || 'เพลง'}" สำหรับลำโพง...`);
    setDownloadError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { file, title } = await downloadYouTubeTrack(url, controller.signal);
      onTrackDownloaded(file);
      showSuccess(`ดาวน์โหลด "${title}" สำเร็จและเพิ่มเข้าเพลย์ลิสต์แล้ว!`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setDownloadError(err.message || 'ไม่สามารถดาวน์โหลดเพลงนี้ได้ กรุณาลองเลือกเพลงอื่น');
      }
    } finally {
      setDownloadingId(null);
      setDownloadProgressText('');
      abortControllerRef.current = null;
    }
  };

  // Download batch playlist
  const handleDownloadPlaylistSelected = async () => {
    if (!urlInfo || urlInfo.type !== 'playlist' || !urlInfo.items) return;

    const toDownload = urlInfo.items.filter((item) => selectedPlaylistIds.includes(item.id));
    if (toDownload.length === 0) {
      alert('กรุณาเลือกอย่างน้อย 1 เพลง');
      return;
    }

    setDownloadError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let successCount = 0;
    for (let i = 0; i < toDownload.length; i++) {
      const item = toDownload[i];
      setDownloadingId(item.id);
      setDownloadProgressText(
        `กำลังดาวน์โหลดเพลงที่ ${i + 1}/${toDownload.length}: "${item.title}"...`
      );

      try {
        const { file } = await downloadYouTubeTrack(item.url, controller.signal);
        onTrackDownloaded(file);
        successCount++;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          break;
        }
        console.warn(`Failed to download ${item.title}:`, err);
      }
    }

    setDownloadingId(null);
    setDownloadProgressText('');
    abortControllerRef.current = null;
    showSuccess(`ดาวน์โหลดเสร็จสิ้น ${successCount}/${toDownload.length} เพลง!`);
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setDownloadingId(null);
      setDownloadProgressText('');
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };

  const togglePlaylistItem = (id: string, isBlocked?: boolean) => {
    if (isBlocked) return;
    setSelectedPlaylistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPlaylist = () => {
    if (!urlInfo || !urlInfo.items) return;
    const availableItems = urlInfo.items.filter((i) => !i.is_live && !i.is_too_long);
    if (selectedPlaylistIds.length === availableItems.length) {
      setSelectedPlaylistIds([]);
    } else {
      setSelectedPlaylistIds(availableItems.map((i) => i.id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-emerald-700 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogoClick}
              type="button"
              className="bg-white/20 p-2 rounded-xl backdrop-blur-md focus:outline-none transition active:scale-95"
              title="YouTube Downloader"
            >
              <YouTubeIcon className="w-7 h-7 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                  <span>ดาวน์โหลดเพลงจาก YouTube</span>
                </h2>
                {backendStatus === 'local' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-100 border border-emerald-400/40 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                    โหมดในเครื่อง (เร็ว 100%)
                  </span>
                )}
                {backendStatus === 'cloud' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/15 text-white/90 border border-white/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-300"></span>
                    คลาวด์ Render
                  </span>
                )}
              </div>
              <p className="text-white/90 text-xs sm:text-sm">
                ค้นหาหรือวางลิงก์เพื่อเพิ่มเพลงลงเพลย์ลิสต์สำหรับเปิดบนลำโพง
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setPreviewTrack(null);
              onClose();
            }}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
            title="ปิดหน้าต่าง"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Tabs (Only 2 User-Friendly Tabs) */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-sm sm:text-base font-semibold">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition ${
              activeTab === 'search'
                ? 'border-red-600 text-red-600 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>ค้นหาเพลง</span>
          </button>

          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-2 py-2.5 px-4 border-b-2 transition ${
              activeTab === 'url'
                ? 'border-red-600 text-red-600 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>วางลิงก์ YouTube</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Toast Notification */}
          {successToast && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between gap-3 shadow-sm animate-bounce-short">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="font-semibold text-sm sm:text-base">{successToast}</span>
              </div>
              <button
                onClick={() => setSuccessToast(null)}
                className="text-emerald-700 hover:text-emerald-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Download in progress banner */}
          {downloadingId && (
            <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex items-center justify-between gap-3 shadow-sm animate-pulse">
              <div className="flex items-center gap-3 min-w-0">
                <Loader2 className="w-6 h-6 text-amber-600 animate-spin flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-amber-950 font-bold text-sm sm:text-base truncate">
                    {downloadProgressText}
                  </p>
                  <p className="text-amber-700 text-xs">
                    กำลังดึงเสียงและจัดเตรียมไฟล์เพลง กรุณารอสักครู่...
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelDownload}
                className="bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold px-3 py-1.5 rounded-lg text-xs flex-shrink-0 transition"
              >
                ยกเลิก
              </button>
            </div>
          )}

          {/* General Download Error (Clean, Friendly) */}
          {downloadError && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm sm:text-base">ไม่สามารถดาวน์โหลดเพลงนี้ได้</p>
                <p className="text-xs sm:text-sm text-rose-700 mt-0.5">{downloadError}</p>
                {!isLocalMode ? (
                  <div className="mt-2.5 pt-2.5 border-t border-rose-200/80 text-xs text-slate-700 bg-white/80 p-3 rounded-lg">
                    <p className="font-bold text-emerald-800 flex items-center gap-1.5 text-xs sm:text-sm">
                      ⚡ วิธีแก้ให้โหลดได้ 100% ทุกเพลง (ไม่มีติดบล็อก):
                    </p>
                    <p className="mt-1 text-slate-600 leading-relaxed">
                      เพลงที่มีลิขสิทธิ์บางเพลง YouTube จะบล็อก IP เซิร์ฟเวอร์ Cloud — ให้เปิดไฟล์ <code className="bg-emerald-50 text-emerald-800 font-semibold px-1.5 py-0.5 rounded border border-emerald-200">start-downloader.bat</code> ในโฟลเดอร์โปรเจกต์บนเครื่องของคุณ ระบบจะสลับมาดาวน์โหลดผ่านเน็ตบ้านของคุณอัตโนมัติ เร็ว 100% ทุกเพลง!
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-rose-600 mt-1">
                    💡 คำแนะนำ: หากเพลงติดข้อจำกัดเฉพาะ กรุณาลองเลือกเวอร์ชันอื่นหรือพิมพ์ค้นหาใหม่
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: SEARCH */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="พิมพ์ชื่อเพลง, ศิลปิน, หรือแนวเพลง..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white text-base transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition flex items-center gap-2 flex-shrink-0"
                >
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  <span className="hidden sm:inline">ค้นหา</span>
                </button>
              </form>

              {/* Suggestions */}
              {searchResults.length === 0 && !isSearching && !searchError && (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <YouTubeIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-semibold text-base mb-1">
                    ค้นหาเพลงจาก YouTube ได้ทันที
                  </p>
                  <p className="text-slate-400 text-sm mb-4">
                    พิมพ์ชื่อเพลงหรือกดคำค้นหายอดนิยมด้านล่างนี้:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                    {[
                      'เพลงเต้นแอโรบิก',
                      'เพลงลูกทุ่งฮิต 2026',
                      'เพลงสากลฟังสบาย',
                      'ดนตรีบำบัด ผ่อนคลาย',
                      'เพลงเพื่อชีวิต ยุค 90',
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSearchQuery(tag);
                          setTimeout(() => {
                            searchYouTube(tag, 12).then(setSearchResults);
                          }, 50);
                        }}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium px-3 py-1.5 rounded-full transition"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Error */}
              {searchError && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
                  {searchError}
                </div>
              )}

              {/* Search Results List */}
              {searchResults.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span className="uppercase tracking-wider">ผลลัพธ์การค้นหา ({searchResults.length} เพลง)</span>
                    <span className="text-slate-400">รองรับเพลงความยาวไม่เกิน 20 นาที</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {searchResults.map((item) => {
                      const isBlocked = item.is_live || item.is_too_long;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border transition ${
                            isBlocked ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          {/* Thumbnail */}
                          <div className="relative w-20 sm:w-24 h-14 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <span className="absolute bottom-1 right-1 bg-black/80 text-white font-mono text-[10px] px-1 rounded">
                              {item.duration_str}
                            </span>
                          </div>

                          {/* Title and info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {item.is_live && (
                                <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 flex-shrink-0">
                                  <Radio className="w-3 h-3 animate-pulse" />
                                  <span>ไลฟ์สด</span>
                                </span>
                              )}
                              {item.is_too_long && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 flex-shrink-0">
                                  <ClockAlert className="w-3 h-3" />
                                  <span>เกิน 20 นาที</span>
                                </span>
                              )}
                              <h4
                                className="font-bold text-slate-800 text-sm sm:text-base line-clamp-1"
                                title={item.title}
                              >
                                {item.title}
                              </h4>
                            </div>
                            <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5 truncate">
                              <User className="w-3 h-3 inline flex-shrink-0" />
                              <span>{item.channel || 'YouTube'}</span>
                            </p>
                          </div>

                          {/* Actions: Preview & Download */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Preview button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleTogglePreview({
                                  id: item.id,
                                  title: item.title,
                                  channel: item.channel,
                                  url: item.url,
                                  duration_str: item.duration_str,
                                  is_live: item.is_live,
                                  is_too_long: item.is_too_long,
                                })
                              }
                              className={`flex items-center gap-1 font-bold text-xs sm:text-sm py-2 px-2.5 sm:px-3 rounded-xl transition ${
                                previewTrack?.id === item.id
                                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 ring-2 ring-rose-400'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                              title={previewTrack?.id === item.id ? 'หยุดเล่นตัวอย่าง' : 'กดฟังตัวอย่างเพลงนี้'}
                            >
                              {previewTrack?.id === item.id ? (
                                <>
                                  <Square className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                                  <span className="hidden sm:inline">หยุด</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5 fill-slate-700 text-slate-700" />
                                  <span className="hidden sm:inline">ฟัง</span>
                                </>
                              )}
                            </button>

                            {/* Download button */}
                            <button
                              onClick={() => handleDownloadSingle(item.url, item.id, item.title)}
                              disabled={downloadingId !== null || isBlocked}
                              className={`flex items-center gap-1.5 font-bold text-xs sm:text-sm py-2 px-3 sm:px-4 rounded-xl transition flex-shrink-0 shadow-sm ${
                                isBlocked
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white'
                              }`}
                              title={
                                item.is_live
                                  ? 'ไม่รองรับวิดีโอถ่ายทอดสด'
                                  : item.is_too_long
                                  ? 'วิดีโอยาวเกิน 20 นาที รองรับเฉพาะเพลงความยาวปกติ'
                                  : 'กดดาวน์โหลดเพลงนี้'
                              }
                            >
                              {downloadingId === item.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                              <span>
                                {downloadingId === item.id
                                  ? 'กำลังดึง...'
                                  : item.is_live
                                  ? 'ไม่รองรับไลฟ์'
                                  : item.is_too_long
                                  ? 'เกิน 20 นาที'
                                  : 'ดึงเพลงนี้'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PASTE URL */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <form onSubmit={handleInspectUrl} className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="วางลิงก์ เช่น https://www.youtube.com/watch?v=... หรือ Playlist"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white text-base transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoadingUrl || !urlInput.trim()}
                  className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition flex items-center gap-2 flex-shrink-0"
                >
                  {isLoadingUrl ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  <span className="hidden sm:inline">ตรวจสอบลิงก์</span>
                </button>
              </form>

              {urlError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{urlError}</span>
                </div>
              )}

              {/* Single Video Result */}
              {urlInfo && urlInfo.type === 'video' && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <img
                      src={urlInfo.thumbnail}
                      alt={urlInfo.title}
                      className="w-24 h-16 rounded-xl object-cover flex-shrink-0 bg-slate-200"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">
                          เพลงเดี่ยว
                        </span>
                        {urlInfo.is_live && (
                          <span className="text-xs bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded">
                            🔴 ไลฟ์สด
                          </span>
                        )}
                        {urlInfo.is_too_long && (
                          <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                            ⚠️ ยาวเกิน 20 นาที
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-800 text-base line-clamp-1 mt-1">
                        {urlInfo.title}
                      </h4>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {urlInfo.channel} • {urlInfo.duration_str}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto flex-shrink-0">
                    {/* Preview button for single video */}
                    {urlInfo.id && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!urlInfo.id) return;
                          handleTogglePreview({
                            id: urlInfo.id,
                            title: urlInfo.title,
                            channel: urlInfo.channel,
                            url: urlInfo.url || urlInput,
                            duration_str: urlInfo.duration_str,
                            is_live: urlInfo.is_live,
                            is_too_long: urlInfo.is_too_long,
                          });
                        }}
                        className={`w-full sm:w-auto flex items-center justify-center gap-2 font-bold text-sm py-3 px-4 rounded-xl transition border ${
                          previewTrack?.id === urlInfo.id
                            ? 'bg-rose-100 text-rose-700 border-rose-300 ring-2 ring-rose-400'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title={previewTrack?.id === urlInfo.id ? 'หยุดเล่นตัวอย่าง' : 'ฟังตัวอย่างเพลงนี้'}
                      >
                        {previewTrack?.id === urlInfo.id ? (
                          <>
                            <Square className="w-4 h-4 fill-rose-600 text-rose-600" />
                            <span>หยุดฟัง</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-slate-700 text-slate-700" />
                            <span>ฟังตัวอย่าง</span>
                          </>
                        )}
                      </button>
                    )}

                    {urlInfo.is_live ? (
                      <span className="text-rose-600 text-xs font-semibold bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                        ไม่รองรับการดาวน์โหลดวิดีโอถ่ายทอดสด
                      </span>
                    ) : urlInfo.is_too_long ? (
                      <span className="text-amber-800 text-xs font-semibold bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                        วิดีโอยาวเกิน 20 นาที (รองรับเฉพาะเพลงสั้น)
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          handleDownloadSingle(urlInfo.url || urlInput, urlInfo.id || 'single', urlInfo.title)
                        }
                        disabled={downloadingId !== null}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition shadow-md flex-shrink-0"
                      >
                        {downloadingId === urlInfo.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                        <span>ดาวน์โหลดเพลงนี้</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Playlist Result */}
              {urlInfo && urlInfo.type === 'playlist' && urlInfo.items && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <ListMusic className="w-5 h-5 text-red-600" />
                      <div>
                        <h4 className="font-bold text-red-950 text-base">{urlInfo.title}</h4>
                        <p className="text-red-700 text-xs">
                          พบทั้งหมด {urlInfo.items.length} เพลง (เลือกไว้ {selectedPlaylistIds.length} เพลง)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleSelectAllPlaylist}
                        className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition"
                      >
                        {selectedPlaylistIds.length > 0 ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                      </button>
                      <button
                        onClick={handleDownloadPlaylistSelected}
                        disabled={downloadingId !== null || selectedPlaylistIds.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow"
                      >
                        <Download className="w-4 h-4" />
                        <span>ดาวน์โหลด ({selectedPlaylistIds.length} เพลง)</span>
                      </button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {urlInfo.items.map((item) => {
                      const isBlocked = item.is_live || item.is_too_long;
                      const isChecked = selectedPlaylistIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => togglePlaylistItem(item.id, isBlocked)}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                            isBlocked
                              ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                              : isChecked
                              ? 'bg-emerald-50/70 border-emerald-300 cursor-pointer'
                              : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className="text-emerald-700 flex-shrink-0">
                            {isBlocked ? (
                              <Square className="w-5 h-5 text-slate-300" />
                            ) : isChecked ? (
                              <CheckSquare className="w-5 h-5 fill-emerald-100" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-12 h-9 object-cover rounded bg-slate-200 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 text-sm truncate">
                              {item.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePreview({
                                  id: item.id,
                                  title: item.title,
                                  url: item.url,
                                  duration_str: item.duration_str,
                                  is_live: item.is_live,
                                  is_too_long: item.is_too_long,
                                });
                              }}
                              className={`p-1.5 rounded-lg transition ${
                                previewTrack?.id === item.id
                                  ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-400'
                                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                              }`}
                              title={previewTrack?.id === item.id ? 'หยุดฟัง' : 'ฟังตัวอย่าง'}
                            >
                              {previewTrack?.id === item.id ? (
                                <Square className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>
                            {item.is_too_long && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                                เกิน 20 นาที
                              </span>
                            )}
                            <span className="text-xs font-mono text-slate-400">
                              {item.duration_str}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Preview Player Bar (Active when user clicks to listen) */}
        {previewTrack && (
          <div className="bg-slate-900 text-white px-4 py-3 border-t border-slate-700 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
              <div className="relative w-28 sm:w-36 h-16 sm:h-20 bg-black rounded-lg overflow-hidden flex-shrink-0 shadow-md">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${previewTrack.id}?autoplay=1&playsinline=1`}
                  title={`YouTube preview: ${previewTrack.title}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold mb-0.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>กำลังฟังตัวอย่าง</span>
                  {previewTrack.duration_str && (
                    <span className="text-slate-400 font-mono text-[11px]">({previewTrack.duration_str})</span>
                  )}
                </div>
                <p className="font-bold text-sm sm:text-base text-white truncate" title={previewTrack.title}>
                  {previewTrack.title}
                </p>
                {previewTrack.channel && (
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {previewTrack.channel}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setPreviewTrack(null)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                title="หยุดเล่นและปิดตัวอย่าง"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>ปิดตัวอย่าง</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadSingle(previewTrack.url, previewTrack.id, previewTrack.title)}
                disabled={downloadingId !== null || previewTrack.is_live || previewTrack.is_too_long}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow ${
                  previewTrack.is_live || previewTrack.is_too_long
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white'
                }`}
              >
                {downloadingId === previewTrack.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {previewTrack.is_live
                    ? 'ไม่รองรับไลฟ์'
                    : previewTrack.is_too_long
                    ? 'เกิน 20 นาที'
                    : 'โหลดเพลงนี้'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>
            💡 เพลงที่ดาวน์โหลดจะถูกส่งเข้าเพลย์ลิสต์ทันที สามารถกดฟังตัวอย่างและตัดท่อนที่ไม่ต้องการได้
          </span>
          <button
            onClick={() => {
              setPreviewTrack(null);
              onClose();
            }}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 rounded-xl transition text-sm"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
