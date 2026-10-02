# Music Sorter YouTube Audio Backend

Microservice สำหรับค้นหาและดึงเสียง MP3 (192kbps) จาก YouTube สำหรับแอปพลิเคชัน [Music Sorter & Trimmer for Flash Drive](https://music.plazedez.online)

---

## ตัวเลือกการ Deploy ฟรี 100% (เลือกอย่างใดอย่างหนึ่ง)

### ตัวเลือกที่ 1: Deploy บน Render.com (ฟรี 100% ไม่ต้องผูกบัตรเครดิต) ⭐ แนะนำที่สุด

1. สมัครใช้งานที่ [render.com](https://render.com) (เข้าสู่ระบบด้วย GitHub)
2. กด **New +** ที่มุมขวาบน -> เลือก **Web Service**
3. เลือก Repository GitHub `Music_sorter_in_flashdrive`
4. ตั้งค่าดังนี้:
   * **Name:** `music-sorter-api` (หรือชื่อใดก็ได้)
   * **Root Directory:** `backend`
   * **Environment / Runtime:** `Docker`
   * **Instance Type:** `Free` ($0/month)
5. กด **Deploy Web Service**
6. รอประมาณ 2-3 นาที จะได้ URL เช่น `https://music-sorter-api.onrender.com`
7. นำ URL ไปใส่ในหน้าเว็บแอปพลิเคชันที่แถบ **"การเชื่อมต่อ Server"**

---

### ตัวเลือกที่ 2: รันในเครื่องของตนเอง (Localhost - ฟรี 100% เร็วที่สุด)

หากต้องการใช้งานคนเดียวบนคอมพิวเตอร์ สามารถรันได้โดยตรง ไม่ต้องผ่านอินเทอร์เน็ต:

```bash
# 1. เข้าโฟลเดอร์ backend
cd backend

# 2. ติดตั้ง Dependencies (ต้องการ Python 3.10+ และ ffmpeg ในเครื่อง)
pip install -r requirements.txt

# 3. เริ่มรันเซิร์ฟเวอร์
python main.py
```

เซิร์ฟเวอร์จะเปิดที่ `http://localhost:7860` สามารถนำไปใส่ในหน้าเว็บแอปได้ทันที

---

## API Endpoints

- `GET /api/health` - ตรวจสอบสถานะ Server
- `GET /api/search?q={query}&limit=10` - ค้นหาเพลงจาก YouTube
- `GET /api/info?url={youtube_url}` - ดึงข้อมูลวิดีโอหรือ Playlist
- `GET /api/download?url={youtube_url}` - ดาวน์โหลดและแปลงเป็น MP3 (192kbps)
