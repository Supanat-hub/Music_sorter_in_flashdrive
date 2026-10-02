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

export interface YouTubeSearchResult {
  id: string;
  title: string;
  original_title?: string;
  url: string;
  duration: number;
  duration_str: string;
  channel?: string;
  thumbnail?: string;
}

export interface YouTubeUrlInfo {
  type: 'video' | 'playlist';
  id?: string;
  title: string;
  url?: string;
  duration?: number;
  duration_str?: string;
  channel?: string;
  thumbnail?: string;
  total_items?: number;
  items?: YouTubeSearchResult[];
}
