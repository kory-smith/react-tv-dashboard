@echo off
echo ===================================
echo  React TV Dashboard Startup Script
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

REM Check Docker service
docker info >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
  echo Docker service is not running!
  echo Please start Docker Desktop first.
  echo.
  pause
  exit /b 1
)

echo Checking for existing dashboard...
docker ps -a | findstr react-tv-dashboard >nul
IF %ERRORLEVEL% EQU 0 (
  echo Found existing dashboard container - stopping and removing it...
  docker stop react-tv-dashboard >nul 2>nul
  docker rm react-tv-dashboard >nul 2>nul
)

echo Creating data volume if needed...
docker volume inspect dashboard-data >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
  echo Creating dashboard data volume...
  docker volume create dashboard-data >nul
)

echo Building the application container... 
echo (This might take a few minutes the first time)
docker build -t react-tv-dashboard . >nul

REM Check if .env file exists, create it if it doesn't
IF NOT EXIST .env (
  echo Creating default .env file...
  echo SESSION_SECRET=default-secret-please-change-in-production>.env
  echo ADMIN_PASSWORD=admin123>>.env
  echo Created .env file with default credentials:
  echo   Admin Email: you@example.com
  echo   Admin Password: admin123
  echo.
  echo NOTE: Please change these in the .env file for security!
) ELSE (
  echo Using existing .env configuration.
)

REM Read values from .env file
FOR /F "tokens=1,2 delims==" %%G IN (.env) DO (
  IF "%%G"=="SESSION_SECRET" SET SESSION_SECRET=%%H
  IF "%%G"=="ADMIN_PASSWORD" SET ADMIN_PASSWORD=%%H
)

echo Starting React TV Dashboard...
docker run -d --name react-tv-dashboard -p 3000:3000 ^
  -v dashboard-data:/app/data ^
  -e SESSION_SECRET=%SESSION_SECRET% ^
  -e ADMIN_PASSWORD=%ADMIN_PASSWORD% ^
  --restart unless-stopped ^
  react-tv-dashboard >nul

REM Check if container started successfully
timeout /t 3 /nobreak >nul
docker ps | findstr react-tv-dashboard >nul
IF %ERRORLEVEL% NEQ 0 (
  echo Failed to start the dashboard! Showing logs:
  docker logs react-tv-dashboard
  echo.
  pause
  exit /b 1
)

echo =====================================================
echo  React TV Dashboard is running!
echo  Open http://localhost:3000 in your web browser
echo.
echo  Login with:
echo    Email: you@example.com
echo    Password: See ADMIN_PASSWORD in .env file
echo =====================================================
echo.
echo To stop the dashboard, run stop-dashboard.bat
echo To view logs, run show-logs.bat
echo.
pause