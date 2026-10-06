@echo off
title EscanDNI Peru - Acceso Celular Permanente (Ngrok)
cd /d "%~dp0frontend"
cls

echo =======================================================================
echo   ESCANDNI PERU - ACCESO PERMANENTE DESDE CELULAR (NGROK FIJO)
echo =======================================================================
echo.
echo   Iniciando tunel permanente en:
echo   https://obsessive-antiquity-synthesis.ngrok-free.dev
echo.

node start_tunnel.cjs

pause
