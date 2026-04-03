@echo off
setlocal

set ROOT_DIR=%~dp0..
set BACKEND_DIR=%ROOT_DIR%\backend

cd /d "%BACKEND_DIR%"
python scripts\cleanup_analytics_data.py %*
