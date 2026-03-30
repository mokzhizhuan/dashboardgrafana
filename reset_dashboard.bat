@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo Reset Engineering Dashboard Data
echo ==========================================
echo.
echo This will:
echo - stop all dashboard containers
echo - remove containers and networks
echo - delete Docker volumes
echo - remove Postgres stored data
echo - force a clean restart
echo.
set /p CONFIRM=Type RESET to continue: 

if /I not "%CONFIRM%"=="RESET" (
    echo.
    echo Reset cancelled.
    echo.
    pause
    exit /b 0
)

docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo Docker is not running.
    echo Please start Docker Desktop first, then try again.
    echo.
    pause
    exit /b 1
)

echo.
echo Stopping stack and removing volumes...
docker compose down -v

if errorlevel 1 (
    echo.
    echo Failed while removing stack and volumes.
    echo.
    pause
    exit /b 1
)

echo.
echo Rebuilding and restarting stack...
docker compose up -d --build

if errorlevel 1 (
    echo.
    echo Failed to restart Docker stack.
    echo.
    pause
    exit /b 1
)

echo.
echo Waiting for services to initialize...
timeout /t 12 /nobreak >nul

echo.
echo ==========================================
echo Reset complete
echo ==========================================
echo Frontend:   http://localhost:5173
echo Backend:    http://localhost:8000
echo Grafana:    http://localhost:4000
echo Prometheus: http://localhost:9090
echo.

start http://localhost:5173
start http://localhost:4000

echo.
pause
endlocal