@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Tennis Lebanon - Mobile Dev

echo.
echo ==========================================
echo   Tennis Lebanon - Mobile App Launcher
echo ==========================================
echo.

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] pnpm was not found in PATH.
  echo Install Node 20.x and pnpm, then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [WARN] .env is missing.
  echo Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_ANON_KEY
  echo from the output of: pnpm db:start
  echo.
)

echo [1/2] Starting local Supabase...
echo       Docker Desktop must be running.
echo.
call pnpm db:start:lean
if errorlevel 1 (
  echo.
  echo [ERROR] Supabase did not start. Check Docker Desktop and retry.
  echo.
  pause
  exit /b 1
)

echo.
echo [2/2] Starting the player mobile app...
echo.
echo   App (player):  http://localhost:8081
echo   Email inbox:   http://127.0.0.1:54324
echo   Test account:  player-a@tennis-lebanon.test
echo.
echo   Use Inbucket to open the magic sign-in link (HTML or Text tab).
echo   Do NOT use the dashboard on port 3000 for player testing.
echo.
echo   Metro may take up to a minute on first start. Browser tabs open
echo   automatically once http://localhost:8081 is ready.
echo.

rem Open browser tabs only after Expo is actually listening on 8081.
start /b powershell -NoProfile -WindowStyle Hidden -Command ^
  "$app='http://localhost:8081'; $inbox='http://127.0.0.1:54324';" ^
  "for ($i = 0; $i -lt 90; $i++) {" ^
  "  try {" ^
  "    if ((Invoke-WebRequest -Uri $app -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) {" ^
  "      Start-Process $app; Start-Process $inbox; break" ^
  "    }" ^
  "  } catch {}" ^
  "  Start-Sleep -Seconds 2" ^
  "}"

call pnpm dev:mobile -- --web --port 8081
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Expo exited with error code %EXIT_CODE%.
) else (
  echo Expo stopped.
)
echo.
pause
exit /b %EXIT_CODE%
