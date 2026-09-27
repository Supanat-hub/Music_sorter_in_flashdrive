import JSZip from 'jszip';
import { Track, ExportProgress } from '../types/audio';

// Helper to check if File System Access API is supported
export const isFileSystemAccessSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).showDirectoryPicker === 'function'
  );
};

// Supported audio extensions
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'];

export const isAudioFile = (fileName: string): boolean => {
  const lower = fileName.toLowerCase();
  // Filter out system hidden/junk files (e.g. Mac ._ files, thumbs.db)
  if (fileName.startsWith('._') || fileName.startsWith('.')) return false;
  return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
};

// Remove existing numbering prefix if present (e.g., "01 - Song.mp3" -> "Song.mp3")
export const cleanFileName = (fileName: string): string => {
  return fileName.replace(/^(\d+[\s._-]+)+/i, '').trim() || fileName;
};

// Read files from a directory handle (File System Access API)
export const readAudioFilesFromDirectory = async (
  dirHandle: FileSystemDirectoryHandle
): Promise<File[]> => {
  const files: File[] = [];

  for await (const entry of (dirHandle as any).values()) {
    if (entry.kind === 'file' && isAudioFile(entry.name)) {
      const file = await entry.getFile();
      files.push(file);
    }
  }

  // Sort initially by name naturally
  files.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
  return files;
};

// In-place replacement: Cleans old audio files from target directory and writes sorted files sequentially
export const replaceDirectoryWithSortedTracks = async (
  targetDirHandle: FileSystemDirectoryHandle,
  tracks: Track[],
  onProgress: (progress: ExportProgress) => void
): Promise<void> => {
  const total = tracks.length;

  // Step 1: Preload all track data into memory so we can safely delete old files from disk without errors
  onProgress({
    current: 0,
    total,
    currentFileName: 'กำลังเตรียมข้อมูลเพลงเข้าหน่วยความจำ...',
    status: 'writing',
  });

  const trackPayloads: { fileName: string; blob: Blob }[] = [];

  for (let i = 0; i < total; i++) {
    const track = tracks[i];
    const trackNumber = String(i + 1).padStart(3, '0');
    const cleanedName = cleanFileName(track.name);
    const baseName = cleanedName.replace(/\.[^/.]+$/, '');
    const finalFileName = `${trackNumber} - ${baseName}.mp3`;

    let blob: Blob;
    if (track.trimmedBlob) {
      blob = track.trimmedBlob;
    } else {
      // Detach from disk file by reading full ArrayBuffer
      const buffer = await track.originalFile.arrayBuffer();
      blob = new Blob([buffer], { type: 'audio/mp3' });
    }

    trackPayloads.push({ fileName: finalFileName, blob });
  }

  // Step 2: Remove old audio files from the target directory to clean the FAT directory table
  onProgress({
    current: 0,
    total,
    currentFileName: 'กำลังล้างไฟล์เพลงเดิมในโฟลเดอร์นี้...',
    status: 'writing',
  });

  const existingFileNames: string[] = [];
  for await (const entry of (targetDirHandle as any).values()) {
    if (entry.kind === 'file' && isAudioFile(entry.name)) {
      existingFileNames.push(entry.name);
    }
  }

  for (const oldName of existingFileNames) {
    try {
      await targetDirHandle.removeEntry(oldName);
    } catch (err) {
      console.warn(`Could not remove ${oldName}:`, err);
    }
  }

  // Step 3: Write sorted files sequentially one by one
  for (let index = 0; index < total; index++) {
    const payload = trackPayloads[index];

    onProgress({
      current: index + 1,
      total,
      currentFileName: payload.fileName,
      status: 'writing',
    });

    const fileHandle = await targetDirHandle.getFileHandle(payload.fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(payload.blob);
    await writable.close(); // Commit to FAT table before next file
  }

  onProgress({
    current: total,
    total,
    currentFileName: '',
    status: 'completed',
  });
};

// Fallback: Export all sorted tracks as a ZIP file
export const exportTracksAsZip = async (
  tracks: Track[],
  zipName: string = 'เพลง_เรียงแล้ว.zip',
  onProgress: (progress: ExportProgress) => void
): Promise<void> => {
  const zip = new JSZip();
  const total = tracks.length;

  for (let index = 0; index < total; index++) {
    const track = tracks[index];
    const trackNumber = String(index + 1).padStart(3, '0');
    const cleanedName = cleanFileName(track.name);
    const baseName = cleanedName.replace(/\.[^/.]+$/, '');
    const finalFileName = `${trackNumber} - ${baseName}.mp3`;

    onProgress({
      current: index + 1,
      total,
      currentFileName: finalFileName,
      status: 'writing',
    });

    const content: Blob = track.trimmedBlob || track.originalFile;
    zip.file(finalFileName, content);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    onProgress({
      current: Math.round((metadata.percent / 100) * total),
      total,
      currentFileName: 'กำลังสร้างไฟล์ ZIP...',
      status: 'writing',
    });
  });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  onProgress({
    current: total,
    total,
    currentFileName: '',
    status: 'completed',
  });
};
