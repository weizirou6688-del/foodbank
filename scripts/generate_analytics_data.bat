@echo off
setlocal

set ROOT_DIR=%~dp0..
set BACKEND_DIR=%ROOT_DIR%\backend

if "%1"=="" (
    set DAYS=180
) else (
    set DAYS=%1
)

echo Generating synthetic analytics data for %DAYS% days...
cd /d "%BACKEND_DIR%"
python scripts\generate_analytics_data.py --days %DAYS%
