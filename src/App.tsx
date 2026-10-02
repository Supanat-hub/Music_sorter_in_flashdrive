import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { FolderPicker } from './components/FolderPicker';
import { TrackList } from './components/TrackList';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AudioTrimmerModal } from './components/AudioTrimmerModal';
import { SaveSection } from './components/SaveSection';
import { HelpModal } from './components/HelpModal';
import { BrowserWarningBanner } from './components/BrowserWarningBanner';
import { YouTubeDownloaderModal } from './components/YouTubeDownloaderModal';
import { Footer } from './components/Footer';
import { Track, ExportProgress } from './types/audio';
import {
  readAudioFilesFromDirectory,
  replaceDirectoryWithSortedTracks,
  exportTracksAsZip,
  isFileSystemAccessSupported,
} from './utils/fileSystem';

export const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDirectWriteSupported, setIsDirectWriteSupported] = useState<boolean>(() => isFileSystemAccessSupported());
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);

  // YouTube Downloader Modal State
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState<boolean>(false);

  // Audio Playback Preview State
  const [playingTrack, setPlayingTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Trimmer Modal State
  const [trimmingTrack, setTrimmingTrack] = useState<Track | null>(null);

  // Export Progress State
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    current: 0,
    total: 0,
    currentFileName: '',
    status: 'idle',
  });

  // Help Modal State
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPwa, setCanInstallPwa] = useState<boolean>(false);

  // Setup PWA install listener
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPwa(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstallPwa(false);
    }
    setDeferredPrompt(null);
  };

  // Setup HTML5 Audio element for preview playback
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Play / Pause preview handler
  const handleTogglePlay = (track: Track) => {
    if (!audioRef.current) return;

    if (playingTrack?.id === track.id) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      const sourceBlob = track.trimmedBlob || track.originalFile;
      const objectUrl = URL.createObjectURL(sourceBlob);
      audioRef.current.src = objectUrl;
      audioRef.current.play().then(() => {
        setPlayingTrack(track);
        setIsPlaying(true);
      });
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleStopAndClosePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setPlayingTrack(null);
  };

  // Open directory via File System Access API
  const handleSelectDirectory = async () => {
    try {
      setIsLoading(true);
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });

      const files = await readAudioFilesFromDirectory(handle);
      if (files.length === 0) {
        alert('ไม่พบไฟล์เพลง (.mp3, .wav) ในโฟลเดอร์ที่เลือก');
        setIsLoading(false);
        return;
      }

      const newTracks: Track[] = files.map((file, idx) => ({
        id: `track-${Date.now()}-${idx}`,
        name: file.name,
        originalFile: file,
        isTrimmed: false,
      }));

      setDirHandle(handle);
      setFolderName(handle.name);
      setTracks(newTracks);
      setExportProgress({ current: 0, total: 0, currentFileName: '', status: 'idle' });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Error selecting directory or feature blocked:', err);
        setIsDirectWriteSupported(false);
        alert('เบราว์เซอร์ไม่รองรับหรือบล็อกการเข้าถึงโฟลเดอร์โดยตรง ระบบจะเปิดให้เลือกไฟล์เพลงและสลับไปใช้โหมดดาวน์โหลด ZIP แทน');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle files selected via folder input fallback
  const handleSelectFolderFiles = (files: File[], detectedFolderName: string) => {
    if (files.length === 0) {
      alert('ไม่พบไฟล์เพลง (.mp3, .wav) ในโฟลเดอร์นี้');
      return;
    }
    const newTracks: Track[] = files.map((file, idx) => ({
      id: `track-${Date.now()}-${idx}`,
      name: file.name,
      originalFile: file,
      isTrimmed: false,
    }));
    setTracks(newTracks);
    setFolderName(detectedFolderName);
    setExportProgress({ current: 0, total: 0, currentFileName: '', status: 'idle' });
  };

  // Add files manually from local file picker
  const handleAddLocalFiles = (files: FileList) => {
    const newTracks: Track[] = Array.from(files).map((file, idx) => ({
      id: `track-${Date.now()}-${idx}`,
      name: file.name,
      originalFile: file,
      isTrimmed: false,
    }));

    setTracks((prev) => [...prev, ...newTracks]);
    setExportProgress({ current: 0, total: 0, currentFileName: '', status: 'idle' });
  };

  // Add downloaded track from YouTube
  const handleTrackDownloaded = (file: File) => {
    const newTrack: Track = {
      id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: file.name,
      originalFile: file,
      isTrimmed: false,
    };
    setTracks((prev) => [...prev, newTrack]);
  };

  // Reset playlist
  const handleReset = () => {
    handleStopAndClosePlayer();
    setTracks([]);
    setDirHandle(null);
    setFolderName(null);
    setExportProgress({ current: 0, total: 0, currentFileName: '', status: 'idle' });
  };

  // Reorder tracks
  const handleReorderTracks = (newTracks: Track[]) => {
    setTracks(newTracks);
  };

  // Delete single track
  const handleDeleteTrack = (trackId: string) => {
    if (playingTrack?.id === trackId) {
      handleStopAndClosePlayer();
    }
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  // Update track after trimming
  const handleSaveTrimmed = (updatedTrack: Track) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === updatedTrack.id ? updatedTrack : t))
    );
    if (playingTrack?.id === updatedTrack.id) {
      handleTogglePlay(updatedTrack);
    }
  };

  // Export sorted tracks as a ZIP file (fallback mode)
  const handleSaveAsZip = async () => {
    if (tracks.length === 0) return;
    try {
      setExportProgress({
        current: 0,
        total: tracks.length,
        currentFileName: '',
        status: 'writing',
      });
      await exportTracksAsZip(tracks, 'เพลง_เรียงแล้ว.zip', (progress) => {
        setExportProgress(progress);
      });
    } catch (err: any) {
      console.error('Error creating ZIP:', err);
      setExportProgress((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'ไม่สามารถสร้างไฟล์ ZIP ได้ กรุณาลองใหม่อีกครั้ง',
      }));
    }
  };

  // Save directly to Flash Drive in-place (replaces old files with sorted ones)
  const handleSaveToDirectory = async () => {
    if (tracks.length === 0) return;

    if (!isDirectWriteSupported) {
      await handleSaveAsZip();
      return;
    }

    try {
      let targetHandle: FileSystemDirectoryHandle;

      if (dirHandle) {
        // In-place replacement: write directly into the opened folder (no extra subfolder)
        targetHandle = dirHandle;
      } else {
        // Prompt user to select directory
        alert('กรุณาเลือกโฟลเดอร์แฟลชไดร์ฟ (USB) เพื่อบันทึกเพลง');
        targetHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });
      }

      setExportProgress({
        current: 0,
        total: tracks.length,
        currentFileName: '',
        status: 'writing',
      });

      await replaceDirectoryWithSortedTracks(targetHandle, tracks, (progress) => {
        setExportProgress(progress);
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error saving to directory:', err);
        setIsDirectWriteSupported(false);
        alert('ไม่สามารถบันทึกลงไดรฟ์โดยตรงได้ ระบบจะสลับไปดาวน์โหลดเป็นไฟล์ ZIP แทน');
        await handleSaveAsZip();
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-28">
      {/* Top Navigation */}
      <Header
        onOpenHelp={() => setIsHelpOpen(true)}
        canInstallPwa={canInstallPwa}
        onInstallPwa={handleInstallPwa}
      />

      {/* Browser Capability Warning Banner */}
      <BrowserWarningBanner
        isSupported={isDirectWriteSupported}
        isDismissed={isBannerDismissed}
        onDismiss={() => setIsBannerDismissed(true)}
      />

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 py-6 space-y-6 flex-1">
        {/* Step 1: Folder Picker */}
        <FolderPicker
          folderName={folderName}
          trackCount={tracks.length}
          onSelectDirectory={handleSelectDirectory}
          onAddLocalFiles={handleAddLocalFiles}
          onSelectFolderFiles={handleSelectFolderFiles}
          onOpenYouTubeDownloader={() => setIsYouTubeModalOpen(true)}
          onReset={handleReset}
          isLoading={isLoading}
          isDirectWriteSupported={isDirectWriteSupported}
        />

        {/* Step 2: Song List & Reordering */}
        <TrackList
          tracks={tracks}
          playingTrackId={isPlaying ? playingTrack?.id || null : null}
          onTogglePlay={handleTogglePlay}
          onOpenTrimmer={(track) => setTrimmingTrack(track)}
          onReorderTracks={handleReorderTracks}
          onDeleteTrack={handleDeleteTrack}
        />

        {/* Step 3: Save directly to Flash Drive or Download ZIP */}
        <SaveSection
          hasTracks={tracks.length > 0}
          exportProgress={exportProgress}
          onSaveToDirectory={handleSaveToDirectory}
          onSaveAsZip={handleSaveAsZip}
          folderName={folderName}
          isDirectWriteSupported={isDirectWriteSupported}
        />
      </main>

      {/* Footer */}
      <Footer />

      {/* Bottom Floating Music Player Bar */}
      <AudioPlayerBar
        currentTrack={playingTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTogglePlay={() => playingTrack && handleTogglePlay(playingTrack)}
        onSeek={handleSeek}
        onClose={handleStopAndClosePlayer}
      />

      {/* YouTube Downloader Modal */}
      <YouTubeDownloaderModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        onTrackDownloaded={handleTrackDownloaded}
      />

      {/* Audio Trimmer Modal with Running Playhead */}
      <AudioTrimmerModal
        track={trimmingTrack}
        isOpen={!!trimmingTrack}
        onClose={() => setTrimmingTrack(null)}
        onSaveTrimmed={handleSaveTrimmed}
      />

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};

export default App;
