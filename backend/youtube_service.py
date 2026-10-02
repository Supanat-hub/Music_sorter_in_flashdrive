import os
import re
import tempfile
import yt_dlp
from typing import List, Dict, Any, Optional

import base64

COOKIE_ENV_VAR = "YOUTUBE_COOKIES"

_cached_cookie_path: Optional[str] = None

def get_cookie_file_path() -> Optional[str]:
    """
    Check if YOUTUBE_COOKIES environment variable is provided.
    If provided, normalize newlines, handle base64 if prefixed,
    ensure Netscape header, write to a temp file and return the path (cached).
    """
    global _cached_cookie_path
    if _cached_cookie_path and os.path.exists(_cached_cookie_path):
        return _cached_cookie_path

    cookies_content = os.getenv(COOKIE_ENV_VAR)
    if not cookies_content or not cookies_content.strip():
        return None
    
    cookies_content = cookies_content.strip()

    # Check if it's already a valid file path
    if os.path.isfile(cookies_content):
        _cached_cookie_path = cookies_content
        return _cached_cookie_path
    
    # Handle base64 encoded cookies
    if cookies_content.startswith("base64:"):
        try:
            cookies_content = base64.b64decode(cookies_content[7:]).decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"Error decoding base64 cookie: {e}", flush=True)
    elif "\\n" in cookies_content and "\n" not in cookies_content:
        # Unescape literal \n into real newlines
        cookies_content = cookies_content.replace("\\n", "\n")
        
    # Ensure standard Netscape header is present for yt-dlp cookie parser
    if not cookies_content.startswith("# Netscape") and not cookies_content.startswith("# HTTP"):
        cookies_content = "# Netscape HTTP Cookie File\n" + cookies_content

    # Write normalized cookie file
    temp_cookie = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt", encoding="utf-8")
    temp_cookie.write(cookies_content)
    temp_cookie.close()
    _cached_cookie_path = temp_cookie.name
    print(f"Created sanitized cookie file at {_cached_cookie_path} (length={len(cookies_content)} bytes)", flush=True)
    return _cached_cookie_path

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

def get_base_ydl_opts(use_cookies: bool = True) -> dict:
    """
    Base configuration for yt-dlp to maximize bypass capabilities on cloud/datacenter IPs.
    Prioritizes modern visionos and android clients to extract pure audio without bot verification.
    """
    cookie_path = get_cookie_file_path() if use_cookies else None
    
    clients = ['visionos', 'android', 'default']
    
    opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'logtostderr': False,
        'extractor_args': {
            'youtube': {
                'player_client': clients,
            }
        },
    }
    if cookie_path:
        opts['cookiefile'] = cookie_path
    return opts

MAX_DURATION_SECONDS = 1200 # 20 minutes max per track

