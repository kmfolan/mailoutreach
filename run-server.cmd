@echo off
setlocal

set "PROJECT_ROOT=E:\AKELA\codex\forgeai-gym-coach"
set "NODE_PATH=%PROJECT_ROOT%\tools\node-v22.20.0-win-x64-full\node-v22.20.0-win-x64\node.exe"
set "SERVER_PATH=%PROJECT_ROOT%\server\src\index.js"
set "LOG_PATH=%PROJECT_ROOT%\server.log"
set "PORT=4020"

if not exist "%NODE_PATH%" (
  echo Node runtime not found:
  echo %NODE_PATH%
  pause
  exit /b 1
)

if not exist "%SERVER_PATH%" (
  echo Server entry not found:
  echo %SERVER_PATH%
  pause
  exit /b 1
)

set "AUTH_USERNAME=kevin@atlasstudios.com"
set "AUTH_PASSWORD=Atlas713971!"
set "AUTH_SESSION_SECRET=atlas-studios-outbound-forge-session-secret"

echo Starting Outbound Forge > "%LOG_PATH%"
echo Username: %AUTH_USERNAME%>> "%LOG_PATH%"
echo URL: http://127.0.0.1:%PORT%>> "%LOG_PATH%"
echo.>> "%LOG_PATH%"

echo Starting Outbound Forge...
echo Username: %AUTH_USERNAME%
echo Password: %AUTH_PASSWORD%
echo URL: http://127.0.0.1:%PORT%
echo Logging to: %LOG_PATH%
echo.

"%NODE_PATH%" "%SERVER_PATH%" >> "%LOG_PATH%" 2>&1

echo.
echo Server stopped. Check:
echo %LOG_PATH%
pause
