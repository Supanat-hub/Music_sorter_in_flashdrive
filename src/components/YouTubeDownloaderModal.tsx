import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Link as LinkIcon,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Settings,
  RefreshCw,
  User,
  ListMusic,
  CheckSquare,
  Square,
  ExternalLink,
} from 'lucide-react';
import { YouTubeIcon } from './YouTubeIcon';
import { YouTubeSearchResult, YouTubeUrlInfo } from '../types/audio';
import {
  searchYouTube,
  getYouTubeUrlInfo,
  downloadYouTubeTrack,
  getBackendUrl,
  setBackendUrl,
  checkBackendHealth,
  resetBackendUrl,
} from '../utils/youtubeApi';

interface YouTubeDownloaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackDownloaded: (file: File) => void;
}

export const YouTubeDownloaderModal: React.FC<YouTubeDownloaderModalProps> = ({
  isOpen,
  onClose,
  onTrackDownloaded,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'url' | 'settings'>('search');

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

  // Settings State
  const [customBackendUrl, setCustomBackendUrl] = useState<string>(getBackendUrl());
  const [serverStatus, setServerStatus] = useState<{
    tested: boolean;
    ok: boolean;
    message: string;
  }>({ tested: false, ok: false, message: '' });
  const [isTestingServer, setIsTestingServer] = useState<boolean>(false);

  // Test server connection once when opened
  useEffect(() => {
    if (isOpen) {
      checkServerHealth();
    }
  }, [isOpen]);

  const checkServerHealth = async (urlToCheck?: string) => {
    setIsTestingServer(true);
    const result = await checkBackendHealth(urlToCheck);
    setServerStatus({
      tested: true,
      ok: result.ok,
      message: result.ok
        ? `เชื่อมต่อเซิร์ฟเวอร์สำเร็จ (${result.statusText})`
        : `ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ${result.statusText}`,
    });
    setIsTestingServer(false);
  };

  const handleSaveSettings = () => {
    setBackendUrl(customBackendUrl);
    checkServerHealth(customBackendUrl);
  };

  const handleResetSettings = () => {
    resetBackendUrl();
    const def = getBackendUrl();
    setCustomBackendUrl(def);
    checkServerHealth(def);
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
      setSearchError(err.message || 'เกิดข้อผิดพลาดในการค้นหา');
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
        setSelectedPlaylistIds(info.items.map((i) => i.id));
      }
    } catch (err: any) {
      setUrlError(err.message || 'ไม่สามารถดึงข้อมูลลิงก์นี้ได้ ตรวจสอบว่าลิงก์ถูกต้องและเป็นสาธารณะ');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Download single track
  const handleDownloadSingle = async (url: string, id: string, titleHint?: string) => {
    setDownloadingId(id);
    setDownloadProgressText(`กำลังดึงและแปลงไฟล์ "${titleHint || 'เพลง'}" เป็น MP3 (192kbps)...`);
    setDownloadError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { file, title } = await downloadYouTubeTrack(url, controller.signal);
      onTrackDownloaded(file);
      showSuccess(`ดาวน์โหลด "${title}" สำเร็จและเพิ่มเข้าเพลย์ลิสต์แล้ว!`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setDownloadError(err.message || 'เกิดข้อผิดพลาดในการดาวน์โหลดเพลง');
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

  const togglePlaylistItem = (id: string) => {
    setSelectedPlaylistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPlaylist = () => {
    if (!urlInfo || !urlInfo.items) return;
    if (selectedPlaylistIds.length === urlInfo.items.length) {
      setSelectedPlaylistIds([]);
    } else {
      setSelectedPlaylistIds(urlInfo.items.map((i) => i.id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-emerald-700 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
              <YouTubeIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <span>ดาวน์โหลดเพลงจาก YouTube</span>
                <span className="text-xs bg-white/20 text-white font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  MP3 192k
                </span>
              </h2>
              <p className="text-white/80 text-xs sm:text-sm">
                ค้นหาหรือวางลิงก์เพื่อดึงไฟล์เสียง MP3 เข้าเพลย์ลิสต์โดยตรง
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
            title="ปิดหน้าต่าง"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Tabs */}
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

          <button
            onClick={() => setActiveTab('settings')}
            className={`ml-auto flex items-center gap-1.5 py-2.5 px-3 border-b-2 transition text-xs sm:text-sm ${
              activeTab === 'settings'
                ? 'border-slate-700 text-slate-800 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>การเชื่อมต่อ Server</span>
            <span
              className={`w-2 h-2 rounded-full ${
                serverStatus.ok ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
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
                    กำลังดึงเสียงและแปลงเป็น MP3 192kbps เพื่อให้เปิดบนลำโพงได้ทันที...
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

          {/* General Download Error */}
          {downloadError && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm sm:text-base">เกิดข้อผิดพลาดในการดาวน์โหลด</p>
                <p className="text-xs sm:text-sm text-rose-700">{downloadError}</p>
                <p className="text-xs text-rose-600 mt-1">
                  💡 หากพบปัญหา กรุณาตรวจสอบสถานะเซิร์ฟเวอร์ในแท็บ "การเชื่อมต่อ Server"
                </p>
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
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    ผลลัพธ์การค้นหา ({searchResults.length} เพลง)
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2.5 sm:p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition"
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
                          <h4
                            className="font-bold text-slate-800 text-sm sm:text-base line-clamp-1"
                            title={item.title}
                          >
                            {item.title}
                          </h4>
                          <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5 truncate">
                            <User className="w-3 h-3 inline" />
                            <span>{item.channel || 'YouTube'}</span>
                          </p>
                        </div>

                        {/* Download button */}
                        <button
                          onClick={() => handleDownloadSingle(item.url, item.id, item.title)}
                          disabled={downloadingId !== null}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm py-2 px-3 sm:px-4 rounded-xl transition flex-shrink-0 shadow-sm"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span>
                            {downloadingId === item.id ? 'กำลังดึง...' : 'ดึงเพลงนี้'}
                          </span>
                        </button>
                      </div>
                    ))}
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
                      <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">
                        เพลงเดี่ยว
                      </span>
                      <h4 className="font-bold text-slate-800 text-base line-clamp-1 mt-1">
                        {urlInfo.title}
                      </h4>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {urlInfo.channel} • {urlInfo.duration_str}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      handleDownloadSingle(urlInfo.url || urlInput, urlInfo.id || 'single', urlInfo.title)
                    }
                    disabled={downloadingId !== null}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition shadow-md"
                  >
                    {downloadingId === urlInfo.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    <span>ดาวน์โหลดเพลงนี้ (MP3 192k)</span>
                  </button>
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
                        {selectedPlaylistIds.length === urlInfo.items.length
                          ? 'ยกเลิกทั้งหมด'
                          : 'เลือกทั้งหมด'}
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
                      const isChecked = selectedPlaylistIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => togglePlaylistItem(item.id)}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                            isChecked
                              ? 'bg-emerald-50/70 border-emerald-300'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="text-emerald-700 flex-shrink-0">
                            {isChecked ? (
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
                          <span className="text-xs font-mono text-slate-400">
                            {item.duration_str}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-600" />
                  <span>การตั้งค่าเชื่อมต่อ Hugging Face Spaces Backend</span>
                </h4>
                <p className="text-slate-600 text-sm">
                  ระบบแปลงเสียงและดาวน์โหลดต้องเชื่อมต่อกับ Microservice (FastAPI + yt-dlp) ซึ่งรันอยู่บน Hugging Face Spaces ฟรี 100%
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Backend Service URL:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customBackendUrl}
                      onChange={(e) => setCustomBackendUrl(e.target.value)}
                      placeholder="https://your-space-name.hf.space"
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    <button
                      onClick={handleSaveSettings}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-lg text-sm transition"
                    >
                      บันทึก
                    </button>
                    <button
                      onClick={handleResetSettings}
                      className="text-slate-500 hover:text-slate-800 text-xs px-2 py-2"
                      title="คืนค่าเริ่มต้น"
                    >
                      คืนค่า
                    </button>
                  </div>
                </div>

                {/* Status Box */}
                <div
                  className={`p-3 rounded-lg border flex items-center justify-between text-sm ${
                    serverStatus.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {serverStatus.ok ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    )}
                    <span className="font-medium">
                      {isTestingServer
                        ? 'กำลังตรวจสอบการเชื่อมต่อ...'
                        : serverStatus.message || 'ยังไม่ได้ทดสอบ'}
                    </span>
                  </div>

                  <button
                    onClick={() => checkServerHealth(customBackendUrl)}
                    disabled={isTestingServer}
                    className="flex items-center gap-1 text-xs font-bold underline px-2 py-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingServer ? 'animate-spin' : ''}`} />
                    <span>ทดสอบใหม่</span>
                  </button>
                </div>
              </div>

              {/* Self-hosting Guide Box */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-950 text-sm space-y-3">
                <p className="font-bold flex items-center gap-1.5 text-emerald-900 text-base">
                  <ExternalLink className="w-4 h-4 text-emerald-700" />
                  <span>ตัวเลือกการเปิดใช้ Backend ฟรี 100%:</span>
                </p>

                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="bg-white/80 p-3 rounded-lg border border-emerald-200">
                    <p className="font-bold text-emerald-900 mb-1">
                      1. โฮสต์บน Render.com (ฟรี 100% ไม่ต้องใช้บัตรเครดิต):
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 text-slate-700">
                      <li>สมัครที่ <strong>render.com</strong> และเชื่อมต่อกับ GitHub</li>
                      <li>กด <strong>New +</strong> แล้วเลือก <strong>Web Service</strong></li>
                      <li>เลือก Repository นี้ ตั้งค่า <strong>Root Directory: backend</strong> และ Runtime: <strong>Docker</strong></li>
                      <li>เมื่อ Build เสร็จ จะได้ URL เช่น <code>https://xxx.onrender.com</code> นำมาวางที่ช่องด้านบน</li>
                    </ol>
                  </div>

                  <div className="bg-white/80 p-3 rounded-lg border border-emerald-200">
                    <p className="font-bold text-emerald-900 mb-1">
                      2. รันในเครื่องของตนเอง (Localhost - ไวที่สุด โหลดเพลงได้ทันที):
                    </p>
                    <p className="text-slate-700 font-mono text-xs bg-slate-100 p-1.5 rounded">
                      cd backend && pip install -r requirements.txt && python main.py
                    </p>
                    <p className="text-slate-600 mt-1">
                      แล้วกรอก URL เป็น: <code>http://localhost:7860</code>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>
            💡 เพลงที่ดาวน์โหลดจะถูกแปลงเป็น MP3 192kbps และส่งเข้าเพลย์ลิสต์ทันที
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 rounded-xl transition text-sm"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
