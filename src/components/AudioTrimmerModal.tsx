import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Scissors, X, Check, RotateCcw, Loader2 } from 'lucide-react';
import { Track } from '../types/audio';
import { decodeAudioFile, formatTime, sliceAudioBuffer } from '../utils/audioHelper';
import { encodeAudioBufferToMp3 } from '../utils/mp3Encoder';

interface AudioTrimmerModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveTrimmed: (updatedTrack: Track) => void;
}

export const AudioTrimmerModal: React.FC<AudioTrimmerModalProps> = ({
  track,
  isOpen,
  onClose,
  onSaveTrimmed,
}) => {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEncoding, setIsEncoding] = useState<boolean>(false);
  const [encodingProgress, setEncodingProgress] = useState<number>(0);

  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const [applyFadeIn, setApplyFadeIn] = useState<boolean>(true);
  const [applyFadeOut, setApplyFadeOut] = useState<boolean>(true);

  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isPlayingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !track) {
      setAudioBuffer(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    stopPreview();

    const loadAudio = async () => {
      try {
        const fileToDecode = track.originalFile;
        const buffer = await decodeAudioFile(fileToDecode);

        if (!isMounted) return;

        setAudioBuffer(buffer);
        const totalDuration = buffer.duration;
        setDuration(totalDuration);

        setStartTime(track.trimStart || 0);
        setEndTime(track.trimEnd || totalDuration);
        setApplyFadeIn(track.fadeIn ?? true);
        setApplyFadeOut(track.fadeOut ?? true);
      } catch (err) {
        console.error('Failed to decode audio file:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      stopPreview();
    };
  }, [isOpen, track]);

  const drawWaveform = (currentPlayPos?: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = channelData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      const currentSec = (i / width) * duration;
      const isSelected = currentSec >= startTime && currentSec <= endTime;

      if (isSelected) {
        if (currentPlayPos !== undefined && currentSec <= currentPlayPos) {
          ctx.fillStyle = '#059669';
        } else {
          ctx.fillStyle = '#10b981';
        }
      } else {
        ctx.fillStyle = '#cbd5e1';
      }

      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    const startX = Math.round((startTime / duration) * width);
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.stroke();

    ctx.fillStyle = '#047857';
    ctx.fillRect(Math.max(0, startX - 2), 0, 4, 14);

    const endX = Math.round((endTime / duration) * width);
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();

    ctx.fillStyle = '#047857';
    ctx.fillRect(Math.min(width - 4, endX - 2), height - 14, 4, 14);

    if (currentPlayPos !== undefined && currentPlayPos >= startTime && currentPlayPos <= endTime) {
      const playX = (currentPlayPos / duration) * width;

      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(playX, 8, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px sans-serif';
      const timeText = formatTime(currentPlayPos);
      const textWidth = ctx.measureText(timeText).width;
      const textX = Math.max(2, Math.min(width - textWidth - 8, playX - textWidth / 2 - 4));
      ctx.fillRect(textX, height - 18, textWidth + 8, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(timeText, textX + 4, height - 6);
    }
  };

  useEffect(() => {
    if (!isPlayingRef.current) {
      drawWaveform();
    }
  }, [audioBuffer, startTime, endTime, duration]);

  const stopPreview = () => {
    isPlayingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      previewSourceRef.current = null;
    }
    setIsPlayingPreview(false);
    drawWaveform();
  };

  const playPreview = () => {
    if (!audioBuffer) return;
    stopPreview();

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = ctx;

    const previewBuffer = sliceAudioBuffer(audioBuffer, startTime, endTime, applyFadeIn, applyFadeOut);
    const source = ctx.createBufferSource();
    source.buffer = previewBuffer;
    source.connect(ctx.destination);

    source.onended = () => {
      stopPreview();
    };

    source.start(0);
    previewSourceRef.current = source;
    isPlayingRef.current = true;
    setIsPlayingPreview(true);

    playbackStartTimeRef.current = ctx.currentTime;
    playbackOffsetRef.current = startTime;

    const animate = () => {
      if (!isPlayingRef.current || !audioContextRef.current) return;

      const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current;
      const currentPos = playbackOffsetRef.current + elapsed;

      if (currentPos >= endTime) {
        stopPreview();
        return;
      }

      drawWaveform(currentPos);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handleSave = async () => {
    if (!audioBuffer || !track) return;
    stopPreview();
    setIsEncoding(true);
    setEncodingProgress(15);

    await new Promise((resolve) => setTimeout(resolve, 120));

    try {
      const slicedBuffer = sliceAudioBuffer(
        audioBuffer,
        startTime,
        endTime,
        applyFadeIn,
        applyFadeOut
      );

      setEncodingProgress(35);
      await new Promise((resolve) => setTimeout(resolve, 80));

      const mp3Blob = await encodeAudioBufferToMp3(slicedBuffer, 192, (pct) => {
        setEncodingProgress(Math.max(35, Math.min(95, Math.round(35 + pct * 0.6))));
      });

      setEncodingProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 400));

      onSaveTrimmed({
        ...track,
        trimmedBlob: mp3Blob,
        isTrimmed: true,
        trimStart: startTime,
        trimEnd: endTime,
        fadeIn: applyFadeIn,
        fadeOut: applyFadeOut,
      });

      onClose();
    } catch (err) {
      console.error('Failed to encode trimmed MP3:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกท่อนเพลง กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsEncoding(false);
    }
  };

  const handleReset = () => {
    setStartTime(0);
    setEndTime(duration);
    stopPreview();
  };

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] relative">
        {/* Overlay Loader */}
        {isEncoding && (
          <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 border border-emerald-200 shadow-sm">
              <Loader2 className="w-9 h-9 text-emerald-600 animate-spin" />
            </div>
            <h4 className="text-2xl font-bold text-slate-800 mb-2">
              {encodingProgress >= 100 ? 'บันทึกเสร็จสิ้น' : 'กำลังบันทึกไฟล์ MP3...'}
            </h4>
            <p className="text-slate-500 text-base max-w-md mb-6">
              {encodingProgress >= 100
                ? 'นำท่อนเพลงที่ตัดเข้าสู่รายการแล้ว'
                : 'ระบบกำลังประมวลผลไฟล์เสียง กรุณารอสักครู่'}
            </p>

            <div className="w-full max-w-md bg-slate-100 h-4 rounded-full overflow-hidden border border-slate-200 p-0.5 shadow-inner">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-200"
                style={{ width: `${encodingProgress}%` }}
              />
            </div>
            <span className="text-emerald-700 font-extrabold text-lg mt-2 tabular-nums">
              {encodingProgress}%
            </span>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl">
              <Scissors className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-800">
                ตัดต่อเพลง
              </h3>
              <p className="text-slate-500 text-sm truncate max-w-xs sm:max-w-md">
                {track.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopPreview();
              onClose();
            }}
            disabled={isEncoding}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition disabled:opacity-30"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-20 text-center text-slate-500">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
              <p className="font-bold text-xl text-slate-700">กำลังโหลดกราฟคลื่นเสียง...</p>
              <p className="text-slate-400 text-sm mt-1">กำลังถอดรหัสเสียงเพลงเพื่อแสดงผล</p>
            </div>
          ) : (
            <>
              {/* Waveform Canvas */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={110}
                  className="w-full h-28 rounded-xl bg-slate-100 shadow-inner"
                />
                <div className="flex justify-between items-center text-xs text-slate-500 font-semibold mt-2 px-1">
                  <span>00:00</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                    ความยาว: {formatTime(Math.max(0, endTime - startTime))}
                  </span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {/* Start Time */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-bold text-slate-700">จุดเริ่มต้น:</label>
                    <span className="text-base font-bold text-emerald-700 tabular-nums">
                      {formatTime(startTime)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.5}
                    value={startTime}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val < endTime) setStartTime(val);
                    }}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setStartTime((s) => Math.max(0, s - 1))}
                      className="flex-1 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 active:bg-slate-200 shadow-sm"
                    >
                      - 1 วินาที
                    </button>
                    <button
                      onClick={() => setStartTime((s) => Math.min(endTime - 1, s + 1))}
                      className="flex-1 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 active:bg-slate-200 shadow-sm"
                    >
                      + 1 วินาที
                    </button>
                  </div>
                </div>

                {/* End Time */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-bold text-slate-700">จุดสิ้นสุด:</label>
                    <span className="text-base font-bold text-emerald-700 tabular-nums">
                      {formatTime(endTime)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.5}
                    value={endTime}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > startTime) setEndTime(val);
                    }}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setEndTime((s) => Math.max(startTime + 1, s - 1))}
                      className="flex-1 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 active:bg-slate-200 shadow-sm"
                    >
                      - 1 วินาที
                    </button>
                    <button
                      onClick={() => setEndTime((s) => Math.min(duration, s + 1))}
                      className="flex-1 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 active:bg-slate-200 shadow-sm"
                    >
                      + 1 วินาที
                    </button>
                  </div>
                </div>
              </div>

              {/* Fade in / Fade out */}
              <div className="flex flex-col sm:flex-row gap-3 bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl">
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 font-semibold text-sm">
                  <input
                    type="checkbox"
                    checked={applyFadeIn}
                    onChange={(e) => setApplyFadeIn(e.target.checked)}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span>ค่อยๆ ดังขึ้น (Fade-in 1.5 วินาที)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 font-semibold text-sm">
                  <input
                    type="checkbox"
                    checked={applyFadeOut}
                    onChange={(e) => setApplyFadeOut(e.target.checked)}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span>ค่อยๆ เบาลง (Fade-out 2.0 วินาที)</span>
                </label>
              </div>

              {/* Preview Button */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={isPlayingPreview ? stopPreview : playPreview}
                  className={`flex items-center gap-2.5 font-bold px-5 py-3 rounded-xl shadow-sm transition text-base ${
                    isPlayingPreview
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-900 ring-2 ring-amber-300'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  }`}
                >
                  {isPlayingPreview ? (
                    <>
                      <Pause className="w-5 h-5 fill-current" />
                      <span>หยุดฟัง</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                      <span>ทดลองฟัง</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-semibold p-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>คืนค่าเดิม</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            onClick={() => {
              stopPreview();
              onClose();
            }}
            disabled={isEncoding}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            ยกเลิก
          </button>

          <button
            onClick={handleSave}
            disabled={isLoading || isEncoding}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold px-7 py-3 rounded-xl shadow-md transition text-base"
          >
            <Check className="w-5 h-5" />
            <span>ตกลง</span>
          </button>
        </div>
      </div>
    </div>
  );
};
