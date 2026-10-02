import os
import shutil
import tempfile
import urllib.parse
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from youtube_service import search_youtube, get_url_info, download_audio_as_mp3

app = FastAPI(
    title="Music Sorter YouTube Audio Backend",
    description="Backend service for searching and downloading MP3 audio from YouTube",
    version="1.0.0"
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
        print(f"Error cleaning up temp directory {dir_path}: {e}")

@app.get("/")
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "music-sorter-youtube-api",
        "version": "1.0.0"
    }

@app.get("/api/search")
def search(q: str = Query(..., description="Search query string"), limit: int = Query(10, ge=1, le=20)):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    try:
        results = search_youtube(q.strip(), limit=limit)
        return {"query": q, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/api/info")
def get_info(url: str = Query(..., description="YouTube video or playlist URL")):
    if not url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    try:
        info = get_url_info(url.strip())
        return info
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not retrieve video info: {str(e)}")

@app.post("/api/download")
def download_audio_post(req: DownloadRequest, background_tasks: BackgroundTasks):
    return process_download(req.url, background_tasks)

@app.get("/api/download")
def download_audio_get(url: str = Query(..., description="YouTube URL"), background_tasks: BackgroundTasks = None):
    return process_download(url, background_tasks)

def process_download(url: str, background_tasks: BackgroundTasks):
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    
    # Create temporary working directory for this download
    temp_dir = tempfile.mkdtemp(prefix="yt_audio_")
    
    try:
        result = download_audio_as_mp3(url.strip(), temp_dir)
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
    except Exception as e:
        # Cleanup immediately if error occurred before response
        cleanup_temp_dir(temp_dir)
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
