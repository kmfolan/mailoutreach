@echo off
setlocal

set "PROJECT_ROOT=E:\AKELA\codex\forgeai-gym-coach"
set "NODE_PATH=%PROJECT_ROOT%\tools\node-v22.20.0-win-x64-full\node-v22.20.0-win-x64\node.exe"
set "SERVER_PATH=%PROJECT_ROOT%\server\src\index.js"

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

cd /d "%PROJECT_ROOT%"
"%NODE_PATH%" "%SERVER_PATH%"
