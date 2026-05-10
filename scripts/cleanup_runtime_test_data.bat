@echo off
setlocal

set ROOT_DIR=%~dp0..
set BACKEND_DIR=%ROOT_DIR%\backend

cd /d "%BACKEND_DIR%"
python scripts\cleanup_runtime_test_data.py %*
