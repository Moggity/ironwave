@echo off
REM Helper for IRONWAVE.bat. Waits until the local server answers, then
REM opens the default browser. Closes itself when done. Not meant to be
REM run on its own. Arg 1 = port (defaults to 3000).
setlocal
set PORT=%1
if "%PORT%"=="" set PORT=3000

for /l %%i in (1,1,20) do (
  powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing http://localhost:%PORT%/ -TimeoutSec 1)|Out-Null;exit 0}catch{exit 1}" >nul 2>nul
  if not errorlevel 1 (
    start "" http://localhost:%PORT%
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)

REM Fallback: open anyway after the wait loop.
start "" http://localhost:%PORT%
exit /b 0
