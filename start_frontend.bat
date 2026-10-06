@echo off
title EscanDNI Peru - Frontend React (Vite 0.0.0.0:5173)
cd /d "%~dp0"
echo ========================================================
echo Iniciando Frontend React (Vite) en red local...
echo ========================================================
cd frontend
npm run dev -- --host 0.0.0.0
pause
