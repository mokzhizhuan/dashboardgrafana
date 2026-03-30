@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo Stopping Engineering Dashboard
echo ==========================================
echo.

docker compose down

if errorlevel 1 (
    echo.
    echo Failed to stop the Docker stack.
    echo.
    pause
    exit /b 1
)

echo.
echo Stack stopped successfully.
echo.
pause
endlocal