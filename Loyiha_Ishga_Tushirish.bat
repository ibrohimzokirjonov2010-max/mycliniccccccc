@echo off
set PATH=%~dp0.node\node-v22.14.0-win-x64;%PATH%
echo ==============================================
echo Klinika Asosiy Sayti va Super Admin paneliga xush kelibsiz!
echo ==============================================
echo.
echo Loyiha ishga tushirilmoqda. Iltimos kuting...
echo.

:: Npm buyrug'ini ishga tushirish (bu foydalanuvchining muhitida muammosiz ishlashi kerak)
start "Klinika Dasturini Ishga Tushirish" cmd /k "npm run dev"

echo Dastur ishga tushirildi!
echo ----------------------------------------------
echo - Asosiy Sayt: http://localhost:5173
echo - Super Admin Panel: http://localhost:5173/super-admin-portal
echo ----------------------------------------------
echo.
echo Dasturni to'xtatish uchun qora oynani (terminalni) yopishingiz mumkin.
pause
