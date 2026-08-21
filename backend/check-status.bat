@echo off
echo ========================================
echo  Checking Backend Installation
echo ========================================
echo.

echo [1/3] Checking Node.js version...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    pause
    exit /b 1
)

echo.
echo [2/3] Checking if node_modules exists...
if not exist node_modules (
    echo ERROR: node_modules folder not found!
    echo Please run: npm install
    pause
    exit /b 1
) else (
    echo OK: Dependencies are installed
)

echo.
echo [3/3] Checking key packages...
if exist node_modules\@nestjs\core (
    echo OK: NestJS installed
) else (
    echo WARNING: NestJS not found, try: npm install
)

if exist node_modules\mongoose (
    echo OK: Mongoose installed
) else (
    echo WARNING: Mongoose not found, try: npm install
)

if exist node_modules\bcrypt (
    echo OK: Bcrypt installed
) else (
    echo WARNING: Bcrypt not found, try: npm install
)

echo.
echo ========================================
echo  Status Check Complete!
echo ========================================
echo.
echo Next steps:
echo 1. If you see WARNING above, run: npm install
echo 2. Copy environment file: copy .env.example .env
echo 3. Edit .env and add MongoDB connection string
echo 4. Start server: npm run start:dev
echo.

pause
