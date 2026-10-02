import os
import re
import tempfile
import yt_dlp
from typing import List, Dict, Any, Optional

COOKIE_ENV_VAR = "YOUTUBE_COOKIES"

def get_cookie_file_path() -> Optional[str]:
    """
    Check if YOUTUBE_COOKIES environment variable is provided.
    If provided, write to a temp file and return the path.
    """
    cookies_content = os.getenv(COOKIE_ENV_VAR)
    if not cookies_content:
        return None
    
    # Check if it's already a valid file path
    if os.path.isfile(cookies_content):
        return cookies_content
    
    # Otherwise treat as cookie file text content
    temp_cookie = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt")
    temp_cookie.write(cookies_content)
    temp_cookie.close()
    return temp_cookie.name

def clean_song_title(title: str) -> str:
    """
    Remove undesirable YouTube title clutter like (Official MV), [Audio], etc.
    and replace filesystem invalid characters.
    """
    # Remove patterns like (Official MV), [Official Video], (Audio), (Lyrics)
    clutter_patterns = [
        r'\[Official\s*(?:Music\s*)?Video\]',
        r'\(Official\s*(?:Music\s*)?Video\)',
        r'\[Official\s*Audio\]',
        r'\(Official\s*Audio\)',
        r'\[MV\]',
        r'\(MV\)',
        r'\[HD\]',
        r'\(HD\)',
        r'\[Lyrics?(?:\s*Video)?\]',
        r'\(Lyrics?(?:\s*Video)?\)',
        r'\[Audio\]',
        r'\(Audio\)',
    ]
    cleaned = title
    for pattern in clutter_patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    
    # Clean whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    # Remove characters illegal in filenames: \ / : * ? " < > |
    cleaned = re.sub(r'[\\/*?:"<>|]', '', cleaned)
    return cleaned or title

def get_base_ydl_opts() -> dict:
    """
    Base configuration for yt-dlp to maximize bypass capabilities on cloud/datacenter IPs
    """
    opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'logtostderr': False,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web', 'tv'],
            }
        },
        # Emulate standard web client
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us,en;q=0.5',
        }
    }
    cookie_path = get_cookie_file_path()
    if cookie_path:
        opts['cookiefile'] = cookie_path
    return opts

MAX_DURATION_SECONDS = 1200 # 20 minutes max per track

