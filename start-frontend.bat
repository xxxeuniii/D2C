@echo off
chcp 65001 >nul
title D2C Frontend (Next.js)

echo ============================================
echo   D2C Frontend - Next.js 14 Dev Server
echo ============================================
echo.

cd /d "%~dp0..\apps\web"

REM 检查 node_modules 是否存在
if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    call npm install
    echo.
)

echo [INFO] Starting Next.js dev server...
echo [INFO] URL: http://localhost:3000
echo [INFO] Press Ctrl+C to stop
echo.

call npm run dev
pause
