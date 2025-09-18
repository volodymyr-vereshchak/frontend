@echo off
echo ========================================
echo   HLViewer Frontend Server Starter
echo ========================================
echo.

REM Check if Node.js is available
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if dist folder exists
if not exist "dist" (
    echo [ERROR] dist folder not found
    echo Please run build first or deploy the application
    pause
    exit /b 1
)

echo [INFO] Starting React frontend server...
echo [INFO] Server will be available at: http://localhost:8050
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start the Node.js server
node simple-server.js

echo.
echo Server stopped.
pause