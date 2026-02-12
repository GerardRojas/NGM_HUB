@echo off
title NGM Vault Desktop
echo.
echo ============================================
echo   NGM Vault Desktop - Quick Launcher
echo ============================================
echo.

:: Check if already configured
if not exist "%USERPROFILE%\.ngm-vault\vault-config.json" (
    echo First-time setup required...
    echo.
    powershell -ExecutionPolicy Bypass -File "%~dp0vault-desktop-setup.ps1" -Setup
    if errorlevel 1 goto :eof
)

:: Mount vault
echo Mounting vault...
powershell -ExecutionPolicy Bypass -File "%~dp0vault-desktop-setup.ps1" -Mount

:: Start file watcher
echo.
echo Starting file watcher for auto-versioning...
echo Press Ctrl+C to stop.
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0vault-file-watcher.ps1" -Verbose
