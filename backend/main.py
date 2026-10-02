import os
import shutil
import tempfile
import urllib.parse
from urllib.parse import urlparse
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import subprocess
import yt_dlp
from youtube_service import (
    search_youtube,
    get_url_info,
    download_audio_as_mp3,
    get_cookie_file_path,
    get_base_ydl_opts,
    COOKIE_ENV_VAR,
)

app = FastAPI(
    title="Music Sorter YouTube Audio Backend",
    description="Backend service for searching and downloading MP3 audio from YouTube",
    version="1.0.4"
)

# Enable CORS for all origins (allows local dev and production domain)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Audio-Title", "Content-Length"]
)

ALLOWED_YOUTUBE_HOSTS = {
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
}

def validate_youtube_url(url_str: str) -> str:
    """
    Validate that the URL belongs to legitimate YouTube domains to prevent SSRF
    """
    if not url_str or not url_str.strip():
        raise HTTPException(status_code=400, detail="กรุณาระบุลิงก์ YouTube")
    
    url_str = url_str.strip()
    try:
        parsed = urlparse(url_str)
        if parsed.scheme not in ('http', 'https'):
            raise ValueError("URL ต้องขึ้นต้นด้วย http:// หรือ https://")
        
        hostname = (parsed.hostname or '').lower()
        clean_host = hostname.removeprefix('www.')
        
        if hostname not in ALLOWED_YOUTUBE_HOSTS and clean_host not in ALLOWED_YOUTUBE_HOSTS and not hostname.endswith('.youtube.com'):
            raise ValueError("ระบบรองรับเฉพาะลิงก์จาก YouTube เท่านั้น (youtube.com หรือ youtu.be)")
            
        return url_str
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class DownloadRequest(BaseModel):
    url: str

def cleanup_temp_dir(dir_path: str):
    """
    Remove temporary folder after sending file to avoid disk filling up
    """
    try:
        if os.path.exists(dir_path):
            shutil.rmtree(dir_path)
    except Exception as e:
        print(f"Error cleaning up temp directory {dir_path}: {e}", flush=True)

@app.get("/")
@app.get("/api/health")
def health_check():
    raw_cookie = os.getenv(COOKIE_ENV_VAR, "")
    node_version = "not_found"
    try:
        res = subprocess.run(["node", "-v"], capture_output=True, text=True, timeout=2)
        if res.returncode == 0:
            node_version = res.stdout.strip()
    except Exception:
        pass

    cookie_file = get_cookie_file_path()
    cookie_keys = []
    if cookie_file and os.path.exists(cookie_file):
        try:
            with open(cookie_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("#") or not line.strip():
                        continue
                    parts = line.strip().split("\t")
                    if len(parts) >= 6:
                        cookie_keys.append(parts[5])
        except Exception:
            pass

    return {
        "status": "ok",
        "service": "music-sorter-youtube-api",
        "version": "1.0.6",
        "has_cookies": bool(raw_cookie.strip()),
        "cookie_length": len(raw_cookie.strip()),
        "cookie_file_ready": bool(cookie_file),
        "cookie_keys": cookie_keys[:15],
        "total_cookie_entries": len(cookie_keys),
        "node_version": node_version,
    }

@app.get("/api/debug_formats")
def debug_formats(url: str = Query(...)):
    validated_url = validate_youtube_url(url)
    out = {}
    
    # 1. Try with cookies
    try:
        opts1 = get_base_ydl_opts(use_cookies=True)
        with yt_dlp.YoutubeDL(opts1) as ydl:
            meta1 = ydl.extract_info(validated_url, download=False)
            out["with_cookies"] = {
                "success": True,
                "title": meta1.get("title"),
                "formats": [f"{f.get('format_id')}: ext={f.get('ext')}, vcodec={f.get('vcodec')}, acodec={f.get('acodec')}, url={'yes' if f.get('url') else 'no'}" for f in meta1.get("formats", [])]
            }
    except Exception as e1:
        out["with_cookies"] = {"success": False, "error": str(e1)}
        
    # 2. Try android client
    try:
        opts2 = {
            'quiet': True,
            'extractor_args': {'youtube': {'player_client': ['android']}}
        }
        with yt_dlp.YoutubeDL(opts2) as ydl:
            meta2 = ydl.extract_info(validated_url, download=False)
            out["android_nocookies"] = {
                "success": True,
                "title": meta2.get("title"),
                "formats": [f"{f.get('format_id')}: ext={f.get('ext')}, vcodec={f.get('vcodec')}, acodec={f.get('acodec')}, url={'yes' if f.get('url') else 'no'}" for f in meta2.get("formats", [])]
            }
    except Exception as e2:
        out["android_nocookies"] = {"success": False, "error": str(e2)}

    # 3. Try ios client
    try:
        opts3 = {
            'quiet': True,
            'extractor_args': {'youtube': {'player_client': ['ios']}}
        }
        with yt_dlp.YoutubeDL(opts3) as ydl:
            meta3 = ydl.extract_info(validated_url, download=False)
            out["ios_nocookies"] = {
                "success": True,
                "title": meta3.get("title"),
                "formats": [f"{f.get('format_id')}: ext={f.get('ext')}, vcodec={f.get('vcodec')}, acodec={f.get('acodec')}, url={'yes' if f.get('url') else 'no'}" for f in meta3.get("formats", [])]
            }
    except Exception as e3:
        out["ios_nocookies"] = {"success": False, "error": str(e3)}

    return out

@app.get("/api/search")
def search(q: str = Query(..., description="Search query string"), limit: int = Query(10, ge=1, le=20)):
    if not q.strip():
        raise HTTPException(status_code=400, detail="คำค้นหาต้องไม่ว่างเปล่า")
    try:
        results = search_youtube(q.strip(), limit=limit)
        return {"query": q, "results": results}
    except Exception as e:
        print(f"Search error: {e}", flush=True)
        raise HTTPException(status_code=500, detail="ระบบค้นหาขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง")

@app.get("/api/info")
def get_info(url: str = Query(..., description="YouTube video or playlist URL")):
    validated_url = validate_youtube_url(url)
    try:
        info = get_url_info(validated_url)
        return info
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"Info inspection error: {e}", flush=True)
        raise HTTPException(status_code=400, detail=f"ไม่สามารถดึงข้อมูลเพลงได้: {str(e)[:120]}")

