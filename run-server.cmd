@echo off
setlocal

set "PROJECT_ROOT=E:\AKELA\codex\forgeai-gym-coach"
set "NODE_PATH=%PROJECT_ROOT%\tools\node-v22.20.0-win-x64-full\node-v22.20.0-win-x64\node.exe"
set "SERVER_PATH=%PROJECT_ROOT%\server\src\index.js"
set "LOG_PATH=%PROJECT_ROOT%\server.log"

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

if not exist "%PROJECT_ROOT%\.env" (
  echo Missing .env file at:
  echo %PROJECT_ROOT%\.env
  echo.
  echo Copy .env.example to .env and fill in the values first.
  pause
  exit /b 1
)

for /f "tokens=1,* delims==" %%A in ('findstr /r "^[A-Z_][A-Z0-9_]*=" "%PROJECT_ROOT%\.env"') do (
  set "%%A=%%B"
)

if not defined PORT (
  set "PORT=4020"
)

echo Starting Outbound Forge > "%LOG_PATH%"
echo Username: %AUTH_USERNAME%>> "%LOG_PATH%"
echo URL: http://127.0.0.1:%PORT%>> "%LOG_PATH%"
echo.>> "%LOG_PATH%"

echo Starting Outbound Forge...
echo Username: %AUTH_USERNAME%
echo URL: http://127.0.0.1:%PORT%
echo Logging to: %LOG_PATH%
echo.

"%NODE_PATH%" "%SERVER_PATH%" >> "%LOG_PATH%" 2>&1

echo.
echo Server stopped. Check:
echo %LOG_PATH%
pause
