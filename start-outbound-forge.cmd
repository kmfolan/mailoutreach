@echo off
setlocal
start "Outbound Forge Server" cmd /k "E:\AKELA\codex\forgeai-gym-coach\run-server.cmd"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4020"
