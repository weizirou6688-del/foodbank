@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0.."
for %%I in ("%ROOT_DIR%") do set "ROOT_DIR=%%~fI"
set "DEV_ENV_FILE=%ROOT_DIR%\dev.env"
set "LOG_DIR=%ROOT_DIR%\.logs"
set "BACKEND_PORT_FILE=%LOG_DIR%\backend.port"
set "FRONTEND_PORT_FILE=%LOG_DIR%\frontend.port"

call :load_dev_env
call :apply_defaults

set "SAVED_FRONTEND_PORT="
set "SAVED_BACKEND_PORT="
if exist "%FRONTEND_PORT_FILE%" set /p "SAVED_FRONTEND_PORT="<"%FRONTEND_PORT_FILE%"
if exist "%BACKEND_PORT_FILE%" set /p "SAVED_BACKEND_PORT="<"%BACKEND_PORT_FILE%"

echo Stopping FoodBank services...
echo.

echo Stopping frontend...
call :stop_saved_port "%FRONTEND_PORT_FILE%" frontend
for /l %%P in (%FRONTEND_PORT%,1,%FRONTEND_FALLBACK_PORT_END%) do (
    if not "%%P"=="!SAVED_FRONTEND_PORT!" call :stop_if_our_frontend %%P
)

echo Stopping backend...
call :stop_saved_port "%BACKEND_PORT_FILE%" backend
for /l %%P in (%BACKEND_PORT%,1,%BACKEND_FALLBACK_PORT_END%) do (
    if not "%%P"=="!SAVED_BACKEND_PORT!" call :stop_if_our_backend %%P
)

if exist "%FRONTEND_PORT_FILE%" del "%FRONTEND_PORT_FILE%" >nul 2>&1
if exist "%BACKEND_PORT_FILE%" del "%BACKEND_PORT_FILE%" >nul 2>&1

echo.
echo All services stopped.
exit /b 0

:load_dev_env
if not exist "%DEV_ENV_FILE%" exit /b 0
for /f "usebackq tokens=1,* delims==" %%A in ("%DEV_ENV_FILE%") do (
    if not "%%A"=="" if /I not "%%A:~0,1%%"=="#" set "%%A=%%B"
)
exit /b 0

:apply_defaults
if not defined BACKEND_PORT set "BACKEND_PORT=8000"
if not defined BACKEND_FALLBACK_PORT_END set "BACKEND_FALLBACK_PORT_END=8010"
if not defined FRONTEND_PORT set "FRONTEND_PORT=5173"
if not defined FRONTEND_FALLBACK_PORT_END set "FRONTEND_FALLBACK_PORT_END=5178"
exit /b 0

:stop_saved_port
if not exist "%~1" exit /b 0
set /p "SAVED_PORT="<"%~1"
if not defined SAVED_PORT exit /b 0
if /i "%~2"=="frontend" call :stop_if_our_frontend !SAVED_PORT!
if /i "%~2"=="backend" call :stop_if_our_backend !SAVED_PORT!
exit /b 0

:stop_if_our_frontend
call :is_our_frontend %~1
if errorlevel 1 exit /b 0
call :kill_listeners_on_port %~1
exit /b 0

:stop_if_our_backend
call :is_our_backend %~1
if errorlevel 1 exit /b 0
call :kill_listeners_on_port %~1
exit /b 0

:kill_listeners_on_port
set "PORT=%~1"
set "KILLED="
for /f "tokens=5" %%A in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%PORT% "') do (
    echo   - Killing process %%A on port %PORT%
    taskkill /F /T /PID %%A >nul 2>&1
    if errorlevel 1 call :kill_children_of_pid %%A
    set "KILLED=1"
)
if not defined KILLED (
    echo   - No listener found on port %PORT%
)
exit /b 0

:kill_children_of_pid
set "PARENT_PID=%~1"
for /f "tokens=2 delims==" %%B in ('wmic process where "ParentProcessId=%PARENT_PID%" get ProcessId /value ^| findstr "="') do (
    echo     - Killing child process %%B from ghost parent %PARENT_PID%
    taskkill /F /T /PID %%B >nul 2>&1
)
exit /b 0

:is_our_backend
curl.exe -fsS "http://localhost:%~1/" 2>nul | findstr /C:"ABC Community Food Bank API" >nul 2>&1
exit /b %errorlevel%

:is_our_frontend
curl.exe -fsS "http://localhost:%~1" 2>nul | findstr /C:"ABC Community Food Bank" >nul 2>&1
exit /b %errorlevel%
