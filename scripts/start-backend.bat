@echo off
chcp 65001 >nul
title D2C Backend Server

echo ============================================
echo   D2C Backend - API Server
echo ============================================
echo.

cd /d "%~dp0..\apps\server"

REM 检查 Python 虚拟环境
if not exist "venv\" (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
    echo.
)

REM 激活虚拟环境
call venv\Scripts\activate.bat

REM 检查依赖
if not exist "venv\Lib\site-packages\fastapi" (
    echo [INFO] Installing Python dependencies...
    pip install -r requirements.txt
    echo.
)

echo [INFO] Starting API server...
echo [INFO] URL: http://localhost:8080
echo [INFO] API Docs: http://localhost:8080/docs
echo [INFO] Press Ctrl+C to stop
echo.

python main.py
pause
