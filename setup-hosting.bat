@echo off
REM Setup & Push bot ke GitHub otomatis

echo ================================
echo Discord Bot - Hosting Setup
echo ================================
echo.

REM Set working directory
cd /d "%~dp0"

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo [2/4] Files prepared for GitHub:
echo   - bot-cohere.js
echo   - package-hosting.json (rename ke package.json)
echo   - Procfile
echo   - README-HOSTING.md
echo.

echo [3/4] Setup GitHub:
echo   1. Buka https://github.com/new
echo   2. Buat repository: discord-bot-cohere
echo   3. Jangan init dengan README
echo   4. Copy perintah di bawah ini:
echo.
echo   --- LANGKAH 1: Inisialisasi Git ---
echo   git init
echo   git add .
echo   git commit -m "Initial commit - Discord Bot with Cohere AI"
echo   git branch -M main
echo.
echo   --- LANGKAH 2: Hubungkan ke GitHub ---
echo   REM Ganti YOUR_USERNAME dengan username GitHub-mu di bawah ini
echo   git remote add origin https://github.com/YOUR_USERNAME/discord-bot-cohere.git
echo.
echo   REM Jika muncul error 'remote origin already exists', jalankan perintah ini sebagai gantinya:
echo   REM git remote set-url origin https://github.com/YOUR_USERNAME/discord-bot-cohere.git
echo.
echo   --- LANGKAH 3: Push ke GitHub ---
echo   REM Jika push ditolak (rejected), jalankan perintah 'pull' ini dulu:
echo   git pull origin main --allow-unrelated-histories
echo.
echo   REM Setelah itu, baru jalankan push:
echo   git push -u origin main
echo.

echo [4/4] Deploy ke Railway:
echo   1. Buka https://railway.app
echo   2. Sign in dengan GitHub
echo   3. New Project → Deploy from GitHub
echo   4. Select: discord-bot-cohere
echo   5. Add Variables:
echo      - CO_API_KEY = YOUR_COHERE_API_KEY
echo      - DISCORD_TOKEN = YOUR_DISCORD_TOKEN
echo   6. Deploy!
echo.

echo ✅ Setup selesai!
pause
