@echo off
title Summit Sites - Lead Intelligence
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed. Get it from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo   First run: installing dependencies. This can take a minute or two...
  echo.
  call npm install
)

echo.
echo  ============================================================
echo    Summit Sites - Lead Intelligence
echo  ------------------------------------------------------------
echo    Opening in your browser at http://localhost:3000
echo.
echo    KEEP THIS WINDOW OPEN while you use the app.
echo    Close this window to stop the app.
echo  ============================================================
echo.

rem Open the app in a new Chrome window once the server is up (see open-app.bat).
start "" /min "%~dp0open-app.bat"

call npm run dev