def search_youtube(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search YouTube videos matching query
    """
    opts = get_base_ydl_opts()
    opts['extract_flat'] = 'in_playlist'
    opts['ignoreerrors'] = True
    
    results = []
    search_query = f"ytsearch{limit}:{query}"
    
    with yt_dlp.YoutubeDL(opts) as ydl:
        try:
            info = ydl.extract_info(search_query, download=False)
            if not info or 'entries' not in info:
                return []
            
            for entry in info['entries']:
                if not entry:
                    continue
                
                duration = entry.get('duration') or 0
                is_live = bool(entry.get('is_live'))
                is_too_long = duration > MAX_DURATION_SECONDS
                mins, secs = divmod(int(duration), 60)
                duration_str = "LIVE" if is_live else f"{mins:02d}:{secs:02d}"
                
                # Best thumbnail
                thumbnails = entry.get('thumbnails') or []
                thumbnail_url = thumbnails[-1]['url'] if thumbnails else f"https://i.ytimg.com/vi/{entry.get('id')}/hqdefault.jpg"
                
                results.append({
                    'id': entry.get('id'),
                    'title': clean_song_title(entry.get('title', 'Unknown Title')),
                    'original_title': entry.get('title'),
                    'url': entry.get('webpage_url') or f"https://www.youtube.com/watch?v={entry.get('id')}",
                    'duration': duration,
                    'duration_str': duration_str,
                    'is_live': is_live,
                    'is_too_long': is_too_long,
                    'channel': entry.get('uploader') or entry.get('channel') or '',
                    'thumbnail': thumbnail_url,
                })
        except Exception as e:
            print(f"Error during YouTube search: {e}")
            raise e
            
    return results

def get_url_info(url: str) -> Dict[str, Any]:
    """
    Inspect URL to determine if it is a single video or a playlist
    """
    opts = get_base_ydl_opts()
    opts['extract_flat'] = 'in_playlist'
    
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if not info:
            raise ValueError("ไม่พบข้อมูลวิดีโอ กรุณาตรวจสอบว่าลิงก์ถูกต้องและเป็นสาธารณะ")
            
        is_playlist = 'entries' in info and isinstance(info['entries'], list)
        
        if is_playlist:
            raw_entries = info['entries'][:30] # Limit to max 30 items
            items = []
            for entry in raw_entries:
                if not entry:
                    continue
                duration = entry.get('duration') or 0
                is_live = bool(entry.get('is_live'))
                is_too_long = duration > MAX_DURATION_SECONDS
                mins, secs = divmod(int(duration), 60)
                duration_str = "LIVE" if is_live else f"{mins:02d}:{secs:02d}"
                items.append({
                    'id': entry.get('id'),
                    'title': clean_song_title(entry.get('title', 'Unknown Title')),
                    'url': entry.get('webpage_url') or f"https://www.youtube.com/watch?v={entry.get('id')}",
                    'duration': duration,
                    'duration_str': duration_str,
                    'is_live': is_live,
                    'is_too_long': is_too_long,
                    'thumbnail': f"https://i.ytimg.com/vi/{entry.get('id')}/hqdefault.jpg",
                })
            return {
                'type': 'playlist',
                'title': info.get('title', 'YouTube Playlist'),
                'total_items': len(items),
                'items': items,
            }
        else:
            duration = info.get('duration') or 0
            is_live = bool(info.get('is_live'))
            is_too_long = duration > MAX_DURATION_SECONDS
            mins, secs = divmod(int(duration), 60)
            duration_str = "LIVE" if is_live else f"{mins:02d}:{secs:02d}"
            
            thumbnails = info.get('thumbnails') or []
            thumbnail_url = thumbnails[-1]['url'] if thumbnails else f"https://i.ytimg.com/vi/{info.get('id')}/hqdefault.jpg"
            
            return {
                'type': 'video',
                'id': info.get('id'),
                'title': clean_song_title(info.get('title', 'Unknown Title')),
                'url': info.get('webpage_url') or url,
                'duration': duration,
                'duration_str': duration_str,
                'is_live': is_live,
                'is_too_long': is_too_long,
                'channel': info.get('uploader') or '',
                'thumbnail': thumbnail_url,
            }

def download_audio_as_mp3(url: str, output_dir: str) -> Dict[str, str]:
    """
    Downloads audio and converts it to 192kbps MP3 via ffmpeg
    Returns dictionary with file_path and title
    """
    # Unique template in output_dir
    out_template = os.path.join(output_dir, '%(id)s.%(ext)s')
    
    opts = get_base_ydl_opts()
    opts.update({
        'format': 'bestaudio/best',
        'outtmpl': out_template,
        'noplaylist': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    })
    
    with yt_dlp.YoutubeDL(opts) as ydl:
        try:
            # Check duration and live status before downloading
            meta = ydl.extract_info(url, download=False)
            if not meta:
                raise ValueError("ไม่สามารถเข้าถึงวิดีโอนี้ได้ หรือวิดีโอถูกตั้งค่าเป็นส่วนตัว")
            
            if meta.get('is_live'):
                raise ValueError("ไม่รองรับการดาวน์โหลดวิดีโอที่เป็นการถ่ายทอดสด (Live Stream)")
            
            duration = meta.get('duration') or 0
            if duration > MAX_DURATION_SECONDS:
                raise ValueError("วิดีโอนี้มีความยาวเกิน 20 นาที รองรับเฉพาะเพลงความยาวปกติสำหรับการใส่แฟลชไดร์ฟ")
            
            info = ydl.extract_info(url, download=True)
        except Exception as err:
            print(f"yt-dlp error: {err}")
            raise err

        if not info:
            raise ValueError("ไม่สามารถสกัดเสียงได้: วิดีโอไม่พร้อมใช้งานหรือถูกจำกัดสิทธิ์")
            
        video_id = info.get('id')
        title = clean_song_title(info.get('title', 'song'))
        mp3_path = os.path.join(output_dir, f"{video_id}.mp3")
        
        if not os.path.exists(mp3_path):
            # Check if name is formatted differently
            potential_file = [f for f in os.listdir(output_dir) if f.endswith('.mp3')]
            if potential_file:
                mp3_path = os.path.join(output_dir, potential_file[0])
            else:
                raise FileNotFoundError("การแปลงไฟล์ล้มเหลว: ไม่พบไฟล์ MP3 ที่สร้างขึ้น")
                
        return {
            'file_path': mp3_path,
            'title': title,
            'filename': f"{title}.mp3"
        }
