@echo off
cd /d "%~dp0"
echo ========================================================
echo    Mempersiapkan Deploy Rekap Kamera ke Vercel...
echo ========================================================
echo.
echo Pastikan Anda sudah login ke akun Vercel (atau login via browser jika diminta).
echo.
npx vercel
echo.
pause
