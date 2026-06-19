@echo off
setlocal enabledelayedexpansion
title IRONWAVE Server

REM Always run from the folder this .bat lives in (double-click safe)
cd /d "%~dp0"

set PORT=3000

REM --- Check Node is installed ---
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was not found on this computer.
  echo Install the LTS version from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

REM --- Is something already listening on the port? ---
REM If so, it is almost always an IRONWAVE server from an earlier launch.
REM Reuse it (just open the browser) instead of crashing with EADDRINUSE.
set "INUSE="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do set "INUSE=%%P"

if defined INUSE (
  echo.
  echo A server is already running on port %PORT% ^(process id !INUSE!^).
  echo This is normal if IRONWAVE is already open.
  echo.
  echo   [1] Open the app in my browser  ^(use the server that is already running^)
  echo   [2] Restart it                  ^(stop that process, then start fresh^)
  echo.
  set /p CHOICE="Choose 1 or 2 (default 1): "
  if "!CHOICE!"=="2" (
    echo Stopping process !INUSE! ...
    taskkill /F /PID !INUSE! >nul 2>nul
    timeout /t 2 /nobreak >nul
    goto startserver
  )
  start "" http://localhost:%PORT%
  echo Opened http://localhost:%PORT% in your browser.
  echo You can close this window; the other one is the real server.
  echo.
  pause >nul
  exit /b 0
)

:startserver
REM --- Install dependencies only the first time ---
if not exist "node_modules\express" (
  echo First run: installing dependencies, this happens only once...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Check your internet connection and try again.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Starting IRONWAVE on http://localhost:%PORT%
echo Keep this window OPEN while you use the app. Close it to stop the server.
echo.

REM Open the browser shortly after the server comes up. Handed off to a
REM small helper (_open_browser.bat) running in its own window, so it does
REM not block the server and it polls until the server actually answers.
start "IRONWAVE-open" /min cmd /c _open_browser.bat %PORT%

REM Run the server IN THIS WINDOW (foreground). Because it is the foreground
REM process, closing this window or pressing Ctrl+C actually stops it -- no
REM orphaned node.exe left holding the port (which is what caused EADDRINUSE).
echo IRONWAVE is running. This window is the server.
echo Press Ctrl+C or close this window to stop it.
echo.
node server.js

REM If node exits on its own, pause so any error stays readable.
echo.
echo Server stopped.
pause >nul

