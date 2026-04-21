@echo off
setlocal

for %%p in (4000 4020) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
    echo Stopping process %%a on port %%p...
  taskkill /PID %%a /F
  )
)

echo Done.
pause
