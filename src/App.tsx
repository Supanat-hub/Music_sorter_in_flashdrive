import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { FolderPicker } from './components/FolderPicker';
import { TrackList } from './components/TrackList';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AudioTrimmerModal } from './components/AudioTrimmerModal';
import { SaveSection } from './components/SaveSection';
import { HelpModal } from './components/HelpModal';
import { Track, ExportProgress } from './types/audio';
import {
  readAudioFilesFromDirectory,
  replaceDirectoryWithSortedTracks,
  isFileSystemAccessSupported,
} from './utils/fileSystem';

export const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
        console.error('Error selecting directory:', err);
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

  // Save directly to Flash Drive in-place (replaces old files with sorted ones)
  const handleSaveToDirectory = async () => {
    if (tracks.length === 0) return;

    try {
      let targetHandle: FileSystemDirectoryHandle;

      if (isFileSystemAccessSupported()) {
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
      } else {
        alert('เบราว์เซอร์ไม่รองรับ กรุณาเปิดผ่าน Google Chrome หรือ Microsoft Edge บนคอมพิวเตอร์');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error saving to directory:', err);
        setExportProgress((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'ไม่สามารถบันทึกเพลงลงแฟลชไดร์ฟได้ กรุณาตรวจสอบการเชื่อมต่อแฟลชไดร์ฟ',
        }));
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

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 py-6 space-y-6 flex-1">
        {/* Step 1: Folder Picker */}
        <FolderPicker
          folderName={folderName}
          trackCount={tracks.length}
          onSelectDirectory={handleSelectDirectory}
          onAddLocalFiles={handleAddLocalFiles}
          onSelectFolderFiles={handleSelectFolderFiles}
          onReset={handleReset}
          isLoading={isLoading}
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

        {/* Step 3: Save directly to Flash Drive */}
        <SaveSection
          hasTracks={tracks.length > 0}
          exportProgress={exportProgress}
          onSaveToDirectory={handleSaveToDirectory}
          folderName={folderName}
        />
      </main>

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
