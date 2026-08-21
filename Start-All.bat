@echo off
chcp 65001 >nul
set PATH=%~dp0.node\node-v22.14.0-win-x64;%PATH%
echo ==============================================
echo 🦷 DENTAL CLINIC - TO'LIQ ISHGA TUSHIRISH
echo ==============================================
echo.
echo [1/4] MongoDB tekshirilmoqda...
echo.

:: Check if MongoDB is running
netstat -ano | findstr :27017 >nul
if %errorlevel% equ 0 (
    echo ✅ MongoDB ishlayapti (port 27017)
) else (
    echo ⚠️  MongoDB o'rnatilmagan yoki ishlamayapti
    echo.
    echo Quyidagi variantlardan birini tanlang:
    echo.
    echo 1. Docker orqali MongoDB ishga tushirish (Tavsiya etiladi)
    echo 2. MongoDB Atlas (Cloud) ishlatish
    echo 3. Local MongoDB o'rnatish
    echo.
    set /p choice="Variantni tanlang (1/2/3): "
    
    if "!choice!"=="1" (
        echo.
        echo Docker orqali MongoDB ishga tushirilmoqda...
        cd backend
        docker-compose up -d mongodb
        if %errorlevel% equ 0 (
            echo ✅ Docker MongoDB ishga tushdi
        ) else (
            echo ❌ Docker o'rnatilmagan. Iltimos, Docker Desktop o'rnating.
            pause
            exit /b 1
        )
        cd ..
    ) else if "!choice!"=="2" (
        echo.
        echo MongoDB Atlas uchun backend\.env faylini tahrirlang:
        echo MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dental-clinic
        pause
    ) else if "!choice!"=="3" (
        echo.
        echo MongoDB yuklab olish: https://www.mongodb.com/try/download/community
        echo O'rnatgandan so'ng ushbu skriptni qayta ishga tushiring
        pause
        exit /b 1
    )
)

echo.
echo [2/4] Backend tayyorlanmoqda...
echo.

cd backend

:: Check if .env exists
if not exist .env (
    echo ⚠️  .env fayli topilmadi, .env.example dan nusxa olinmoqda...
    copy .env.example .env
    echo ✅ .env fayli yaratildi
    echo.
    echo DIQQAT: .env faylini tahrirlab, to'g'ri sozlamalarni kiriting!
    pause
)

echo [3/4] Backend server ishga tushirilmoqda...
echo.
start "Backend Server (Port 3000)" cmd /k "npm run start:dev"

:: Wait for backend to start
echo Backend ishga tushmoqda... Kuting (10 soniya)...
timeout /t 10 /nobreak >nul

cd ..

echo.
echo [4/4] Frontend ishga tushirilmoqda...
echo.
start "Frontend (Port 5173)" cmd /k "npm run dev"

echo.
echo ==============================================
echo ✅ BARCHA XIZMATLAR ISHGA TUSHDI!
echo ==============================================
echo.
echo 📊 Backend API: http://localhost:3000
echo 📚 API Docs:    http://localhost:3000/api/docs
echo 🌐 Frontend:    http://localhost:5173
echo.
echo ==============================================
echo To'xtatish uchun barcha oynalarni yoping
echo ==============================================
pause
