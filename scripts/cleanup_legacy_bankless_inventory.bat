@echo off
setlocal

call "%~dp0legacy\cleanup_legacy_bankless_inventory.bat" %*
exit /b %ERRORLEVEL%
