@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title RacketBound - Dev Client

rem Starts the emulator (if nothing is connected) and runs Metro for the EAS
rem development client, against STAGING Supabase.
rem
rem Not the same as scripts\launch-android.bat, which drives the local-Supabase
rem workflow with Expo Go and Mailpit. This one assumes the dev-client APK is
rem already installed and that apps\mobile\.env points at staging.
rem
rem Pass extra flags straight through, e.g.  start-dev-client.bat --clear
rem (--clear is needed after editing .env: EXPO_PUBLIC_* values are inlined at
rem transform time, so a cached bundle keeps the old ones.)

set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "AVD=Tennis_Pixel_8_API_35"
set "PKG=com.racketbound.app"
set "PATH=%SDK%\platform-tools;%SDK%\emulator;%PATH%"

echo.
echo ==========================================
echo   RacketBound - dev client + Metro
echo ==========================================
echo.

if not exist "%SDK%\platform-tools\adb.exe" (
  echo [ERROR] Android SDK not found at "%SDK%".
  echo Install Android Studio and open the SDK Manager once.
  echo.
  pause
  exit /b 1
)

rem Metro reads .env from the app directory, not the repo root. Without this
rem file every route fails with "missing the required default export", which
rem points nowhere near the cause.
if not exist "apps\mobile\.env" (
  echo [ERROR] apps\mobile\.env is missing.
  echo.
  echo Metro reads .env from the app folder, not the repo root. Create it with
  echo the EXPO_PUBLIC_* values pointing at staging Supabase. See .env.example.
  echo.
  pause
  exit /b 1
)

rem ---------------------------------------------------------------- device ---
adb devices | findstr /R "device$" >nul
if errorlevel 1 (
  echo [1/3] No device connected. Starting emulator %AVD% ...
  start "Android Emulator" "%SDK%\emulator\emulator.exe" -avd %AVD%
  adb wait-for-device
  echo       Waiting for Android to finish booting ...
  :waitboot
  adb shell getprop sys.boot_completed 2>nul | findstr 1 >nul
  if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto waitboot
  )
  echo       Booted.
) else (
  echo [1/3] Device already connected.
)

rem ------------------------------------------------------------------ app ---
adb shell pm list packages 2>nul | findstr /C:"%PKG%" >nul
if errorlevel 1 (
  echo.
  echo [WARN] %PKG% is not installed on this device.
  echo.
  echo Metro will start, but nothing will connect to it. Install the
  echo development build first:
  echo.
  echo     eas build --profile development --platform android
  echo     adb install -r path\to\the.apk
  echo.
  echo Note the package changed to com.racketbound.app, so an older build
  echo will not upgrade in place - uninstall it first.
  echo.
  pause
)

rem Lets the app reach Metro on this PC.
echo [2/3] Forwarding port 8081 ...
adb reverse tcp:8081 tcp:8081 >nul

rem ---------------------------------------------------------------- metro ---
echo [3/3] Starting Metro. Leave this window open.
echo.
echo       Reload the app with 'r'. Stop with Ctrl+C.
echo.

cd apps\mobile
rem expo is a dependency of apps\mobile, not of the repo root. Running this
rem from the root fails with "the module `expo` is not installed".
call npx expo start --dev-client %*
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Metro exited with code %EXIT_CODE%.
) else (
  echo Metro stopped.
)
echo.
pause
exit /b %EXIT_CODE%
