# =======================================================================
# EscanDNI Peru - Inicio Automatico al Prender el Equipo (Background)
# =======================================================================

$projectDir = "c:\apps-flavio\Escaneo de DNI"
Set-Location $projectDir

# 1. Verificar Servidor Backend (Python / FastAPI puerto 8000)
$backendConn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if (-not $backendConn) {
    Write-Output "Iniciando Backend FastAPI en segundo plano..."
    Start-Process -FilePath "python" -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory $projectDir -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# 2. Verificar Servidor Frontend (Vite / React puerto 5173)
$frontendConn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if (-not $frontendConn) {
    Write-Output "Iniciando Frontend Vite en segundo plano..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx vite --host 0.0.0.0" -WorkingDirectory "$projectDir\frontend" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# 3. Verificar Tunel Cloudflare (Para Camara de Celular HTTPS)
$tunnelLog = "$projectDir\tunnel.log"
$url = ""

# Probar si el log actual contiene una URL viva
if (Test-Path $tunnelLog) {
    $content = Get-Content -Path $tunnelLog -Raw -ErrorAction SilentlyContinue
    $allMatches = [regex]::Matches($content, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
    if ($allMatches.Count -gt 0) {
        $candidate = $allMatches[$allMatches.Count - 1].Value
        try {
            $test = Invoke-WebRequest -Uri $candidate -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
            if ($test.StatusCode -eq 200) {
                $url = $candidate
            }
        } catch {}
    }
}

# Si no hay URL viva, reiniciar Cloudflare limpiamente
if (-not $url) {
    Write-Output "Regenerando Tunel Cloudflare..."
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if (Test-Path $tunnelLog) {
        Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue
    }
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx -y cloudflared tunnel --url http://localhost:5173 --logfile ""$tunnelLog""" -WorkingDirectory $projectDir -WindowStyle Hidden

    for ($i = 0; $i -lt 25; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path $tunnelLog) {
            $content = Get-Content -Path $tunnelLog -Raw -ErrorAction SilentlyContinue
            $allMatches = [regex]::Matches($content, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
            if ($allMatches.Count -gt 0) {
                $candidate = $allMatches[$allMatches.Count - 1].Value
                try {
                    $test = Invoke-WebRequest -Uri $candidate -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
                    if ($test.StatusCode -eq 200) {
                        $url = $candidate
                        break
                    }
                } catch {}
            }
        }
    }
}

# 5. Si se obtuvo la URL, guardarla y copiarla al portapapeles
if ($url) {
    # Copiar al portapapeles
    try {
        Set-Clipboard -Value $url -ErrorAction SilentlyContinue
    } catch {}

    $fecha = Get-Date -Format "dd/MM/yyyy HH:mm:ss"
    $infoTxt = @"
=======================================================================
  AGROINDUSTRIAS CHAVIN - SISTEMA ESCANDNI PERU
  ENLACE ACTIVO PARA CELULAR (CAMARA OCR HTTPS)
=======================================================================

ENLACE ACTIVO PARA TU CELULAR:
$url

ENLACE LOCAL EN ESTA COMPUTADORA:
http://localhost:5173

DOCUMENTACION API BACKEND:
http://127.0.0.1:8000/docs

INSTRUCCIONES:
1. Abre el enlace en el navegador de tu celular (Chrome o Safari).
2. La conexion es segura (HTTPS), por lo que la camara funcionara directo.
3. El enlace ya fue copiado a tu portapapeles. Solo dale "Pegar" en WhatsApp.

Generado automaticamente al encender el equipo: $fecha
=======================================================================
"@

    # Guardar en la carpeta del proyecto
    Set-Content -Path "$projectDir\ENLACE_CELULAR.txt" -Value $infoTxt -Encoding UTF8 -Force

    # Guardar en el Escritorio del usuario (OneDrive y Local)
    $desktopPaths = @(
        [System.IO.Path]::Combine($env:USERPROFILE, "OneDrive", "Desktop"),
        [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
    )

    $htmlContent = @"
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EscanDNI Perú - Acceso Celular</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b0f19;
      color: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 20px;
      padding: 30px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    h1 {
      font-size: 20px;
      margin-bottom: 8px;
      color: #38bdf8;
    }
    p {
      font-size: 14px;
      color: #94a3b8;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .qr-container {
      background: white;
      padding: 15px;
      border-radius: 16px;
      display: inline-block;
      margin-bottom: 20px;
    }
    .qr-container img {
      display: block;
      width: 250px;
      height: 250px;
    }
    .url-box {
      background: #030712;
      border: 1px solid #374151;
      padding: 12px;
      border-radius: 10px;
      font-family: monospace;
      font-size: 13px;
      color: #a7f3d0;
      word-break: break-all;
      margin-bottom: 16px;
    }
    .btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 14px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      margin-bottom: 10px;
      transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0284c7, #06b6d4);
      color: white;
    }
    .btn-secondary {
      background: #1f2937;
      color: #e2e8f0;
      border: 1px solid #374151;
    }
    .btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
    .badge {
      display: inline-block;
      background: #064e3b;
      color: #34d399;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 20px;
      margin-bottom: 15px;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">● Sistema Activo en tu PC</span>
    <h1>EscanDNI Perú - Acceso Celular</h1>
    <p>Escanea este código con la cámara de tu celular para abrir la app con soporte para escaneo de DNI.</p>
    
    <div class="qr-container">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=$url" alt="QR Celular" />
    </div>

    <div class="url-box">$url</div>

    <button class="btn btn-primary" onclick="navigator.clipboard.writeText('$url'); alert('¡Enlace copiado al portapapeles!');">
      📋 Copiar Enlace para WhatsApp
    </button>
    <a class="btn btn-secondary" href="http://localhost:5173" target="_blank">
      💻 Abrir en esta Laptop (Localhost)
    </a>
  </div>
</body>
</html>
"@

    foreach ($dp in $desktopPaths) {
        if (Test-Path $dp) {
            Set-Content -Path (Join-Path $dp "ENLACE_CELULAR_DNI.txt") -Value $infoTxt -Encoding UTF8 -Force
            Set-Content -Path (Join-Path $dp "ABRIR_CELULAR_DNI.html") -Value $htmlContent -Encoding UTF8 -Force
        }
    }
    Set-Content -Path "$projectDir\ENLACE_CELULAR_QR.html" -Value $htmlContent -Encoding UTF8 -Force
}

