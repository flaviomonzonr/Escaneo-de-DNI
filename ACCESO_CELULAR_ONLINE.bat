@echo off
title EscanDNI Peru - Acceso Online desde Celular (Cloudflare)
cd /d "%~dp0"
cls

echo =======================================================================
echo   ESCANDNI PERU - ACCESO DIRECTO DESDE CELULAR (CLOUDFLARE TUNNEL)
echo =======================================================================
echo.
echo   Iniciando tunel de alta velocidad...
echo   (No requiere contrasenas ni configuraciones)
echo.
echo   Busca la linea que dice: https://xxxx.trycloudflare.com
echo   y abre ese enlace en tu celular.
echo.
echo   * NO cierres esta ventana mientras uses el sistema en tu celular.
echo =======================================================================
echo.

npx -y cloudflared tunnel --url http://localhost:5173

