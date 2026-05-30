@echo off
setlocal enabledelayedexpansion
title LasangPinoy Mobile - Demo Setup

echo ================================================================
echo   LasangPinoy Mobile - Client Demo Bootstrap
echo ================================================================
echo.
echo This script will:
echo   1. Verify Node.js and Git are installed
echo   2. Download the project from GitHub
echo   3. Copy your .env.demo into the project as .env
echo   4. Install dependencies (5-15 minutes)
echo   5. Launch the app in your web browser
echo.
echo Press any key to begin, or close this window to cancel.
pause >nul
echo.

REM ---------- Resolve script folder ----------
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM ---------- Step 1: Node.js ----------
echo [1/6] Checking for Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js is not installed or not on PATH.
    echo.
    echo Please install the LTS version from:
    echo     https://nodejs.org/en/download
    echo.
    echo After installing, close this window and run this script again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set "NODE_VERSION=%%v"
echo         OK  Node.js !NODE_VERSION!
echo.

REM ---------- Step 2: Git ----------
echo [2/6] Checking for Git...
where git >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Git is not installed or not on PATH.
    echo.
    echo Please install Git from:
    echo     https://git-scm.com/download/win
    echo.
    echo Use all the installer's default options. After installing,
    echo close this window and run this script again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('git --version') do set "GIT_VERSION=%%v"
echo         OK  !GIT_VERSION!
echo.

REM ---------- Step 3: Clone or update the repo ----------
set "REPO_URL=https://github.com/burikethhh/PUPLasangpinoy.git"
set "REPO_DIR=PUPLasangpinoy"

if exist "%REPO_DIR%\package.json" (
    echo [3/6] Project folder already exists. Updating...
    pushd "%REPO_DIR%"
    git pull --ff-only
    if errorlevel 1 (
        echo.
        echo [WARN] Could not fast-forward. Continuing with existing copy.
    )
    popd
) else (
    echo [3/6] Cloning project from GitHub...
    git clone "%REPO_URL%" "%REPO_DIR%"
    if errorlevel 1 (
        echo.
        echo [ERROR] git clone failed. Check your internet connection
        echo and make sure the repository URL is reachable:
        echo     %REPO_URL%
        echo.
        pause
        exit /b 1
    )
)
echo         OK
echo.

REM ---------- Step 4: Place the .env file ----------
echo [4/6] Setting up .env file...
if exist ".env.demo" (
    copy /Y ".env.demo" "%REPO_DIR%\.env" >nul
    echo         OK  .env.demo copied into project as .env
) else if exist "%REPO_DIR%\.env" (
    echo         OK  Existing .env already in project folder, keeping it
) else (
    echo.
    echo [ERROR] No .env.demo found next to this script, and no existing
    echo         .env inside the project folder.
    echo.
    echo Please place the .env.demo file given by the developer in the
    echo same folder as this script, then run this script again.
    echo.
    echo Current script folder:
    echo     %SCRIPT_DIR%
    echo.
    pause
    exit /b 1
)
echo.

REM ---------- Step 5: npm install ----------
cd /d "%SCRIPT_DIR%%REPO_DIR%"
echo [5/6] Installing dependencies...
echo         This step can take 5 to 15 minutes. Please be patient.
echo         You can safely ignore yellow "npm warn" messages.
echo.
call npm install
if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. Scroll up to see the red error lines.
    echo         If the error mentions network/ETIMEDOUT, check your
    echo         internet connection and run this script again.
    echo.
    pause
    exit /b 1
)
echo.
echo         OK  Dependencies installed.
echo.

REM ---------- Step 6: Launch Expo Web ----------
echo [6/6] Starting Expo web server...
echo.
echo ================================================================
echo   The app will open in your default web browser in a moment.
echo.
echo   If it does not open automatically, visit:
echo       http://localhost:8081
echo.
echo   To STOP the server: come back to this window and press Ctrl+C.
echo ================================================================
echo.
call npx expo start --web

endlocal
