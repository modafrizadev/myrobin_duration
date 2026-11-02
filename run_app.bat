@echo off
cd /d "%~dp0"
python app.py
if %ERRORLEVEL% NEQ 0 pause
