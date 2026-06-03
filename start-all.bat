@echo off
chcp 65001 >nul
title D2C - 全部服务

set "SCRIPTS_DIR=%~dp0scripts"

echo ============================================
echo   D2C - Design to Code 平台
echo ============================================
echo.

echo [1/3] 启动后端 API 服务...
start "D2C-Backend" cmd /k "cd /d "%SCRIPTS_DIR%" && call start-backend.bat"

echo [2/3] 启动 Agent 服务...
start "D2C-Agent" cmd /k "cd /d "%SCRIPTS_DIR%" && call start-agent.bat"

echo [3/3] 启动前端 (Next.js)...
start "D2C-Frontend" cmd /k "cd /d "%SCRIPTS_DIR%" && call start-frontend.bat"

echo.
echo ============================================
echo   全部服务正在启动...
echo.
echo   前端    : http://localhost:3000
echo   后端    : http://localhost:8080
echo   API文档 : http://localhost:8080/docs
echo   Agent   : http://localhost:8081
echo.
echo   关闭各 CMD 窗口即可停止对应服务
echo ============================================
echo.
pause
