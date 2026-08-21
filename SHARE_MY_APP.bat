@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
set PATH=%~dp0.node\node-v22.14.0-win-x64;%PATH%

echo =======================================================
echo 🚀 PROFESSIONAL LIVE SHARE SYSTEM (Senior Dev Mode)
echo =======================================================
echo.

:: Vite config'dan portni aniqlaymiz (default 5175)
set PORT=5175

echo [1/3] Loyihani tekshirilmoqda...
echo Port: %PORT%...

:: Portni egallanganligini tekshirish
netstat -ano | findstr :%PORT% >nul
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  OGOHLANTIRISH: Sayt hozircha %PORT%-portda ishlamayapti!
    echo Iltimos, avval loyihani ishga tushiring (npm run dev).
    echo.
    pause
    exit /b
)

echo ✅ Sayt mahalliylashtirilgan va ishlamoqda.
echo.
echo [2/3] Xavfsiz tunnel (SSH Bridge) yaratilmoqda...
echo.
echo -------------------------------------------------------
echo 💡 KO'RSATMA:
echo 1. Quyida paydo bo'ladigan 'url:' havolasini nusxalang.
echo 2. Uni telefoningizga yoki boshqa shahar/davlatdagi hamkoringizga yuboring.
echo 3. Sayt o'z-o'zidan yangilanadi (HMR ishlaydi).
echo -------------------------------------------------------
echo.

:: Tunnelni professional va bepul yo'l bilan ochish (Localtunnel)
:: Bu usul Ngrok'dan ko'ra qulayroq (limited emas)
npx localtunnel --port %PORT%

if %errorlevel% neq 0 (
    echo.
    echo ❌ Xatolik yuz berdi. Balki Node.js o'rnatilmagandir?
    echo Muqobil variant sifatida Ngrok ishlatib ko'ring.
    pause
)

echo.
echo [3/3] Tunnel yopildi.
pause
