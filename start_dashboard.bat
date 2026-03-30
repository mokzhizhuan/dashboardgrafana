@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo Engineering Dashboard Launcher
echo ==========================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running.
    echo Please start Docker Desktop first, then try again.
    echo.
    pause
    exit /b 1
)

echo Starting frontend, backend, postgres, grafana...
docker compose up -d --build

if errorlevel 1 (
    echo.
    echo Failed to start the Docker stack.
    echo.
    pause
    exit /b 1
)

echo.
echo Waiting for services to initialize...
timeout /t 10 /nobreak >nul

echo.
echo ==========================================
echo Services should now be starting
echo ==========================================
echo Frontend:   http://localhost:5173
echo Backend:    http://localhost:8000
echo Grafana:    http://localhost:4000
echo Prometheus: http://localhost:9090
echo.

start http://localhost:5173
start http://localhost:4000

echo.
echo Use stop_dashboard.bat to stop the stack.
echo.
pause
endlocal