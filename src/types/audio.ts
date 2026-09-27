export interface Track {
  id: string;
  name: string;
  originalFile: File;
  trimmedBlob?: Blob;
  duration?: number;
  isTrimmed?: boolean;
  trimStart?: number;
  trimEnd?: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
}

export interface ExportProgress {
  current: number;
  total: number;
  currentFileName: string;
  status: 'idle' | 'writing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface AudioTrimSettings {
  startTime: number;
  endTime: number;
  fadeIn: boolean;
  fadeOut: boolean;
}
