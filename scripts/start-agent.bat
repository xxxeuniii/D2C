@echo off
chcp 65001 >nul
title D2C Agent Service

echo ============================================
echo   D2C Agent - AI Agent Service
echo ============================================
echo.

cd /d "%~dp0..\apps\agent"

REM 检查 Python 虚拟环境
if not exist "venv\" (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
    echo.
)

REM 激活虚拟环境
call venv\Scripts\activate.bat

REM 检查依赖
if not exist "venv\Lib\site-packages\langchain" (
    echo [INFO] Installing Agent dependencies...
    pip install -r requirements.txt
    echo.
)

echo [INFO] Starting Agent service...
echo [INFO] URL: http://localhost:8081
echo [INFO] Press Ctrl+C to stop
echo.

python agent.py
pause
