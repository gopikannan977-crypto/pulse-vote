@echo off
title PulseVote Live Polling Launcher
echo ===================================================
echo   Starting PulseVote Live Polling Studio...
echo ===================================================

cd /d "c:\Users\ELCOT\Downloads\pulsevote-live-polling-studio\live-polling-studio"

:: Free port 8080 if already in use by an old process
echo [1/3] Clearing any previous processes on port 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Free port 5173 if needed
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [2/3] Launching PulseVote Backend (Port 8080)...
start "PulseVote Backend (Port 8080)" cmd /k "node dev-server.js"

echo [3/3] Launching PulseVote Frontend (Port 5173)...
start "PulseVote Frontend (Port 5173)" cmd /k "cd frontend && npm run dev"

echo.
echo Waiting for servers to initialize...
timeout /t 3 >nul

echo Opening browser at http://localhost:5173...
start http://localhost:5173

echo.
echo ===================================================
echo  PulseVote Studio is RUNNING!
echo  Frontend:  http://localhost:5173
echo  Backend:   http://localhost:8080
echo  Demo User: demo@pulsevote.io / demo1234
echo ===================================================
echo.
pause
