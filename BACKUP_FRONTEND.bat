@echo off
REM Frontend Backup Script
REM Created: July 10, 2026

echo ========================================
echo Frontend Backup Script
echo ========================================
echo.

set BACKUP_DIR=D:\oncampus_V2\oncamp_v2\frontend_backup_20260710
set FRONTEND_DIR=D:\oncampus_V2\oncamp_v2\frontend

echo Source: %FRONTEND_DIR%
echo Destination: %BACKUP_DIR%
echo.

if exist "%BACKUP_DIR%" (
    echo WARNING: Backup directory already exists!
    echo Existing backup will be overwritten.
    echo Press Ctrl+C to cancel, or
    pause
    echo Removing old backup...
    rmdir /S /Q "%BACKUP_DIR%"
)

echo.
echo Creating backup...
echo This may take a few minutes...
echo.

xcopy /E /I /H /Y "%FRONTEND_DIR%" "%BACKUP_DIR%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS: Backup created!
    echo ========================================
    echo.
    echo Backup location: %BACKUP_DIR%
    echo.
    echo You can now proceed with frontend migration.
    echo To rollback, run: ROLLBACK_FRONTEND.bat
    echo.
) else (
    echo.
    echo ========================================
    echo ERROR: Backup failed!
    echo ========================================
    echo Please check permissions and disk space.
    echo.
)

pause
