@echo off
title EscanDNI Peru - Backend FastAPI (0.0.0.0:8000)
cd /d "%~dp0"
echo ========================================================
echo Iniciando Backend FastAPI en http://0.0.0.0:8000 ...
echo Accesible en tu Laptop y Celular en la misma red Wi-Fi
echo ========================================================
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
pause
