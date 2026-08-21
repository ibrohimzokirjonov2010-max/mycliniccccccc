@echo off
chcp 65001 >nul
set PATH=%~dp0.node\node-v22.14.0-win-x64;%PATH%
title Backend Server - Dental Clinic
color 0B

echo.
echo ==============================================
echo   🦷 BACKEND SERVER ISHGA TUSHIRISH
echo ==============================================
echo.

cd backend

:: Check if .env exists
if not exist .env (
    echo ⚠️  .env fayli topilmadi!
    echo.
    echo .env.example dan nusxa olinmoqda...
    copy .env.example .env
    echo.
    echo DIQQAT: backend\.env faylini tahrirlang va MongoDB connection string ni to'g'rilang!
    echo.
    pause
)

:: Check if node_modules exists
if not exist node_modules (
    echo 📦 Dependencies o'rnatilmoqda...
    call npm install
    echo.
)

echo 🚀 Backend server ishga tushirilmoqda...
echo.
echo Port: 3000
echo API Docs: http://localhost:3000/api/docs
echo.
echo To'xtatish uchun Ctrl+C bosing
echo ==============================================
echo.

npm run start:dev

pause
