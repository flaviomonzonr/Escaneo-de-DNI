@echo off
title EscanDNI Peru - Acceso Celular Nube Temporal (Cloudflare)
cd /d "%~dp0frontend"
cls

echo =======================================================================
echo   ESCANDNI PERU - ACCESO TEMPORAL DESDE CELULAR U OTRA LAPTOP
echo =======================================================================
echo.
echo   Iniciando tunel temporal seguro...
echo.

node start_tunnel.cjs

pause
