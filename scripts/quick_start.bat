@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%") do set "SCRIPT_DIR=%%~fI"
set "ROOT_DIR=%SCRIPT_DIR%\.."
for %%I in ("%ROOT_DIR%") do set "ROOT_DIR=%%~fI"
set "DEV_ENV_FILE=%ROOT_DIR%\dev.env"
set "BACKEND_ENV_FILE=%ROOT_DIR%\backend\.env"
set "LOG_DIR=%ROOT_DIR%\.logs"
set "BACKEND_PORT_FILE=%LOG_DIR%\backend.port"
set "FRONTEND_PORT_FILE=%LOG_DIR%\frontend.port"

call :load_dev_env
call :apply_defaults

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [1/5] Checking prerequisites...
call :check_prerequisites
if errorlevel 1 exit /b 1

echo [2/5] Checking database connectivity...
call :check_database_ready
if errorlevel 1 exit /b 1

echo [3/5] Checking backend...
call :ensure_backend
if errorlevel 1 exit /b 1
> "%BACKEND_PORT_FILE%" echo !BACKEND_PORT!

echo [4/5] Ensuring demo data...
call :maybe_seed_demo_data
if errorlevel 1 exit /b 1

echo [5/5] Checking frontend...
call :ensure_frontend
if errorlevel 1 exit /b 1
> "%FRONTEND_PORT_FILE%" echo !FRONTEND_PORT!

echo.
echo ========================================
echo Quick start complete
echo ========================================
echo.
echo Frontend URL: http://localhost:!FRONTEND_PORT!
echo Backend URL : http://localhost:!BACKEND_PORT!
echo Health check: http://localhost:!BACKEND_PORT!/health
exit /b 0

:load_dev_env
if not exist "%DEV_ENV_FILE%" exit /b 0
for /f "usebackq tokens=1,* delims==" %%A in ("%DEV_ENV_FILE%") do (
    if not "%%A"=="" if /I not "%%A:~0,1%%"=="#" set "%%A=%%B"
)
exit /b 0

:apply_defaults
if not defined DEV_HOST set "DEV_HOST=127.0.0.1"
if not defined BACKEND_PORT set "BACKEND_PORT=8000"
if not defined BACKEND_FALLBACK_PORT_END set "BACKEND_FALLBACK_PORT_END=8010"
if not defined FRONTEND_PORT set "FRONTEND_PORT=5173"
if not defined FRONTEND_FALLBACK_PORT_END set "FRONTEND_FALLBACK_PORT_END=5178"
if not defined FRONTEND_PREVIEW_PORT set "FRONTEND_PREVIEW_PORT=4173"
if not defined SEED_DEMO_DATA set "SEED_DEMO_DATA=true"
exit /b 0

:check_prerequisites
if not exist "%BACKEND_ENV_FILE%" (
    echo   - Missing backend\.env file
    echo   - Create backend\.env manually, then retry quick_start.bat
    exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
    echo   - Python is not available on PATH
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo   - Node.js is not available on PATH
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo   - npm is not available on PATH
    exit /b 1
)

if not exist "%ROOT_DIR%\frontend\node_modules" (
    echo   - Installing frontend dependencies...
    pushd "%ROOT_DIR%\frontend"
    call npm install
    set "NPM_EXIT=!errorlevel!"
    popd
    if not "!NPM_EXIT!"=="0" (
        echo   - npm install failed
        exit /b 1
    )
)

pushd "%ROOT_DIR%\backend"
python -c "import fastapi, uvicorn, sqlalchemy, asyncpg, psycopg2, pydantic_settings, dotenv" >nul 2>&1
set "PY_DEPS_EXIT=!errorlevel!"
popd
if not "!PY_DEPS_EXIT!"=="0" (
    echo   - Backend Python dependencies are missing
    echo   - Run: cd backend ^&^& pip install -r requirements.txt
    exit /b 1
)
exit /b 0

:check_database_ready
pushd "%ROOT_DIR%\backend"
python scripts\check_database.py
set "DB_CHECK_EXIT=!errorlevel!"
popd
exit /b %DB_CHECK_EXIT%

:ensure_backend
set "DEFAULT_BACKEND_PORT=!BACKEND_PORT!"
set "BACKEND_PORT="

if exist "%BACKEND_PORT_FILE%" (
    set /p "SAVED_BACKEND_PORT="<"%BACKEND_PORT_FILE%"
    if defined SAVED_BACKEND_PORT (
        call :response_contains "http://127.0.0.1:!SAVED_BACKEND_PORT!/" "ABC Community Food Bank API"
        if not errorlevel 1 (
            call :is_http_ok "http://127.0.0.1:!SAVED_BACKEND_PORT!/health"
            if not errorlevel 1 (
                set "BACKEND_PORT=!SAVED_BACKEND_PORT!"
                echo   - Backend is already running on !BACKEND_PORT!
                exit /b 0
            )
        )
    )
)

call :is_port_listening %DEFAULT_BACKEND_PORT%
if errorlevel 1 (
    set "BACKEND_PORT=%DEFAULT_BACKEND_PORT%"
    echo   - Starting backend on !BACKEND_PORT!...
    call :start_backend !BACKEND_PORT!
    exit /b !errorlevel!
)

