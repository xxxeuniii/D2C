@echo off
chcp 65001 >nul
title D2C RAG Worker

echo ============================================
echo   D2C RAG Worker
echo ============================================
echo.

cd /d "%~dp0..\apps\agent"

if not exist "venv\" (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
    echo.
)

call venv\Scripts\activate.bat

if not exist "venv\Lib\site-packages\chromadb" (
    echo [INFO] Installing dependencies...
    pip install -r requirements.txt
    echo.
)

echo [INFO] Starting RAG Worker...
echo [INFO] URL: http://localhost:8081
echo [INFO] Press Ctrl+C to stop
echo.

python agent.py
pause
