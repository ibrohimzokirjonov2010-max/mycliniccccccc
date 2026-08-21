@echo off
echo ========================================
echo  Dental Clinic Backend - Quick Start
echo ========================================
echo.

echo [1/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Dependencies installation failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Checking .env file...
if not exist .env (
    echo Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit .env file with your MongoDB connection string!
    echo Open .env and set MONGODB_URI before continuing.
    echo.
    pause
)

echo.
echo [3/4] Building application...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Starting development server...
echo.
echo ========================================
echo  Server will start on port 3000
echo  API Docs: http://localhost:3000/api/docs
echo ========================================
echo.
call npm run start:dev

pause
