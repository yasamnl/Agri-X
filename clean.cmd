@echo off
title Next.js Cleaner
chcp 65001 >nul

echo.
echo 🧹 Next.js Cleaner - Starting...
echo ========================================================

:: 1. Hapus .next
echo [1/4] Removing .next folder...
if exist Remove-Item -Recurse -Force .next
echo     Done.

:: 2. Hapus cache internal
echo [2/4] Removing node_modules/.cache...
if exist "node_modules\.cache" rd /s /q "node_modules\.cache"
echo     Done.

:: 3. Clean npm cache
echo [3/4] Cleaning npm cache...
npm cache clean --force
echo     Done.

:: 4. Install dependencies
echo [4/4] Installing dependencies...
npm install

:: 5. Run server
echo.
echo 🚀 Starting Next.js...
echo ========================================================
npm run dev

:: Jaga agar window tidak langsung close jika ada error
pause