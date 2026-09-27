import React, { useState } from 'react';
import { ArrowUpDown, Shuffle, Music, Info } from 'lucide-react';
import { Track } from '../types/audio';
import { TrackItem } from './TrackItem';

interface TrackListProps {
  tracks: Track[];
  playingTrackId: string | null;
  onTogglePlay: (track: Track) => void;
  onOpenTrimmer: (track: Track) => void;
  onReorderTracks: (newTracks: Track[]) => void;
  onDeleteTrack: (trackId: string) => void;
}

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  playingTrackId,
  onTogglePlay,
  onOpenTrimmer,
  onReorderTracks,
  onDeleteTrack,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (_e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...tracks];
    const item = updated.splice(draggedIndex, 1)[0];
    updated.splice(targetIndex, 0, item);

    setDraggedIndex(targetIndex);
    onReorderTracks(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...tracks];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    onReorderTracks(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === tracks.length - 1) return;
    const updated = [...tracks];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    onReorderTracks(updated);
  };

  const handleSortAlphabetical = () => {
    const sorted = [...tracks].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    onReorderTracks(sorted);
  };

  const handleShuffle = () => {
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    onReorderTracks(shuffled);
  };

  if (tracks.length === 0) {
    return (
      <section className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
            <Music className="w-8 h-8" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-slate-700 mb-2">ยังไม่มีเพลงในรายการ</h3>
        <p className="text-slate-500 max-w-md mx-auto text-base">
          เลือกโฟลเดอร์ในแฟลชไดร์ฟหรือเลือกไฟล์เพลงเพื่อเริ่มต้นจัดเรียง
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 bg-emerald-600 text-white font-bold rounded-full text-base">
            2
          </span>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
              ขั้นตอนที่ 2: จัดเรียงลำดับและตัดแต่งเพลง
            </h2>
            <p className="text-slate-500 text-sm flex items-center gap-1.5 mt-0.5">
              <Info className="w-4 h-4 text-emerald-600 inline" />
              <span>ลากสลับแถวหรือกดลูกศร [▲] [▼] เพื่อเปลี่ยนลำดับ</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSortAlphabetical}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-lg transition"
            title="เรียงตามตัวอักษร ก-ฮ / A-Z"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>เรียง ก-ฮ</span>
          </button>

          <button
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-lg transition"
            title="สลับเพลงแบบสุ่ม"
          >
            <Shuffle className="w-4 h-4" />
            <span>สุ่มเพลง</span>
          </button>
        </div>
      </div>

      <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-2 py-1">
        {tracks.map((track, idx) => (
          <TrackItem
            key={track.id}
            track={track}
            index={idx}
            total={tracks.length}
            isPlaying={playingTrackId === track.id}
            onTogglePlay={() => onTogglePlay(track)}
            onOpenTrimmer={() => onOpenTrimmer(track)}
            onMoveUp={() => handleMoveUp(idx)}
            onMoveDown={() => handleMoveDown(idx)}
            onDelete={() => onDeleteTrack(track.id)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            isDragging={draggedIndex === idx}
          />
        ))}
      </div>
    </section>
  );
};
