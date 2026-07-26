@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Tennis Lebanon - Club Dashboard

echo.
echo ==========================================
echo   Tennis Lebanon - Club Dashboard Launcher
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
  echo Copy .env.example to .env and set NEXT_PUBLIC_SUPABASE_ANON_KEY
  echo from the output of: pnpm db:start
  echo.
)

echo [1/3] Starting local Supabase...
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
echo [2/3] Syncing env for Next.js dashboard...
echo       Next.js only reads apps\dashboard\.env.local ^(not the root .env^).
echo.
rem Copy NEXT_PUBLIC_* lines from root .env into the dashboard app folder.
powershell -NoProfile -Command ^
  "$src='.env'; $dst='apps\dashboard\.env.local';" ^
  "if (-not (Test-Path $src)) { exit 1 };" ^
  "$lines = Get-Content $src | Where-Object { $_ -match '^NEXT_PUBLIC_' -or $_ -match '^\s*#' -or $_ -eq '' };" ^
  "if (-not ($lines -match '^NEXT_PUBLIC_SUPABASE_URL=')) { Write-Error 'NEXT_PUBLIC_SUPABASE_URL missing from .env'; exit 1 };" ^
  "Set-Content -Path $dst -Value $lines -Encoding utf8;" ^
  "Write-Host ('Wrote ' + $dst)"
if errorlevel 1 (
  echo [ERROR] Could not sync apps\dashboard\.env.local from root .env
  echo.
  pause
  exit /b 1
)

rem Clear stale Turbopack cache that can keep old missing-env errors.
if exist "apps\dashboard\.next" (
  echo       Clearing apps\dashboard\.next cache...
  rmdir /s /q "apps\dashboard\.next" 2>nul
)

echo.
echo [3/3] Starting the club dashboard...
echo.
echo   Dashboard:     http://localhost:3000/login
echo   Password:        password
echo.
echo   Club staff:      club-staff@tennis-lebanon.test
echo   Club admin:      club-admin@tennis-lebanon.test
echo   New club setup:  platform-admin@tennis-lebanon.test
echo.
echo   Routes: /bookings  /settings  /courts  /hours  /onboarding
echo.
echo   Run start-mobile.bat in another window for the player app.
echo   Next.js may take up to a minute on first start. The browser opens
echo   automatically once http://localhost:3000 is ready.
echo.

rem Open the login page once the dashboard is listening on port 3000.
start /b powershell -NoProfile -WindowStyle Hidden -Command ^
  "$dashboard='http://localhost:3000/login';" ^
  "for ($i = 0; $i -lt 90; $i++) {" ^
  "  try {" ^
  "    if ((Invoke-WebRequest -Uri $dashboard -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) {" ^
  "      Start-Process $dashboard; break" ^
  "    }" ^
  "  } catch {}" ^
  "  Start-Sleep -Seconds 2" ^
  "}"

call pnpm dev:dashboard
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Dashboard exited with error code %EXIT_CODE%.
) else (
  echo Dashboard stopped.
)
echo.
pause
exit /b %EXIT_CODE%
