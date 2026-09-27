import React from 'react';
import { Play, Pause, Scissors, ChevronUp, ChevronDown, Trash2, GripVertical, Check } from 'lucide-react';
import { Track } from '../types/audio';

interface TrackItemProps {
  track: Track;
  index: number;
  total: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onOpenTrimmer: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

export const TrackItem: React.FC<TrackItemProps> = ({
  track,
  index,
  total,
  isPlaying,
  onTogglePlay,
  onOpenTrimmer,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
}) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      className={`group flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border transition-all ${
        isPlaying
          ? 'bg-emerald-50 border-emerald-400 shadow-sm'
          : isDragging
          ? 'opacity-40 border-dashed border-emerald-500 bg-emerald-50/50'
          : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'
      }`}
    >
      {/* Left: Drag Handle & Track Number */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1"
          title="ลากเพื่อเปลี่ยนลำดับ"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-800 font-bold text-base sm:text-lg">
          {index + 1}
        </div>
      </div>

      {/* Middle: Play Button & Song Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onTogglePlay}
          className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 transition shadow-sm ${
            isPlaying
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700'
          }`}
          title={isPlaying ? 'หยุด' : 'เล่น'}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-base sm:text-lg truncate">
            {track.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {track.isTrimmed ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                <Check className="w-3 h-3" /> ตัดแล้ว
              </span>
            ) : (
              <span className="text-xs text-slate-400">ต้นฉบับ</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions (Trim, Up, Down, Delete) */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Trim Button */}
        <button
          onClick={onOpenTrimmer}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition ${
            track.isTrimmed
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title="ตัดเพลง"
        >
          <Scissors className="w-4 h-4 text-emerald-700" />
          <span className="hidden md:inline">ตัดเพลง</span>
        </button>

        {/* Move Up */}
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title="เลื่อนขึ้น"
        >
          <ChevronUp className="w-5 h-5" />
        </button>

        {/* Move Down */}
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title="เลื่อนลง"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
          title="ลบ"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
