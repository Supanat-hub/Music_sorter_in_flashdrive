import { YouTubeSearchResult, YouTubeUrlInfo } from '../types/audio';

const STORAGE_KEY = 'music_sorter_yt_api_url';
// Default to live Render deployment
export const DEFAULT_BACKEND_URL =
  ((import.meta as any).env?.VITE_YT_BACKEND_URL) ||
  'https://music-sorter-api.onrender.com';

export const getBackendUrl = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  return DEFAULT_BACKEND_URL.replace(/\/+$/, '');
};

export const setBackendUrl = (url: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ''));
  }
};

export const resetBackendUrl = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export const checkBackendHealth = async (
  customUrl?: string
): Promise<{ ok: boolean; statusText: string }> => {
  const target = (customUrl || getBackendUrl()).replace(/\/+$/, '');
  try {
    const res = await fetch(`${target}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, statusText: data.service || 'พร้อมใช้งาน' };
    }
    return { ok: false, statusText: `HTTP Error ${res.status}` };
  } catch (err: any) {
    return { ok: false, statusText: err.message || 'ไม่สามารถเชื่อมต่อได้' };
  }
};

export const searchYouTube = async (
  query: string,
  limit: number = 10
): Promise<YouTubeSearchResult[]> => {
  const backend = getBackendUrl();
  const url = `${backend}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `การค้นหาล้มเหลว (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.results || [];
};

export const getYouTubeUrlInfo = async (videoUrl: string): Promise<YouTubeUrlInfo> => {
  const backend = getBackendUrl();
  const url = `${backend}/api/info?url=${encodeURIComponent(videoUrl)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `ไม่สามารถดึงข้อมูลลิงก์ได้ (HTTP ${res.status})`);
  }

  return await res.json();
};

export const downloadYouTubeTrack = async (
  videoUrl: string,
  signal?: AbortSignal
): Promise<{ file: File; title: string }> => {
  const backend = getBackendUrl();
  const url = `${backend}/api/download?url=${encodeURIComponent(videoUrl)}`;

  const res = await fetch(url, {
    method: 'GET',
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `การดาวน์โหลดล้มเหลว (HTTP ${res.status})`);
  }

  // Extract song title from X-Audio-Title header or Content-Disposition
  let title = 'เพลงจาก YouTube';
  const customTitleHeader = res.headers.get('X-Audio-Title');
  if (customTitleHeader) {
    try {
      title = decodeURIComponent(customTitleHeader);
    } catch {
      title = customTitleHeader;
    }
  } else {
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.includes("filename*=UTF-8''")) {
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
      if (match && match[1]) {
        try {
          title = decodeURIComponent(match[1]).replace(/\.mp3$/i, '');
        } catch {}
      }
    }
  }

  const blob = await res.blob();
  const audioFile = new File([blob], `${title}.mp3`, {
    type: 'audio/mp3',
    lastModified: Date.now(),
  });

  return { file: audioFile, title };
};
