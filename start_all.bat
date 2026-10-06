@echo off
title EscanDNI Peru - Lanzador Todo en Uno
cd /d "%~dp0"
cls
echo =======================================================================
echo   SISTEMA ESCANDNI PERU - HOST LOCAL EN LAPTOP ^& ACCESO DESDE CELULAR
echo =======================================================================
echo.
echo   [1/2] Iniciando Servidor Backend (Python / FastAPI)...
echo         Escuchando en red local: http://0.0.0.0:8000
echo.
start "EscanDNI 1. Backend (NO CERRAR)" cmd /k "title EscanDNI - Backend (Python) && cd /d ""%~dp0"" && python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

echo   [2/2] Iniciando Servidor Frontend (Vite / React)...
echo         Escuchando en red local: http://0.0.0.0:5173
echo.
start "EscanDNI 2. Frontend (NO CERRAR)" cmd /k "title EscanDNI - Frontend (React) && cd /d ""%~dp0frontend"" && npm run dev -- --host 0.0.0.0"

echo =======================================================================
echo   Ambos servidores se estan iniciando en ventanas independientes.
echo.
echo   ^> EN TU LAPTOP:
echo     Abre: http://localhost:5173
echo.
echo   ^> EN TU CELULAR (Conectado al mismo Wi-Fi):
echo     Mira la direccion "Network" en la ventana de Frontend
echo     Ejemplo: http://192.168.1.XX:5173
echo.
echo   IMPORTANTE: NO cierre las ventanas negras mientras use el sistema.
echo   Abriendo navegador en http://localhost:5173 ...
echo =======================================================================
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173
