@echo off
title EscanDNI Peru - Lanzador Todo en Uno
cd /d "%~dp0"
cls
echo =======================================================================
echo   SISTEMA ESCANDNI PERU - HOST LOCAL EN LAPTOP ^& ACCESO DESDE CELULAR
echo =======================================================================
echo.
echo   [1/3] Iniciando Servidor Backend (Python / FastAPI)...
echo         Escuchando en: http://0.0.0.0:8000
echo.
start "EscanDNI 1. Backend (NO CERRAR)" cmd /k "title EscanDNI - Backend (Python) && cd /d ""%~dp0"" && python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

echo   [2/3] Iniciando Servidor Frontend (Vite / React)...
echo         Escuchando en: http://0.0.0.0:5173
echo.
start "EscanDNI 2. Frontend (NO CERRAR)" cmd /k "title EscanDNI - Frontend (React) && cd /d ""%~dp0frontend"" && npm run dev -- --host 0.0.0.0"

echo   [3/3] Iniciando Acceso Online Permanente (Ngrok)...
echo         Enlace: https://obsessive-antiquity-synthesis.ngrok-free.dev
echo.
start "EscanDNI 3. Enlace Celular (NO CERRAR)" cmd /k "title EscanDNI - Enlace Celular Permanente && cd /d ""%~dp0frontend"" && node start_tunnel.cjs"

echo =======================================================================
echo   SISTEMA INICIADO EXITOSAMENTE
echo.
echo   ^> EN TU LAPTOP:
echo     http://localhost:5173
echo.
echo   ^> EN TU CELULAR (Desde cualquier lugar del mundo):
echo     https://obsessive-antiquity-synthesis.ngrok-free.dev
echo.
echo   IMPORTANTE: NO cierre las ventanas mientras use el sistema.
echo =======================================================================
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173
