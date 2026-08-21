@echo off
chcp 65001 >nul
title Telegram Bot - Mydentclinic
color 0B

echo.
echo ==============================================
echo   TELEGRAM BOT ISHGA TUSHIRISH
echo ==============================================
echo.

set "NODE_DIR=%~dp0.node\node-v22.14.0-win-x64"
set "PATH=%NODE_DIR%;%PATH%"

cd /d "%~dp0"

if not exist "backend\.env" (
  echo ❌ backend\.env topilmadi
  pause
  exit /b 1
)

echo 🤖 Bot ishga tushirilmoqda...
echo    Token: backend\.env dan olinadi
echo    Bu oyna ochiq turishi kerak!
echo.

node scripts\telegram-bot-standalone.mjs

pause
