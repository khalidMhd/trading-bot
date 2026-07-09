@echo off
title Gold Signal Bot
cd /d "%~dp0"

findstr /B /C:"USE_MT5=false" .env >nul 2>&1
if %ERRORLEVEL%==0 (
  echo Cloud mode: USE_MT5=false — using Yahoo/OANDA prices
  echo.
) else (
  echo Checking MetaTrader 5...
  node scripts\setup-mt5.js
  echo.
)

echo Starting Gold Signal Bot...
echo Open http://localhost:3000 in your browser
echo Press Ctrl+C to stop
echo.
node local-server.js
pause
