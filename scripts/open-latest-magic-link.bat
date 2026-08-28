@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
node scripts\open-latest-magic-link.mjs
exit /b %ERRORLEVEL%
