@echo off
echo =====================================
echo  React TV Dashboard Logs
echo =====================================
echo.

REM Check if Docker is installed
WHERE docker >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
  echo Docker is not installed or not in your PATH!
  echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
  echo.
  pause
  exit /b 1
)

echo Checking if dashboard is running...
docker ps | findstr react-tv-dashboard >nul
IF %ERRORLEVEL% NEQ 0 (
  echo React TV Dashboard is not running.
  echo Please start it first with start-dashboard.bat
  echo.
  pause
  exit /b 1
)

echo Showing logs for React TV Dashboard...
echo (Press Ctrl+C to exit)
echo.
docker logs -f react-tv-dashboard