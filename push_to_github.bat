@echo off
cd /d "%~dp0"
echo ========================================================
echo   Pushing myrobin_duration ke GitHub...
echo ========================================================
echo.
echo Jika muncul popup login GitHub di browser, silakan klik
echo 'Sign in with your browser' / 'Authorize'.
echo.
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo   [BERHASIL] Repositori berhasil di-push ke GitHub!
    echo   URL: https://github.com/modafrizadev/myrobin_duration
    echo.
    echo   Langkah Deploy ke Vercel:
    echo   1. Buka https://vercel.com/new
    echo   2. Pilih repositori "myrobin_duration"
    echo   3. Klik tombol "Deploy"
    echo ========================================================
) else (
    echo.
    echo [INFO] Jika autentikasi gagal, pastikan Anda login ke akun
    echo GitHub 'modafrizadev' atau gunakan GitHub Personal Access Token (PAT).
)
echo.
pause
