@echo off
cd /d "%~dp0"
echo ===================================================
echo   Memulai Rekap Durasi File .enc Kamera Web App
echo ===================================================
start http://localhost:8000/index.html
python server.py
pause
