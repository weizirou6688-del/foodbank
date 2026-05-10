@echo off
setlocal

set "ROOT_DIR=%~dp0..\.."
pushd "%ROOT_DIR%" >nul

python backend\scripts\legacy\cleanup_legacy_bankless_inventory.py %*
set "EXIT_CODE=%ERRORLEVEL%"

popd >nul
exit /b %EXIT_CODE%
