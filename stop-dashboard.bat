@echo off
echo ===================================
echo  React TV Dashboard Shutdown Script
echo ===================================
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

echo Stopping React TV Dashboard...
docker stop react-tv-dashboard >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
  echo React TV Dashboard is not running.
) ELSE (
  echo React TV Dashboard has been stopped.
)

echo.
echo You can start it again by running start-dashboard.bat
echo.
pause