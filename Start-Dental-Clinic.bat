@echo off
chcp 65001 >nul
set PATH=%~dp0.node\node-v22.14.0-win-x64;%PATH%
title DENTAL CLINIC - Ishga Tushirish
color 0A

echo.
echo ==============================================
echo   🦷 DENTAL CLINIC MANAGEMENT SYSTEM
echo   TO'LIQ ISHGA TUSHIRISH
echo ==============================================
echo.

:: Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  DIQQAT: Docker o'rnatilmagan!
    echo.
    echo Docker Desktop yuklab oling: https://www.docker.com/products/docker-desktop
    echo.
    echo Yoki quyidagi fayllardan birini ishga tushiring:
    echo   - Start-Backend-Only.bat  (faqat backend)
    echo   - Start-Frontend-Only.bat (faqat frontend)
    echo.
    pause
    exit /b 1
)

echo [1/3] MongoDB va Redis ishga tushirilmoqda...
echo.

cd backend

:: Start MongoDB and Redis with Docker
docker-compose up -d mongodb redis

if %errorlevel% equ 0 (
    echo ✅ MongoDB va Redis ishga tushdi
) else (
    echo ❌ Xatolik yuz berdi!
    pause
    exit /b 1
)

echo.
echo MongoDB tayyor bo'lishini kutish (5 soniya)...
timeout /t 5 /nobreak >nul

echo.
echo [2/3] Backend API ishga tushirilmoqda...
echo.

:: Update .env if needed
if not exist .env (
    echo ⚠️  .env fayli yaratilmoqda...
    copy .env.example .env >nul
)

start "🦷 Backend Server - Port 3000" cmd /k "npm run start:dev"

echo Backend ishga tushmoqda... Kuting...
timeout /t 8 /nobreak >nul

cd ..

echo.
echo [3/3] Frontend ishga tushirilmoqda...
echo.
start "🌐 Frontend - Port 5173" cmd /k "npm run dev"

echo.
timeout /t 3 /nobreak >nul

cls
echo.
echo ==============================================
echo   ✅ MUVAFFAQIYATLI ISHGA TUSHDI!
echo ==============================================
echo.
echo   📊 Backend API:     http://localhost:3000
echo   📚 Swagger Docs:    http://localhost:3000/api/docs
echo   🌐 Frontend App:    http://localhost:5173
echo.
echo ==============================================
echo   🗄️  Database:       MongoDB (Docker)
echo   💾 Cache:           Redis (Docker)
echo ==============================================
echo.
echo   To'xtatish uchun:
echo   1. Barcha terminal oynalarini yoping
echo   2. Docker: docker-compose down
echo.
echo ==============================================
echo.
pause
