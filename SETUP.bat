@echo off
title Gold Signal Bot - Setup
cd /d "%~dp0"

echo ============================================
echo   Gold Signal Bot - One-Time Setup
echo ============================================
echo.

echo [1/4] Installing Node packages...
call npm install
if errorlevel 1 goto error

echo.
echo [2/4] Installing Python MT5 package...
python -m pip install MetaTrader5 --quiet
if errorlevel 1 (
  echo WARNING: Could not install MetaTrader5 Python package.
  echo Make sure Python is installed from python.org
)

echo.
echo [3/4] Checking for MetaTrader 5...
node scripts\setup-mt5.js

echo.
echo [4/4] Setup complete!
echo.
echo NEXT STEPS:
echo   1. If MT5 is not installed, download it from:
echo      https://www.metatrader5.com/en/download
echo   2. Open MT5 and log in to your broker account
echo   3. Double-click START.bat to run the bot
echo.
echo Opening MT5 download page in browser...
start https://www.metatrader5.com/en/download
echo.
pause
goto end

:error
echo Setup failed. Press any key to exit.
pause
exit /b 1

:end
