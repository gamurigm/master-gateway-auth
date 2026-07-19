@echo off
setlocal
set "REPO=%~dp0.."

echo Starting Master Gateway local stack through WSL...
echo.
echo Keep this window open while testing the frontend.
echo Frontend: http://localhost:4200
echo Backend:  http://localhost:3000/api/health
echo.

wsl.exe --cd "%REPO%" -e bash -lc "docker compose up --build opa backend inventario frontend"

echo.
echo Docker Compose finished. Press any key to close.
pause >nul
