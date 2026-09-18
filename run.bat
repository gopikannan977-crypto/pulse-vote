@echo off
title PulseVote Runner
echo ===================================================
echo   Starting PulseVote Live Polling Studio...
echo ===================================================

cd /d "c:\Users\ELCOT\Downloads\pulsevote-live-polling-studio\live-polling-studio"

:: Free port 8080 if already in use
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

start "PulseVote Backend" cmd /k "node dev-server.js"
start "PulseVote Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Servers started!
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8080
echo.
timeout /t 3 >nul
start http://localhost:5173