call :response_contains "http://127.0.0.1:%DEFAULT_BACKEND_PORT%/" "ABC Community Food Bank API"
if not errorlevel 1 (
    call :is_http_ok "http://127.0.0.1:%DEFAULT_BACKEND_PORT%/health"
    if not errorlevel 1 (
        set "BACKEND_PORT=%DEFAULT_BACKEND_PORT%"
        echo   - Backend is already running on !BACKEND_PORT!
        exit /b 0
    )
    echo   - Existing backend on %DEFAULT_BACKEND_PORT% is not healthy
    echo   - Run scripts\stop.bat and retry after fixing the database.
    exit /b 1
)

echo   - Port %DEFAULT_BACKEND_PORT% is occupied by another process
call :find_free_port %DEFAULT_BACKEND_PORT% %BACKEND_FALLBACK_PORT_END% BACKEND_PORT
if errorlevel 1 (
    echo   - No free backend port available in range %DEFAULT_BACKEND_PORT%-%BACKEND_FALLBACK_PORT_END%
    exit /b 1
)

echo   - Starting backend on !BACKEND_PORT!...
call :start_backend !BACKEND_PORT!
exit /b !errorlevel!

:maybe_seed_demo_data
if /I not "%SEED_DEMO_DATA%"=="true" (
    echo   - Demo data seeding skipped (SEED_DEMO_DATA=%SEED_DEMO_DATA%)
    exit /b 0
)

pushd "%ROOT_DIR%\backend"
python scripts\seed_demo_data.py --quiet
set "SEED_EXIT=!errorlevel!"
popd

if not "!SEED_EXIT!"=="0" (
    echo   - Demo data seeding failed
    exit /b 1
)

echo   - Demo data ensured
exit /b 0

:ensure_frontend
set "DEFAULT_FRONTEND_PORT=!FRONTEND_PORT!"
set "FRONTEND_PORT="

if exist "%FRONTEND_PORT_FILE%" (
    set /p "SAVED_FRONTEND_PORT="<"%FRONTEND_PORT_FILE%"
    if defined SAVED_FRONTEND_PORT (
        call :response_contains "http://127.0.0.1:!SAVED_FRONTEND_PORT!" "ABC Community Food Bank"
        if not errorlevel 1 (
            set "FRONTEND_PORT=!SAVED_FRONTEND_PORT!"
            echo   - Frontend is already running on !FRONTEND_PORT!
            exit /b 0
        )
    )
)

call :is_port_listening %DEFAULT_FRONTEND_PORT%
if errorlevel 1 (
    set "FRONTEND_PORT=%DEFAULT_FRONTEND_PORT%"
    echo   - Starting frontend on !FRONTEND_PORT!...
    call :start_frontend !FRONTEND_PORT!
    exit /b !errorlevel!
)

call :response_contains "http://127.0.0.1:%DEFAULT_FRONTEND_PORT%" "ABC Community Food Bank"
if not errorlevel 1 (
    set "FRONTEND_PORT=%DEFAULT_FRONTEND_PORT%"
    echo   - Frontend is already running on !FRONTEND_PORT!
    exit /b 0
)

echo   - Port %DEFAULT_FRONTEND_PORT% is occupied by another process
call :find_free_port %DEFAULT_FRONTEND_PORT% %FRONTEND_FALLBACK_PORT_END% FRONTEND_PORT
if errorlevel 1 (
    echo   - No free frontend port available in range %DEFAULT_FRONTEND_PORT%-%FRONTEND_FALLBACK_PORT_END%
    exit /b 1
)

echo   - Starting frontend on !FRONTEND_PORT!...
call :start_frontend !FRONTEND_PORT!
exit /b !errorlevel!

:start_backend
set "PORT=%~1"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start_backend.ps1" -RootDir "%ROOT_DIR%" -Port %PORT%
if errorlevel 1 (
    echo   - Backend failed to become healthy
    exit /b 1
)
set "BACKEND_PORT=%PORT%"
exit /b 0

:start_frontend
set "PORT=%~1"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start_frontend.ps1" -RootDir "%ROOT_DIR%" -BackendPort %BACKEND_PORT% -Port %PORT%
if errorlevel 1 (
    echo   - Frontend failed to become reachable
    exit /b 1
)
set "FRONTEND_PORT=%PORT%"
exit /b 0

:find_free_port
setlocal EnableDelayedExpansion
set /a "START=%~1 + 1"
set /a "END=%~2"
for /l %%P in (!START!,1,!END!) do (
    netstat -ano ^| findstr "LISTENING" ^| findstr ":%%P " >nul 2>&1
    if errorlevel 1 (
        endlocal & set "%~3=%%P" & exit /b 0
    )
)
endlocal & exit /b 1

:is_port_listening
netstat -ano | findstr "LISTENING" | findstr ":%~1 " >nul 2>&1
exit /b !errorlevel!

:is_http_ok
curl.exe -fsS "%~1" >nul 2>&1
exit /b !errorlevel!

:response_contains
curl.exe -fsS "%~1" 2>nul | findstr /C:"%~2" >nul 2>&1
exit /b !errorlevel!

