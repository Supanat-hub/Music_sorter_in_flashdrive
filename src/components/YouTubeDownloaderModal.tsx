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
  Flame,
  Zap,
  Disc3,
  Music,
  Headphones,
  Sparkles,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { YouTubeIcon } from './YouTubeIcon';
import { YouTubeSearchResult, YouTubeUrlInfo, CuratedPack } from '../types/audio';
import {
  searchAudio,
  getAudioUrlInfo,
  downloadAudioTrack,
  getCuratedPacks,
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
  source?: 'youtube' | 'soundcloud';
}

export const YouTubeDownloaderModal: React.FC<YouTubeDownloaderModalProps> = ({
  isOpen,
  onClose,
  onTrackDownloaded,
}) => {
  // Tabs: 'remix' (SoundCloud/NCS - 100% free), 'packs' (Curated), 'youtube' (YouTube Search), 'url' (Paste Link)
  const [activeTab, setActiveTab] = useState<'remix' | 'packs' | 'youtube' | 'url'>('remix');

  // SoundCloud / Remix Search State
  const [remixQuery, setRemixQuery] = useState<string>('');
  const [isSearchingRemix, setIsSearchingRemix] = useState<boolean>(false);
  const [remixResults, setRemixResults] = useState<YouTubeSearchResult[]>([]);
  const [remixError, setRemixError] = useState<string | null>(null);

  // YouTube Search State
  const [ytQuery, setYtQuery] = useState<string>('');
  const [isSearchingYt, setIsSearchingYt] = useState<boolean>(false);
  const [ytResults, setYtResults] = useState<YouTubeSearchResult[]>([]);
  const [ytError, setYtError] = useState<string | null>(null);

  // Curated Packs State
  const [curatedPacks, setCuratedPacks] = useState<CuratedPack[]>([]);
  const [activePack, setActivePack] = useState<CuratedPack | null>(null);
  const [isLoadingPack, setIsLoadingPack] = useState<boolean>(false);
  const [packResults, setPackResults] = useState<YouTubeSearchResult[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);

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
  const [failedUrlForExternal, setFailedUrlForExternal] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Preview State
  const [previewTrack, setPreviewTrack] = useState<PreviewTrack | null>(null);

  // Backend Connection Mode State (Local vs Cloud)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'local' | 'cloud'>('checking');

  // Auto-detect best backend & fetch curated packs on modal open
  useEffect(() => {
    if (isOpen) {
      detectBestBackendUrl().then((url) => {
        const local = url.includes('localhost') || url.includes('127.0.0.1');
        setBackendStatus(local ? 'local' : 'cloud');
      });

      getCuratedPacks().then((packs) => {
        setCuratedPacks(packs);
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

  // Search Remix / SoundCloud (100% Free, Cloud-friendly)
  const handleSearchRemix = async (customQuery?: string) => {
    const q = customQuery || remixQuery;
    if (!q.trim()) return;

    setIsSearchingRemix(true);
    setRemixError(null);
    try {
      const results = await searchAudio(q.trim(), 'soundcloud', 15);
      setRemixResults(results);
      if (results.length === 0) {
        setRemixError('ไม่พบเพลงรีมิกซ์ที่ตรงกับคำค้นหา กรุณาลองคำค้นอื่น เช่น "สายย่อ", "รถแห่", "แดนซ์ มันส์ๆ"');
      }
    } catch (err: any) {
      setRemixError(err.message || 'การค้นหาขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSearchingRemix(false);
    }
  };

  // Search YouTube
  const handleSearchYouTube = async (customQuery?: string) => {
    const q = customQuery || ytQuery;
    if (!q.trim()) return;

    setIsSearchingYt(true);
    setYtError(null);
    try {
      const results = await searchAudio(q.trim(), 'youtube', 12);
      setYtResults(results);
      if (results.length === 0) {
        setYtError('ไม่พบเพลงบน YouTube กรุณาลองคำค้นอื่น');
      }
    } catch (err: any) {
      setYtError(err.message || 'การค้นหาบน YouTube ขัดข้องชั่วคราว');
    } finally {
      setIsSearchingYt(false);
    }
  };

  // Select Curated Pack
  const handleSelectPack = async (pack: CuratedPack) => {
    setActivePack(pack);
    setIsLoadingPack(true);
    setPackResults([]);
    try {
      const results = await searchAudio(pack.query, 'soundcloud', 15);
      setPackResults(results);
      setSelectedPackIds(results.filter((r) => !r.is_too_long).map((r) => r.id));
    } catch (err: any) {
      console.error('Error fetching pack tracks:', err);
    } finally {
      setIsLoadingPack(false);
    }
  };

  // Inspect URL (SoundCloud or YouTube)
  const handleInspectUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    setIsLoadingUrl(true);
    setUrlError(null);
    setUrlInfo(null);
    try {
      const info = await getAudioUrlInfo(urlInput.trim());
      setUrlInfo(info);
      if (info.type === 'playlist' && info.items) {
        setSelectedPlaylistIds(
          info.items.filter((i) => !i.is_live && !i.is_too_long).map((i) => i.id)
        );
      }
    } catch (err: any) {
      setUrlError(err.message || 'ไม่สามารถเปิดข้อมูลลิงก์นี้ได้ กรุณาตรวจสอบว่าเป็นลิงก์ SoundCloud หรือ YouTube ที่ถูกต้อง');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Download single track
  const handleDownloadSingle = async (url: string, id: string, titleHint?: string) => {
    setDownloadingId(id);
    setDownloadProgressText(`กำลังดาวน์โหลดและแปลงเสียง "${titleHint || 'เพลง'}" สำหรับลำโพง...`);
    setDownloadError(null);
    setFailedUrlForExternal(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { file, title } = await downloadAudioTrack(url, controller.signal);
      onTrackDownloaded(file);
      showSuccess(`ดาวน์โหลด "${title}" สำเร็จและเพิ่มเข้าเพลย์ลิสต์แล้ว!`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setDownloadError(err.message || 'ไม่สามารถดาวน์โหลดเพลงนี้ได้');
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          setFailedUrlForExternal(url);
        }
      }
    } finally {
      setDownloadingId(null);
      setDownloadProgressText('');
      abortControllerRef.current = null;
    }
  };

  // Download batch pack
  const handleDownloadPackSelected = async () => {
    if (packResults.length === 0) return;
    const toDownload = packResults.filter((item) => selectedPackIds.includes(item.id));
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
        const { file } = await downloadAudioTrack(item.url, controller.signal);
        onTrackDownloaded(file);
        successCount++;
      } catch (err: any) {
        if (err.name === 'AbortError') break;
        console.warn(`Failed to download ${item.title}:`, err);
      }
    }

    setDownloadingId(null);
    setDownloadProgressText('');
    abortControllerRef.current = null;
    showSuccess(`ดาวน์โหลดสำเร็จ ${successCount}/${toDownload.length} เพลง และเพิ่มเข้าเพลย์ลิสต์แล้ว!`);
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
        const { file } = await downloadAudioTrack(item.url, controller.signal);
        onTrackDownloaded(file);
        successCount++;
      } catch (err: any) {
        if (err.name === 'AbortError') break;
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

  const togglePackItem = (id: string, isBlocked?: boolean) => {
    if (isBlocked) return;
    setSelectedPackIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPack = () => {
    const available = packResults.filter((r) => !r.is_too_long);
    if (selectedPackIds.length === available.length) {
      setSelectedPackIds([]);
    } else {
      setSelectedPackIds(available.map((r) => r.id));
    }
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

  const getPackIcon = (id: string) => {
    switch (id) {
      case 'aerobic-dance':
        return <Flame className="w-6 h-6 text-amber-500" />;
      case 'sai-yow-remix':
        return <Zap className="w-6 h-6 text-violet-500" />;
      case 'ncs-edm':
        return <Disc3 className="w-6 h-6 text-cyan-500" />;
      case 'country-dance-3cha':
        return <Music className="w-6 h-6 text-emerald-500" />;
      default:
        return <Headphones className="w-6 h-6 text-sky-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogoClick}
              type="button"
              className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md focus:outline-none transition active:scale-95"
              title="Online Music Hub"
            >
              <Music className="w-7 h-7 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                  <span>ดาวน์โหลดเพลงออนไลน์</span>
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/30 text-emerald-100 border border-emerald-300/40">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  ฟรี 100% ไม่ติดบล็อก
                </span>
                {backendStatus === 'local' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                    เน็ตในเครื่อง (เร็วเต็มสปีด)
                  </span>
                )}
              </div>
              <p className="text-white/90 text-xs sm:text-sm mt-0.5">
                เลือกเพลงรีมิกซ์ แดนซ์แอโรบิก หรือใส่ลิงก์ แปลงเป็น MP3 ลงแฟลชไดร์ฟทันที
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

        {/* 4 Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-2 sm:px-4 pt-2 gap-1 sm:gap-2 text-xs sm:text-sm font-semibold overflow-x-auto">
          {/* Tab 1: Remix & Dance (Default, 100% reliable on Cloud) */}
          <button
            onClick={() => setActiveTab('remix')}
            className={`flex items-center gap-1.5 sm:gap-2 py-2.5 px-3 sm:px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'remix'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>เพลงรีมิกซ์ & แดนซ์</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
              เร็วสุด
            </span>
          </button>

          {/* Tab 2: Curated Packs */}
          <button
            onClick={() => setActiveTab('packs')}
            className={`flex items-center gap-1.5 sm:gap-2 py-2.5 px-3 sm:px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'packs'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Disc3 className="w-4 h-4 text-violet-500" />
            <span>คลังเซ็ตเพลงฮิต</span>
          </button>

          {/* Tab 3: YouTube */}
          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex items-center gap-1.5 sm:gap-2 py-2.5 px-3 sm:px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'youtube'
                ? 'border-red-600 text-red-600 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <YouTubeIcon className="w-4 h-4" />
            <span>YouTube</span>
          </button>

          {/* Tab 4: Paste URL */}
          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-1.5 sm:gap-2 py-2.5 px-3 sm:px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'url'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LinkIcon className="w-4 h-4 text-sky-600" />
            <span>วางลิงก์เพลง</span>
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
                    กำลังแปลงเป็น MP3 192kbps คุณภาพเสียงคมชัดสำหรับเปิดกับลำโพง...
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

          {/* Download Error Banner */}
          {downloadError && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm sm:text-base">ไม่สามารถดาวน์โหลดเพลงนี้ได้</p>
                <p className="text-xs sm:text-sm text-rose-700 mt-0.5">{downloadError}</p>

                {failedUrlForExternal && (
                  <div className="mt-3 pt-3 border-t border-rose-200 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(failedUrlForExternal);
                        window.open(`https://cobalt.tools/`, '_blank');
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิดเว็บแปลง MP3 ฟรี (Cobalt) & คัดลอกลิงก์</span>
                    </button>
                    <span className="text-[11px] text-slate-500">
                      (กดยืนยันแล้วลากไฟล์ MP3 ที่ได้กลับมาใส่เว็บนี้ได้เลย)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: REMIX & DANCE (SoundCloud / NCS - 100% Free & Fast) */}
          {/* ========================================================= */}
          {activeTab === 'remix' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 p-3 sm:p-4 rounded-2xl border border-emerald-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="bg-emerald-600 text-white p-2 rounded-xl">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                      เพลงแดนซ์ & รีมิกซ์สายย่อ ไม่ติดลิขสิทธิ์
                    </h3>
                    <p className="text-slate-500 text-xs">
                      ดึงตรงจาก SoundCloud / NCS โหลดได้ 100% ทันที ไม่ติดบล็อกเหมือน YouTube
                    </p>
                  </div>
                </div>
              </div>

              {/* Search input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchRemix();
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={remixQuery}
                    onChange={(e) => setRemixQuery(e.target.value)}
                    placeholder="พิมพ์ชื่อเพลง เช่น สายย่อ, รถแห่, เพลงเต้นแอโรบิก, NCS..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-base transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingRemix || !remixQuery.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition flex items-center gap-2 flex-shrink-0"
                >
                  {isSearchingRemix ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  <span className="hidden sm:inline">ค้นหา</span>
                </button>
              </form>

              {/* Quick Tags */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-xs text-slate-400 font-medium">แท็กยอดนิยม:</span>
                {[
                  'เพลงเต้นแอโรบิก มันส์ๆ',
                  'สายย่อ รถแห่ remix',
                  '3 ช่า มันส์ๆ โจ๊ะๆ',
                  'NCS EDM remix',
                  'เพลงแดนซ์ TikTok 2026',
                  'เบสแน่นๆ ลำโพงลั่น',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setRemixQuery(tag);
                      handleSearchRemix(tag);
                    }}
                    className="bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 border border-slate-200 text-xs font-semibold px-2.5 py-1 rounded-full transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {remixError && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
                  {remixError}
                </div>
              )}

              {/* Empty state hint */}
              {remixResults.length === 0 && !isSearchingRemix && !remixError && (
                <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Disc3 className="w-12 h-12 text-emerald-400 mx-auto mb-3 animate-spin-slow" />
                  <p className="text-slate-700 font-bold text-base mb-1">
                    ค้นหาเพลงรีมิกซ์ฟรีสำหรับเปิดกับลำโพง
                  </p>
                  <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto">
                    กดแท็กยอดนิยมด้านบน หรือพิมพ์ค้นหาเพลงที่ต้องการ ระบบจะแปลงเป็นไฟล์ MP3 นำไปเปิดในแฟลชไดร์ฟได้ทันที
                  </p>
                </div>
              )}

              {/* Remix Results List */}
              {remixResults.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span className="uppercase tracking-wider">ผลลัพธ์ ({remixResults.length} เพลง)</span>
                    <span className="text-emerald-600">⚡ โหลดตรงได้ 100% ทุกเพลง</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {remixResults.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
                      >
                        <div className="relative w-16 sm:w-20 h-14 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={item.thumbnail || 'https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico'}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute bottom-1 right-1 bg-black/80 text-white font-mono text-[10px] px-1 rounded">
                            {item.duration_str}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-800 text-sm sm:text-base line-clamp-1" title={item.title}>
                            {item.title}
                          </h4>
                          <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5 truncate">
                            <User className="w-3 h-3 inline flex-shrink-0" />
                            <span>{item.channel || 'SoundCloud DJ'}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleTogglePreview({
                                id: item.id,
                                title: item.title,
                                channel: item.channel,
                                url: item.url,
                                duration_str: item.duration_str,
                                source: 'soundcloud',
                              })
                            }
                            className={`flex items-center gap-1 font-bold text-xs sm:text-sm py-2 px-2.5 sm:px-3 rounded-xl transition ${
                              previewTrack?.id === item.id
                                ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {previewTrack?.id === item.id ? (
                              <>
                                <Square className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                                <span className="hidden sm:inline">หยุด</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-slate-700 text-slate-700" />
                                <span className="hidden sm:inline">ฟัง</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleDownloadSingle(item.url, item.id, item.title)}
                            disabled={downloadingId !== null}
                            className="flex items-center gap-1.5 font-bold text-xs sm:text-sm py-2 px-3 sm:px-4 rounded-xl transition flex-shrink-0 shadow-sm bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white"
                          >
                            {downloadingId === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            <span>{downloadingId === item.id ? 'กำลังดึง...' : 'โหลดเพลงนี้'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: CURATED PACKS (Pre-made remix collections) */}
          {/* ========================================================= */}
          {activeTab === 'packs' && (
            <div className="space-y-4">
              {!activePack ? (
                <div>
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-800">
                      📦 รวมเซ็ตเพลงฮิตสำหรับใส่แฟลชไดร์ฟ
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500">
                      กดเลือกชุดเพลงที่ต้องการ เพื่อดูรายการและดาวน์โหลดเข้าแฟลชไดร์ฟได้ใน 1 คลิก
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {curatedPacks.map((pack) => (
                      <div
                        key={pack.id}
                        onClick={() => handleSelectPack(pack)}
                        className="bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md rounded-2xl p-4 cursor-pointer transition flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="p-2.5 rounded-xl bg-slate-50 group-hover:bg-emerald-50 transition">
                              {getPackIcon(pack.id)}
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              {pack.badge}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-800 text-base group-hover:text-emerald-700 transition">
                            {pack.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {pack.description}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-600 font-semibold">
                          <span>เปิดดูรายการเพลงในเซ็ต</span>
                          <span className="group-hover:translate-x-1 transition">→</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Selected Pack View */
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setActivePack(null)}
                        className="p-1.5 bg-white text-slate-700 hover:text-emerald-700 rounded-lg border border-slate-200 transition"
                        title="กลับไปเลือกเซ็ตอื่น"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-emerald-950 text-base">{activePack.title}</h4>
                          <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                            {activePack.badge}
                          </span>
                        </div>
                        <p className="text-emerald-800 text-xs">
                          {isLoadingPack
                            ? 'กำลังค้นหาเพลงในเซ็ตนี้...'
                            : `พบ ${packResults.length} เพลง (เลือกไว้ ${selectedPackIds.length} เพลง)`}
                        </p>
                      </div>
                    </div>

                    {!isLoadingPack && packResults.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleSelectAllPack}
                          className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition"
                        >
                          {selectedPackIds.length === packResults.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                        </button>
                        <button
                          onClick={handleDownloadPackSelected}
                          disabled={downloadingId !== null || selectedPackIds.length === 0}
                          className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow"
                        >
                          <Download className="w-4 h-4" />
                          <span>โหลด ({selectedPackIds.length} เพลง)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {isLoadingPack && (
                    <div className="text-center py-12">
                      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-600">กำลังเตรียมรายการเพลงสำหรับเซ็ตนี้...</p>
                    </div>
                  )}

                  {!isLoadingPack && (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {packResults.map((item) => {
                        const isChecked = selectedPackIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => togglePackItem(item.id)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition cursor-pointer ${
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
                              src={item.thumbnail || 'https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico'}
                              alt={item.title}
                              className="w-12 h-9 object-cover rounded bg-slate-200 flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-800 text-sm truncate">{item.title}</p>
                              <p className="text-slate-400 text-xs truncate">{item.channel}</p>
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
                                    source: 'soundcloud',
                                  });
                                }}
                                className={`p-1.5 rounded-lg transition ${
                                  previewTrack?.id === item.id
                                    ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                                }`}
                                title={previewTrack?.id === item.id ? 'หยุดฟัง' : 'ฟังตัวอย่าง'}
                              >
                                {previewTrack?.id === item.id ? (
                                  <Square className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                )}
                              </button>
                              <span className="text-xs font-mono text-slate-400">{item.duration_str}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: YOUTUBE SEARCH */}
          {/* ========================================================= */}
          {activeTab === 'youtube' && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchYouTube();
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ytQuery}
                    onChange={(e) => setYtQuery(e.target.value)}
                    placeholder="ค้นหาเพลง, ศิลปิน บน YouTube..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white text-base transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingYt || !ytQuery.trim()}
                  className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition flex items-center gap-2 flex-shrink-0"
                >
                  {isSearchingYt ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  <span className="hidden sm:inline">ค้นหา</span>
                </button>
              </form>

              {/* Suggestions */}
              {ytResults.length === 0 && !isSearchingYt && !ytError && (
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
                          setYtQuery(tag);
                          handleSearchYouTube(tag);
                        }}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium px-3 py-1.5 rounded-full transition"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ytError && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
                  {ytError}
                </div>
              )}

              {/* YouTube Results List */}
              {ytResults.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span className="uppercase tracking-wider">ผลลัพธ์ ({ytResults.length} เพลง)</span>
                    <span className="text-slate-400">รองรับความยาวไม่เกิน 20 นาที</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {ytResults.map((item) => {
                      const isBlocked = item.is_live || item.is_too_long;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border transition ${
                            isBlocked ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
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
                              <h4 className="font-bold text-slate-800 text-sm sm:text-base line-clamp-1" title={item.title}>
                                {item.title}
                              </h4>
                            </div>
                            <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5 truncate">
                              <User className="w-3 h-3 inline flex-shrink-0" />
                              <span>{item.channel || 'YouTube'}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
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
                                  source: 'youtube',
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

                            <button
                              onClick={() => handleDownloadSingle(item.url, item.id, item.title)}
                              disabled={downloadingId !== null || isBlocked}
                              className={`flex items-center gap-1.5 font-bold text-xs sm:text-sm py-2 px-3 sm:px-4 rounded-xl transition flex-shrink-0 shadow-sm ${
                                isBlocked
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white'
                              }`}
                            >
                              {downloadingId === item.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                              <span>
                                {downloadingId === item.id
                                  ? 'กำลังดึง...'
                                  : isBlocked
                                  ? 'ไม่รองรับ'
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

          {/* ========================================================= */}
          {/* TAB 4: PASTE URL (SoundCloud / YouTube) */}
          {/* ========================================================= */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <form onSubmit={handleInspectUrl} className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="วางลิงก์ เช่น https://soundcloud.com/... หรือ https://www.youtube.com/watch?v=..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-base transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoadingUrl || !urlInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition flex items-center gap-2 flex-shrink-0"
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

              {/* Single Track Result */}
              {urlInfo && urlInfo.type === 'video' && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <img
                      src={urlInfo.thumbnail || 'https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico'}
                      alt={urlInfo.title}
                      className="w-24 h-16 rounded-xl object-cover flex-shrink-0 bg-slate-200"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          {urlInfo.source === 'soundcloud' ? 'SoundCloud' : 'YouTube'}
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
                    <button
                      type="button"
                      onClick={() => {
                        handleTogglePreview({
                          id: urlInfo.id || 'single',
                          title: urlInfo.title,
                          channel: urlInfo.channel,
                          url: urlInfo.url || urlInput,
                          duration_str: urlInfo.duration_str,
                          is_live: urlInfo.is_live,
                          is_too_long: urlInfo.is_too_long,
                          source: urlInfo.source || 'youtube',
                        });
                      }}
                      className={`w-full sm:w-auto flex items-center justify-center gap-2 font-bold text-sm py-3 px-4 rounded-xl transition border ${
                        previewTrack?.id === (urlInfo.id || 'single')
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {previewTrack?.id === (urlInfo.id || 'single') ? (
                        <>
                          <Square className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                          <span>หยุดฟัง</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-slate-700 text-slate-700" />
                          <span>ฟังตัวอย่าง</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() =>
                        handleDownloadSingle(urlInfo.url || urlInput, urlInfo.id || 'single', urlInfo.title)
                      }
                      disabled={downloadingId !== null || urlInfo.is_live || urlInfo.is_too_long}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition shadow-md flex-shrink-0"
                    >
                      {downloadingId === (urlInfo.id || 'single') ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                      <span>ดาวน์โหลดเพลงนี้</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Playlist Result */}
              {urlInfo && urlInfo.type === 'playlist' && urlInfo.items && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <ListMusic className="w-5 h-5 text-emerald-600" />
                      <div>
                        <h4 className="font-bold text-emerald-950 text-base">{urlInfo.title}</h4>
                        <p className="text-emerald-700 text-xs">
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
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 fill-emerald-100" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <img
                            src={item.thumbnail || 'https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico'}
                            alt={item.title}
                            className="w-12 h-9 object-cover rounded bg-slate-200 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 text-sm truncate">{item.title}</p>
                          </div>
                          <span className="text-xs font-mono text-slate-400">{item.duration_str}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Preview Player Bar */}
        {previewTrack && (
          <div className="bg-slate-900 text-white px-4 py-3 border-t border-slate-700 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
              <div className="relative w-28 sm:w-36 h-16 sm:h-20 bg-black rounded-lg overflow-hidden flex-shrink-0 shadow-md">
                {previewTrack.source === 'soundcloud' || previewTrack.url.includes('soundcloud.com') ? (
                  <iframe
                    src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(previewTrack.url)}&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`}
                    title={`SoundCloud preview: ${previewTrack.title}`}
                    allow="autoplay"
                    className="w-full h-full border-0 rounded-lg"
                  />
                ) : (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${previewTrack.id}?autoplay=1&playsinline=1`}
                    title={`YouTube preview: ${previewTrack.title}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-0.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
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
                <span>โหลดเพลงนี้</span>
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
