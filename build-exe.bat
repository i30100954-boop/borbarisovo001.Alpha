@echo off
chcp 65001 >nul
setlocal

echo ==========================================================
echo   Borbarisovo 001 - Windows .exe Builder (Electron)
echo ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found! Install Node.js 20+ from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo [1/2] Installing dependencies ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
) else (
  echo [1/2] Dependencies already installed.
)

echo.
echo [2/2] Building game and packaging .exe ^(npm run build:exe^)...
call npm run build:exe
if errorlevel 1 (
  echo [ERROR] Build failed!
  pause
  exit /b 1
)

echo.
echo ==========================================================
echo   Done! Your .exe files are in the "release" folder.
echo ==========================================================
if exist "release" start "" "release"
pause
