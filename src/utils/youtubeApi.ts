import { YouTubeSearchResult, YouTubeUrlInfo, CuratedPack } from '../types/audio';

const STORAGE_KEY = 'music_sorter_yt_api_url';
// Default to live Render deployment
export const DEFAULT_BACKEND_URL =
  ((import.meta as any).env?.VITE_YT_BACKEND_URL) ||
  'https://music-sorter-api.onrender.com';
export const LOCAL_BACKEND_URL = 'http://localhost:7860';

let cachedBackendUrl: string | null = null;
let lastCheckTime = 0;

export const getBackendUrl = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  return (cachedBackendUrl || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
};

export const detectBestBackendUrl = async (): Promise<string> => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      cachedBackendUrl = saved.trim().replace(/\/+$/, '');
      return cachedBackendUrl;
    }
  }

  // Cache detection result for 20 seconds
  const now = Date.now();
  if (cachedBackendUrl && now - lastCheckTime < 20000) {
    return cachedBackendUrl;
  }

  // Probe localhost:7860 with a quick 500ms timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600);
    const res = await fetch(`${LOCAL_BACKEND_URL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      cachedBackendUrl = LOCAL_BACKEND_URL;
      lastCheckTime = now;
      return LOCAL_BACKEND_URL;
    }
  } catch {
    // Localhost not running
  }

  const fallbackUrl = DEFAULT_BACKEND_URL.replace(/\/+$/, '');
  cachedBackendUrl = fallbackUrl;
  lastCheckTime = now;
  return fallbackUrl;
};

export const setBackendUrl = (url: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ''));
    cachedBackendUrl = url.trim().replace(/\/+$/, '');
  }
};

export const resetBackendUrl = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    cachedBackendUrl = null;
  }
};

export const checkBackendHealth = async (
  customUrl?: string
): Promise<{ ok: boolean; statusText: string }> => {
  const target = (customUrl || (await detectBestBackendUrl())).replace(/\/+$/, '');
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

export const getCuratedPacks = async (): Promise<CuratedPack[]> => {
  const backend = await detectBestBackendUrl();
  try {
    const res = await fetch(`${backend}/api/curated-packs`);
    if (res.ok) {
      const data = await res.json();
      return data.packs || [];
    }
  } catch (e) {
    console.warn('Failed to load curated packs from backend, using fallback:', e);
  }
  // Fallback defaults if backend is unavailable
  return [
    {
      id: 'aerobic-dance',
      title: 'เพลงเต้นแอโรบิก & ออกกำลังกาย',
      description: 'จังหวะสนุกสนาน 130-140 BPM กระตุ้นหัวใจ เหมาะสำหรับเปิดกับลำโพงเต้นเช้า-เย็น',
      query: 'เพลงเต้นแอโรบิก มันส์ๆ',
      tag: 'เต้นแอโรบิก',
      badge: 'ยอดนิยม',
    },
    {
      id: 'sai-yow-remix',
      title: 'สายย่อ & รถแห่ เบสแน่นๆ',
      description: 'รวมเพลงแดนซ์เบสหนัก ลำโพงลั่น ท่อนฮุคมันส์ๆ ขวัญใจสายปาร์ตี้',
      query: 'สายย่อ รถแห่ remix',
      tag: 'สายย่อ รถแห่',
      badge: 'เบสหนัก',
    },
    {
      id: 'ncs-edm',
      title: 'NoCopyrightSounds (NCS) EDM',
      description: 'เพลงสากล Electronic Dance Music ไม่มีลิขสิทธิ์ 100% เสียงใส เบสคม',
      query: 'NCS best of EDM remix',
      tag: 'NCS EDM',
      badge: 'ไม่มีลิขสิทธิ์ 100%',
    },
    {
      id: 'country-dance-3cha',
      title: '3 ช่า & ลูกทุ่งโจ๊ะๆ มันส์ๆ',
      description: 'จังหวะโจ๊ะ 3 ช่าไทยแท้ ร้องตามง่าย เต้นสนุก ลำโพงบลูทูธเปิดเพลิน',
      query: '3 ช่า มันส์ๆ remix',
      tag: '3 ช่า มันส์ๆ',
      badge: 'จังหวะสนุก',
    },
    {
      id: 'chill-travel',
      title: 'เพลงฟังสบาย ขับรถ ชิลๆ',
      description: 'เพลงเพราะฟังสบาย ผ่อนคลาย เหมาะกับการเปิดยาวๆ ในรถหรือพักผ่อน',
      query: 'เพลงฟังสบาย acoustic thai',
      tag: 'ฟังสบาย',
      badge: 'ชิลๆ',
    },
  ];
};

export const searchAudio = async (
  query: string,
  source: 'soundcloud' | 'youtube' | 'all' = 'soundcloud',
  limit: number = 12
): Promise<YouTubeSearchResult[]> => {
  const backend = await detectBestBackendUrl();
  const url = `${backend}/api/search?q=${encodeURIComponent(query)}&source=${source}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error('เซิร์ฟเวอร์กำลังตื่นจากการพัก (Cold Start) กรุณารอประมาณ 30 วินาทีแล้วกดค้นหาใหม่อีกครั้ง');
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'การค้นหาขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
  }

  const data = await res.json();
  return data.results || [];
};

export const searchYouTube = (query: string, limit: number = 10) =>
  searchAudio(query, 'youtube', limit);

export const getAudioUrlInfo = async (audioUrl: string): Promise<YouTubeUrlInfo> => {
  const backend = getBackendUrl();
  const url = `${backend}/api/info?url=${encodeURIComponent(audioUrl)}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error('เซิร์ฟเวอร์กำลังตื่นจากการพัก กรุณารอประมาณ 30 วินาทีแล้วลองใหม่');
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'ไม่สามารถเปิดข้อมูลลิงก์นี้ได้ กรุณาตรวจสอบว่าเป็นลิงก์ SoundCloud หรือ YouTube ที่ถูกต้อง');
  }

  return await res.json();
};

export const getYouTubeUrlInfo = getAudioUrlInfo;

export const downloadAudioTrack = async (
  audioUrl: string,
  signal?: AbortSignal
): Promise<{ file: File; title: string }> => {
  const backend = getBackendUrl();
  const url = `${backend}/api/download?url=${encodeURIComponent(audioUrl)}`;

  const res = await fetch(url, {
    method: 'GET',
    signal,
  });

  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error('เซิร์ฟเวอร์กำลังเตรียมระบบ กรุณารอประมาณ 30 วินาทีแล้วลองดาวน์โหลดใหม่');
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'ไม่สามารถดาวน์โหลดเพลงนี้ได้ กรุณาลองเลือกเพลงอื่น');
  }

  // Extract song title from X-Audio-Title header or Content-Disposition
  let title = 'เพลงออนไลน์';
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

export const downloadYouTubeTrack = downloadAudioTrack;