@app.post("/api/download")
def download_audio_post(req: DownloadRequest, background_tasks: BackgroundTasks):
    return process_download(req.url, background_tasks)

@app.get("/api/download")
def download_audio_get(url: str = Query(..., description="YouTube URL"), background_tasks: BackgroundTasks = None):
    return process_download(url, background_tasks)

def process_download(url: str, background_tasks: BackgroundTasks):
    validated_url = validate_youtube_url(url)
    
    # Create temporary working directory for this download
    temp_dir = tempfile.mkdtemp(prefix="yt_audio_")
    
    try:
        result = download_audio_as_mp3(validated_url, temp_dir)
        file_path = result['file_path']
        title = result['title']
        filename = result['filename']
        
        # Schedule cleanup after response finishes
        if background_tasks:
            background_tasks.add_task(cleanup_temp_dir, temp_dir)
            
        # Encode Thai/Unicode filename properly for Content-Disposition (RFC 5987)
        encoded_filename = urllib.parse.quote(filename)
        content_disposition = f"attachment; filename=\"song.mp3\"; filename*=UTF-8''{encoded_filename}"
        
        return FileResponse(
            path=file_path,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": content_disposition,
                "X-Audio-Title": urllib.parse.quote(title),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Audio-Title, Content-Length"
            }
        )
    except ValueError as ve:
        cleanup_temp_dir(temp_dir)
        print(f"Validation error: {ve}", flush=True)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Cleanup immediately if error occurred before response
        cleanup_temp_dir(temp_dir)
        error_msg = str(e)
        print(f"CRITICAL DOWNLOAD ERROR: {error_msg}", flush=True)
        if "Private video" in error_msg:
            detail = "วิดีโอนี้เป็นแบบส่วนตัว ไม่สามารถดาวน์โหลดได้"
        elif "Sign in to confirm you’re not a bot" in error_msg or "Sign in" in error_msg:
            detail = "YouTube ตรวจพบบ็อต: เซิร์ฟเวอร์ไม่สามารถยืนยันตัวตนได้ กรุณาตรวจสอบการตั้งค่าคุกกี้"
        elif "This video is not available" in error_msg:
            detail = "ไม่พบวิดีโอนี้ในระบบ YouTube"
        elif "Requested format is not available" in error_msg:
            detail = "ไม่พบรูปแบบไฟล์เสียงที่พร้อมดาวน์โหลดสำหรับวิดีโอนี้"
        else:
            detail = f"ดาวน์โหลดไม่สำเร็จ: {error_msg[:100]}"
        raise HTTPException(status_code=500, detail=detail)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
