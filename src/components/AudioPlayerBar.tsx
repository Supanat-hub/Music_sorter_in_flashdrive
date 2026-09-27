import React from 'react';
import { Play, Pause, X, Volume2 } from 'lucide-react';
import { Track } from '../types/audio';
import { formatTime } from '../utils/audioHelper';

interface AudioPlayerBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onClose: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onSeek,
  onClose,
}) => {
  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t-2 border-emerald-500 shadow-2xl z-40 px-4 py-3">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Track Title */}
        <div className="flex items-center gap-3 w-full sm:w-1/3 min-w-0">
          <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl flex-shrink-0">
            <Volume2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider">กำลังเปิดฟังตัวอย่าง</p>
            <p className="text-slate-800 font-bold text-base truncate">{currentTrack.name}</p>
          </div>
        </div>

        {/* Playback Controls & Scrubber */}
        <div className="flex flex-col items-center gap-1.5 w-full sm:w-1/2">
          <div className="flex items-center gap-4">
            <button
              onClick={onTogglePlay}
              className="flex items-center justify-center w-11 h-11 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-full shadow-md transition"
              title={isPlaying ? 'หยุดเล่น' : 'เล่นต่อ'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
            <span className="text-sm font-semibold text-slate-600 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="w-full flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>
        </div>

        {/* Close Bar */}
        <div className="hidden sm:flex justify-end w-1/6">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            title="ปิดแถบเครื่องเล่นเสียง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
