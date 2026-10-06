# Script de configuración de red y firewall para EscanDNI
try {
    Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private
    Write-Host "[OK] Perfil de red cambiado a Privada (Confianza local)." -ForegroundColor Green
} catch {
    Write-Host "[AVISO] No se pudo cambiar el perfil de red: $_" -ForegroundColor Yellow
}

try {
    netsh advfirewall firewall delete rule name="EscanDNI-Vite-5173" | Out-Null
    netsh advfirewall firewall add rule name="EscanDNI-Vite-5173" dir=in action=allow protocol=TCP localport=5173 profile=any
    Write-Host "[OK] Puerto 5173 (Frontend Vite) habilitado en el Firewall." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Error configurando puerto 5173: $_" -ForegroundColor Red
}

try {
    netsh advfirewall firewall delete rule name="EscanDNI-FastAPI-8000" | Out-Null
    netsh advfirewall firewall add rule name="EscanDNI-FastAPI-8000" dir=in action=allow protocol=TCP localport=8000 profile=any
    Write-Host "[OK] Puerto 8000 (Backend FastAPI) habilitado en el Firewall." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Error configurando puerto 8000: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  CONFIGURACION EXITOSA - ACCESO WI-FI LISTO          " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Start-Sleep -Seconds 3
