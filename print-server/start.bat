@echo off
cd /d "%~dp0"
echo Installing print server dependencies...
call npm install
if %errorlevel% neq 0 (
  echo npm install failed. Make sure Node.js is installed.
  pause
  exit /b 1
)
echo Starting SEZNIK Print Server on port 3001...
echo.
echo Other PCs should configure: http://THIS_PC_IP:3001
echo.
node server.js
pause
