@echo off
title EscanDNI Peru - Lanzador Todo en Uno
cd /d "%~dp0"
cls

:: Obtener la IP local de la maquina en la red Wi-Fi / Ethernet
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress"`) do set LOCAL_IP=%%i

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
echo   ^> EN TU CELULAR / TABLET (Conectado al mismo Wi-Fi):
if defined LOCAL_IP (
    echo     Abre: http://%LOCAL_IP%:5173
) else (
    echo     Mira la direccion "Network" en la ventana de Frontend (ej. http://192.168.X.X:5173)
)
echo.
echo   IMPORTANTE: NO cierre las ventanas negras mientras use el sistema.
echo   Abriendo navegador en http://localhost:5173 ...
echo =======================================================================
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173
