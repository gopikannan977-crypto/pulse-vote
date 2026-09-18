@echo off
title PulseVote Live Public Internet Hosting (Cloudflare Tunnel)
color 0B
echo =================================================================
echo   PULSEVOTE - LIVE PUBLIC INTERNET HOSTING (NO LOCALHOST)
echo =================================================================
echo.

cd /d "%~dp0"

:: Check if port 8080 is already running, if not start it
netstat -aon | findstr ":8080" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo [1/2] Starting PulseVote Unified Fullstack Server on Port 8080...
    start "PulseVote Backend & Frontend (8080)" cmd /k "node dev-server.js"
    timeout /t 3 >nul
) else (
    echo [1/2] PulseVote Server is already active on Port 8080.
)

echo.
echo [2/2] Launching Fast Cloudflare Public Tunnel...
echo =================================================================
echo  Generating your 100%% Free, Global Public Link (trycloudflare)...
echo  Anyone on Mobile / PC anywhere in the world can vote live!
echo =================================================================
echo.

if exist ".\cloudflared.exe" (
    .\cloudflared.exe tunnel --url http://localhost:8080
) else (
    echo Cloudflared not found locally, falling back to npx localtunnel...
    npx -y localtunnel --port 8080
)

pause
