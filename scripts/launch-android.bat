@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "AVD=Tennis_Pixel_8_API_35"
set "PATH=%SDK%\platform-tools;%SDK%\emulator;%PATH%"

if not exist "%SDK%\platform-tools\adb.exe" (
  echo Android SDK not found at "%SDK%".
  echo Install Android Studio and open the SDK Manager once.
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm is not on PATH. Open this from a terminal where pnpm works.
  exit /b 1
)

adb devices | findstr /R "emulator-[0-9]" >nul
if errorlevel 1 (
  echo Starting emulator %AVD% ...
  start "Android Emulator" "%SDK%\emulator\emulator.exe" -avd %AVD%
  adb wait-for-device
  echo Waiting for Android to finish booting ...
  :waitboot
  adb shell getprop sys.boot_completed 2>nul | findstr 1 >nul
  if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto waitboot
  )
)

echo Forwarding emulator ports to this PC ...
adb reverse tcp:54321 tcp:54321
adb reverse tcp:54324 tcp:54324
adb reverse tcp:8081 tcp:8081

echo Starting local Supabase if needed ...
call pnpm db:start
if errorlevel 1 (
  echo db:start failed. Is Docker Desktop running?
  exit /b 1
)

echo Starting Expo on the emulator. Leave this window open.
echo After you request a sign-in link, run scripts\open-latest-magic-link.bat
echo Do not click the Mailpit email on this PC.
call pnpm exec dotenv -e .env -- pnpm --filter mobile android
exit /b %ERRORLEVEL%
