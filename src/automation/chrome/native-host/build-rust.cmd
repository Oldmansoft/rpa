@echo off
setlocal
cd /d "%~dp0"

echo Stopping running native host (if any)...
taskkill /F /IM rpa_native_host.exe >nul 2>&1
timeout /t 2 /nobreak >nul

cd rust
cargo build --release
if errorlevel 1 exit /b 1

echo.
echo Build complete: %~dp0rust\target\release\rpa_native_host.exe
echo Reload the browser extension or restart Chrome to pick up the new host.
endlocal
