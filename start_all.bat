@echo off
title EscanDNI Peru - Lanzador Todo en Uno
cd /d "%~dp0"
cls

:: Obtener la IP local de la maquina en la red Wi-Fi / Ethernet
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress"`) do set LOCAL_IP=%%i

echo =======================================================================
echo   SISTEMA ESCANDNI PERU - HOST LOCAL ^& ACCESO MULTIDISPOSITIVO
echo =======================================================================
echo.
echo   [1/3] Iniciando Servidor Backend (Python / FastAPI)...
echo         Escuchando en red local: http://0.0.0.0:8000
echo.
start "EscanDNI 1. Backend (NO CERRAR)" cmd /k "title EscanDNI - Backend (Python) && cd /d ""%~dp0"" && python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

echo   [2/3] Iniciando Servidor Frontend (Vite / React)...
echo         Escuchando en red local: http://0.0.0.0:5173
echo.
start "EscanDNI 2. Frontend (NO CERRAR)" cmd /k "title EscanDNI - Frontend (React) && cd /d ""%~dp0frontend"" && npm run dev -- --host 0.0.0.0"

echo   [3/3] Iniciando Enlace Celular para Diferente Wi-Fi (Segundo Plano)...
start /min "EscanDNI 3. Enlace Celular" cmd /k "title EscanDNI - Enlace Celular && cd /d ""%~dp0frontend"" && node start_tunnel.cjs"

echo =======================================================================
echo   ✓ SISTEMA LISTO Y OPERATIVO:
echo =======================================================================
echo.
echo   💻 EN TU LAPTOP:
echo      http://localhost:5173
echo.
echo   📶 EN TU CELULAR / TABLET (Misma red Wi-Fi):
if defined LOCAL_IP (
    echo      http://%LOCAL_IP%:5173
) else (
    echo      http://192.168.68.61:5173
)
echo.
echo   🌐 EN TU CELULAR (Diferente Wi-Fi / Datos Moviles):
echo      https://obsessive-antiquity-synthesis.ngrok-free.dev
echo.
echo   ⚙️ BACKEND API DOCS:
echo      http://127.0.0.1:8000/docs
echo.
echo =======================================================================
echo   📌 IMPORTANTE: NO cierre las ventanas mientras use el sistema.
echo =======================================================================
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173
