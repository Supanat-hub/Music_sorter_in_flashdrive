@echo off
chcp 65001 > nul
title Music Sorter - YouTube Download Service
echo ========================================================
echo   🎵 Music Sorter - YouTube Downloader Local Service
echo ========================================================
echo.
echo กำลังเริ่มต้นบริการดาวน์โหลดเพลงบน http://localhost:7860 ...
echo (เปิดหน้าต่างนี้ไว้ขณะดาวน์โหลดเพลงจาก YouTube ลงแฟลชไดร์ฟ)
echo.
cd /d "%~dp0backend"
python main.py
pause
