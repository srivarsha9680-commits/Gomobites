@echo off
REM Start GoMobites Platform on Windows

color 0A
cls
echo.
echo ======================================
echo   GoMobites SaaS Platform
echo   Starting Local Development Environment
echo ======================================
echo.

REM Check if Docker is running
docker ps >nul 2>&1
if errorlevel 1 (
    color 0C
    echo ERROR: Docker daemon is not running!
    echo.
    echo Please start Docker Desktop first:
    echo 1. Click Start menu and search for "Docker Desktop"
    echo 2. Open Docker Desktop application
    echo 3. Wait for it to fully start
    echo 4. Run this script again
    echo.
    pause
    exit /b 1
)

color 0A
echo Docker is running. Starting services...
echo.

cd /d "%~dp0"
docker-compose up --build

pause