def search_youtube(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search YouTube videos matching query
    """
    has_cookies = bool(get_cookie_file_path())

    def execute_search(use_cookies: bool):
        opts = get_base_ydl_opts(use_cookies=use_cookies)
        opts['extract_flat'] = 'in_playlist'
        opts['ignoreerrors'] = True
        search_query = f"ytsearch{limit}:{query}"
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(search_query, download=False)

    try:
        info = execute_search(use_cookies=has_cookies)
    except Exception as first_err:
        if has_cookies:
            print(f"Search failed with cookies, retrying without cookies: {first_err}")
            info = execute_search(use_cookies=False)
        else:
            raise first_err

    if not info or 'entries' not in info:
        return []
    
    results = []
    for entry in info['entries']:
        if not entry:
            continue
        
        entry_id = str(entry.get('id') or '')
        # Skip channel or user URLs
        if entry.get('_type') == 'url' and ('channel/' in entry.get('url', '') or 'user/' in entry.get('url', '')):
            continue
        if entry_id.startswith('UC') and len(entry_id) == 24:
            continue
        
        duration = entry.get('duration') or 0
        is_live = bool(entry.get('is_live'))
        is_too_long = duration > MAX_DURATION_SECONDS
        mins, secs = divmod(int(duration), 60)
        duration_str = "LIVE" if is_live else f"{mins:02d}:{secs:02d}"
        
        # Best thumbnail
        thumbnails = entry.get('thumbnails') or []
        thumbnail_url = thumbnails[-1]['url'] if thumbnails else f"https://i.ytimg.com/vi/{entry_id}/hqdefault.jpg"
        
        results.append({
            'id': entry_id,
            'title': clean_song_title(entry.get('title', 'Unknown Title')),
            'original_title': entry.get('title'),
            'url': entry.get('webpage_url') or f"https://www.youtube.com/watch?v={entry_id}",
            'duration': duration,
            'duration_str': duration_str,
            'is_live': is_live,
            'is_too_long': is_too_long,
            'channel': entry.get('uploader') or entry.get('channel') or '',
            'thumbnail': thumbnail_url,
            'source': 'youtube',
        })
            
    return results

def search_soundcloud(query: str, limit: int = 12) -> List[Dict[str, Any]]:
    """
    Search SoundCloud tracks for non-copyright remixes, dance, and DJ sets.
    SoundCloud has no bot-detection block on datacenter/cloud IPs.
    """
    opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': 'in_playlist',
        'ignoreerrors': True,
        'nocheckcertificate': True,
    }
    search_query = f"scsearch{limit}:{query}"
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(search_query, download=False)
    except Exception as e:
        print(f"SoundCloud search error: {e}", flush=True)
        return []

    if not info or 'entries' not in info:
        return []

    results = []
    for entry in info['entries']:
        if not entry:
            continue
        duration = entry.get('duration') or 0
        mins, secs = divmod(int(duration), 60)
        duration_str = f"{mins:02d}:{secs:02d}"

        thumbnails = entry.get('thumbnails') or []
        thumbnail_url = thumbnails[-1]['url'] if thumbnails else ''
        if not thumbnail_url:
            thumbnail_url = 'https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico'

        web_url = entry.get('webpage_url') or entry.get('url')
        title = clean_song_title(entry.get('title', 'Unknown Title'))

        results.append({
            'id': str(entry.get('id')),
            'title': title,
            'original_title': entry.get('title'),
            'url': web_url,
            'duration': duration,
            'duration_str': duration_str,
            'is_live': False,
            'is_too_long': duration > MAX_DURATION_SECONDS,
            'channel': entry.get('uploader') or 'SoundCloud DJ',
            'thumbnail': thumbnail_url,
            'source': 'soundcloud',
        })
    return results

def get_url_info(url: str) -> Dict[str, Any]:
    """
    Inspect URL to determine if it is a single video or a playlist (YouTube or SoundCloud)
    """
    is_soundcloud = 'soundcloud.com' in url.lower()
    
    if is_soundcloud:
        opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': 'in_playlist',
            'nocheckcertificate': True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    else:
        has_cookies = bool(get_cookie_file_path())

        def execute_info(use_cookies: bool):
            opts = get_base_ydl_opts(use_cookies=use_cookies)
            opts['extract_flat'] = 'in_playlist'
            with yt_dlp.YoutubeDL(opts) as ydl:
                return ydl.extract_info(url, download=False)

        try:
            info = execute_info(use_cookies=has_cookies)
        except Exception as first_err:
            if has_cookies:
                print(f"Info inspection failed with cookies, retrying without cookies: {first_err}")
                info = execute_info(use_cookies=False)
            else:
                raise first_err

    if not info:
        raise ValueError("ไม่พบข้อมูลเพลง กรุณาตรวจสอบว่าลิงก์ถูกต้องและเป็นสาธารณะ")
        
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
            thumbnails = entry.get('thumbnails') or []
            thumb = thumbnails[-1]['url'] if thumbnails else f"https://i.ytimg.com/vi/{entry.get('id')}/hqdefault.jpg"
            items.append({
                'id': str(entry.get('id')),
                'title': clean_song_title(entry.get('title', 'Unknown Title')),
                'url': entry.get('webpage_url') or entry.get('url'),
                'duration': duration,
                'duration_str': duration_str,
                'is_live': is_live,
                'is_too_long': is_too_long,
                'thumbnail': thumb,
                'source': 'soundcloud' if is_soundcloud else 'youtube',
            })
        return {
            'type': 'playlist',
            'title': info.get('title', 'Playlist'),
            'total_items': len(items),
            'items': items,
            'source': 'soundcloud' if is_soundcloud else 'youtube',
        }
    else:
        duration = info.get('duration') or 0
        is_live = bool(info.get('is_live'))
        is_too_long = duration > MAX_DURATION_SECONDS
        mins, secs = divmod(int(duration), 60)
        duration_str = "LIVE" if is_live else f"{mins:02d}:{secs:02d}"
        
        thumbnails = info.get('thumbnails') or []
        thumbnail_url = thumbnails[-1]['url'] if thumbnails else (
            info.get('thumbnail') or f"https://i.ytimg.com/vi/{info.get('id')}/hqdefault.jpg"
        )
        
        return {
            'type': 'video',
            'id': str(info.get('id')),
            'title': clean_song_title(info.get('title', 'Unknown Title')),
            'url': info.get('webpage_url') or url,
            'duration': duration,
            'duration_str': duration_str,
            'is_live': is_live,
            'is_too_long': is_too_long,
            'channel': info.get('uploader') or '',
            'thumbnail': thumbnail_url,
            'source': 'soundcloud' if is_soundcloud else 'youtube',
        }

def download_audio_as_mp3(url: str, output_dir: str) -> Dict[str, str]:
    """
    Downloads audio and converts it to 192kbps MP3 via ffmpeg
    Returns dictionary with file_path and title
    """
    out_template = os.path.join(output_dir, '%(id)s.%(ext)s')
    is_soundcloud = 'soundcloud.com' in url.lower()

    if is_soundcloud:
        opts = {
            'quiet': True,
            'no_warnings': True,
            'format': 'bestaudio/best',
            'outtmpl': out_template,
            'noplaylist': True,
            'nocheckcertificate': True,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            meta = ydl.extract_info(url, download=False)
            if not meta:
                raise ValueError("ไม่พบข้อมูลเพลงจาก SoundCloud")
            duration = meta.get('duration') or 0
            if duration > MAX_DURATION_SECONDS:
                raise ValueError("เพลงนี้มีความยาวเกิน 20 นาที รองรับเฉพาะเพลงความยาวปกติสำหรับการใส่แฟลชไดร์ฟ")
            info = ydl.extract_info(url, download=True)
    else:
        has_cookies = bool(get_cookie_file_path())

        def try_download(use_cookies: bool, client_list: list = None) -> Any:
            opts = get_base_ydl_opts(use_cookies=use_cookies)
            if client_list:
                opts['extractor_args'] = {'youtube': {'player_client': client_list}}
            opts.update({
                'format': 'ba/bestaudio/b[height<=360]/b',
                'outtmpl': out_template,
                'noplaylist': True,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
            with yt_dlp.YoutubeDL(opts) as ydl:
                # Check duration and live status before downloading
                meta = ydl.extract_info(url, download=False)
                if not meta:
                    raise ValueError("ไม่สามารถเข้าถึงวิดีโอนี้ได้ หรือวิดีโอถูกตั้งค่าเป็นส่วนตัว")
                
                if meta.get('is_live'):
                    raise ValueError("ไม่รองรับการดาวน์โหลดวิดีโอที่เป็นการถ่ายทอดสด (Live Stream)")
                
                duration = meta.get('duration') or 0
                if duration > MAX_DURATION_SECONDS:
                    raise ValueError("วิดีโอนี้มีความยาวเกิน 20 นาที รองรับเฉพาะเพลงความยาวปกติสำหรับการใส่แฟลชไดร์ฟ")
                
                return ydl.extract_info(url, download=True)

        info = None
        # Try modern visionos/android without cookies first (most reliable on datacenter/cloud IPs)
        try:
            info = try_download(use_cookies=False, client_list=['visionos', 'android', 'default'])
        except Exception as first_err:
            print(f"yt-dlp first attempt error (no cookies, visionos): {first_err}", flush=True)
            if has_cookies:
                print("Retrying download with cookies...", flush=True)
                try:
                    info = try_download(use_cookies=True, client_list=['web', 'android', 'default'])
                except Exception as second_err:
                    print(f"yt-dlp cookie attempt error: {second_err}", flush=True)
                    try:
                        info = try_download(use_cookies=False, client_list=['android'])
                    except Exception as third_err:
                        raise third_err
            else:
                try:
                    info = try_download(use_cookies=False, client_list=['android'])
                except Exception as fallback_err:
                    raise fallback_err

    if not info:
        raise ValueError("ไม่สามารถสกัดเสียงได้: ไฟล์ไม่พร้อมใช้งานหรือถูกจำกัดสิทธิ์")
        
    video_id = info.get('id')
    title = clean_song_title(info.get('title', 'song'))
    mp3_path = os.path.join(output_dir, f"{video_id}.mp3")
    
    if not os.path.exists(mp3_path):
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
