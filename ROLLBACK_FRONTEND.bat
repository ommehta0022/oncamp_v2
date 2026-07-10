@echo off
REM Frontend Migration Rollback Script
REM Created: July 10, 2026

echo ========================================
echo Frontend Migration Rollback Script
echo ========================================
echo.

set BACKUP_DIR=D:\oncampus_V2\oncamp_v2\frontend_backup_20260710
set FRONTEND_DIR=D:\oncampus_V2\oncamp_v2\frontend

echo Checking if backup exists...
if not exist "%BACKUP_DIR%" (
    echo ERROR: Backup directory not found!
    echo Expected location: %BACKUP_DIR%
    echo Please ensure backup was created before rollback.
    pause
    exit /b 1
)

echo Backup found: %BACKUP_DIR%
echo.
echo WARNING: This will:
echo 1. Delete current frontend directory
echo 2. Restore frontend from backup
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo Step 1: Removing current frontend...
if exist "%FRONTEND_DIR%" (
    rmdir /S /Q "%FRONTEND_DIR%"
    echo Current frontend removed.
) else (
    echo Frontend directory not found (already removed?).
)

echo.
echo Step 2: Restoring from backup...
xcopy /E /I /H /Y "%BACKUP_DIR%" "%FRONTEND_DIR%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS: Frontend restored from backup!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. cd frontend
    echo 2. npm install (or yarn install)
    echo 3. npm start
    echo.
) else (
    echo.
    echo ========================================
    echo ERROR: Rollback failed!
    echo ========================================
    echo Please restore manually from: %BACKUP_DIR%
    echo.
)

pause
