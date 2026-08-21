@echo off
chcp 65001 >nul
set PATH=%~dp0.node\node-v22.14.0-win-x64;%PATH%
title Frontend - Dental Clinic
color 0D

echo.
echo ==============================================
echo   🌐 FRONTEND ISHGA TUSHIRISH
echo ==============================================
echo.

:: Check if node_modules exists
if not exist node_modules (
    echo 📦 Dependencies o'rnatilmoqda...
    call npm install
    echo.
)

echo 🚀 Frontend ishga tushirilmoqda...
echo.
echo URL: http://localhost:5173
echo.
echo To'xtatish uchun Ctrl+C bosing
echo ==============================================
echo.

npm run dev

pause
