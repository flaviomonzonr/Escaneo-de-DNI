@echo off
title EscanDNI - Habilitar Acceso en Red Wi-Fi (Firewall)
cd /d "%~dp0"

:: Verificar y solicitar permisos de Administrador automaticamente
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo =======================================================================
echo   CONFIGURANDO FIREWALL DE WINDOWS PARA ACCESO DESDE EL CELULAR
echo =======================================================================
echo.

echo [1/2] Habilitando puerto 5173 (Frontend Vite)...
netsh advfirewall firewall delete rule name="EscanDNI-Vite-5173" >nul 2>&1
netsh advfirewall firewall add rule name="EscanDNI-Vite-5173" dir=in action=allow protocol=TCP localport=5173 profile=any

echo [2/2] Habilitando puerto 8000 (Backend FastAPI)...
netsh advfirewall firewall delete rule name="EscanDNI-FastAPI-8000" >nul 2>&1
netsh advfirewall firewall add rule name="EscanDNI-FastAPI-8000" dir=in action=allow protocol=TCP localport=8000 profile=any

echo.
echo =======================================================================
echo   LISTO! PUERTOS HABILITADOS EN EL FIREWALL DE WINDOWS
echo   Ahora ya puedes ingresar desde tu celular a:
echo   http://192.168.68.55:5173
echo =======================================================================
echo.
pause
