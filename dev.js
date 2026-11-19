import { spawn, execSync, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import os from 'os';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentPublicUrl = null;
const savedTunnelFile = path.join(__dirname, 'data', 'tunnel_url.txt');
if (fs.existsSync(savedTunnelFile)) {
  try {
    const saved = fs.readFileSync(savedTunnelFile, 'utf8').trim();
    if (saved.startsWith('https://')) {
      currentPublicUrl = saved;
    }
  } catch (e) {}
}

// Detect Python command
function getPythonCommand() {
  const candidates = ['python', 'py', 'python3'];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch (e) {}
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function getNetworkIps() {
  const interfaces = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        results.push({ name, ip: net.address });
      }
    }
  }
  return results;
}

// Comprobar si un puerto TCP local está respondiendo
function checkPortListening(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Comprobar si una URL responde en vivo HTTP 200/304
async function verifyUrlLive(url, timeoutMs = 6000) {
  if (!url) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    clearTimeout(timer);
    return res.status >= 200 && res.status < 400;
  } catch (e) {
    return false;
  }
}

function generateQrHtml(url, wifiUrl) {
  const cloudUrl = url && url.startsWith('http') && !url.includes('localhost') ? url : '';
  const localUrl = wifiUrl || 'http://localhost:5173';
  const primaryUrl = cloudUrl || localUrl;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EscanDNI Perú - Acceso Móvil</title>
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
      box-sizing: border-box;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 20px;
      padding: 28px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    h1 {
      font-size: 20px;
      margin-bottom: 6px;
      color: #38bdf8;
    }
    p {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 0;
      margin-bottom: 16px;
      line-height: 1.4;
    }
    .qr-container {
      background: white;
      padding: 12px;
      border-radius: 16px;
      display: inline-block;
      margin-bottom: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .qr-container img {
      display: block;
      width: 220px;
      height: 220px;
    }
    .url-box {
      background: #030712;
      border: 1px solid #059669;
      padding: 12px;
      border-radius: 10px;
      font-family: monospace;
      font-size: 13px;
      font-weight: bold;
      color: #34d399;
      word-break: break-all;
      margin-bottom: 16px;
    }
    .btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 13px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      margin-bottom: 10px;
      transition: all 0.1s;
    }
    .btn:active {
      transform: scale(0.98);
    }
    .btn-primary {
      background: linear-gradient(135deg, #059669, #10b981);
      color: white;
    }
    .btn-secondary {
      background: #1f2937;
      color: #e2e8f0;
      border: 1px solid #374151;
    }
    .badge {
      display: inline-block;
      background: #064e3b;
      color: #34d399;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 12px;
    }
    .note {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 14px;
      background: #030712;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid #1f2937;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">🌐 ACCESO UNIVERSAL (CELULAR OTRA LAPTOP)</span>
    <h1>EscanDNI Perú - Acceso Móvil</h1>
    <p>Escanea este código con tu celular (o abre el enlace en otra laptop) desde cualquier lugar sin estar en la misma red:</p>
    
    <div class="qr-container">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(primaryUrl)}" alt="QR Celular" />
    </div>

    <div class="url-box">${primaryUrl}</div>

    <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${primaryUrl}'); alert('¡Enlace copiado al portapapeles!');">
      📋 Copiar Enlace para Celular / WhatsApp
    </button>

    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #1f2937; text-align: left;">
      <div style="font-size: 11px; color: #38bdf8; font-weight: bold; margin-bottom: 5px;">⚡ Alternativa Wi-Fi Local (Si ambos están en la misma red):</div>
      <div style="font-family: monospace; font-size: 12px; color: #94a3b8; word-break: break-all; margin-bottom: 8px;">${localUrl}</div>
      <button class="btn btn-secondary" onclick="navigator.clipboard.writeText('${localUrl}'); alert('¡Enlace Wi-Fi copiado!');" style="font-size: 12px; padding: 9px;">
        Copiar Enlace Wi-Fi Local
      </button>
    </div>

    <a class="btn btn-secondary" href="http://localhost:5173" target="_blank" style="margin-top: 10px;">
      💻 Abrir en esta PC (Localhost)
    </a>

    <div class="note">
      💡 <strong>Acceso Seguro:</strong> El enlace HTTPS abre sin pantallas en blanco ni requerir configuraciones de red complejas.
    </div>
  </div>
</body>
</html>`;
}

function saveMobileLink(url, wifiUrl) {
  const fecha = new Date().toLocaleString();
  const infoTxt = `=======================================================================
  AGROINDUSTRIAS CHAVIN - SISTEMA ESCANDNI PERU
  ENLACE DE ACCESO PARA OTROS DISPOSITIVOS (CELULARES / TABLETS / OTRA LAPTOP)
=======================================================================

🌐 1. ENLACE TEMPORAL NUBE (RECOMENDADO PARA ABRIR EN CELULAR U OTRA LAPTOP):
${url || 'Conectando túnel Cloudflare...'}

ℹ️ ¿POR QUÉ USAR ESTE ENLACE?
- Funciona desde CUALQUIER celular (incluso con datos 4G/5G sin Wi-Fi).
- Funciona desde OTRA laptop o PC en cualquier oficina o fuera de la empresa.
- 100% seguro con HTTPS, sin bloqueos de firewall corporativo ni pantallas en blanco.
- Permite tomar fotos y escanear DNI con la cámara del celular.

-----------------------------------------------------------------------
⚡ 2. ENLACE DIRECTO WI-FI (Si ambos están conectados al mismo Wi-Fi):
${wifiUrl || 'http://localhost:5173'}

💻 3. EN ESTA COMPUTADORA (LOCALHOST):
http://localhost:5173

⚙️ 4. DOCUMENTACION API BACKEND:
http://127.0.0.1:8000/docs

INSTRUCCIONES DE USO:
1. Copia y envía el Enlace Temporal (1) por WhatsApp a tu celular o a la otra laptop.
2. Ábrelo en Chrome o Safari.
3. ¡Listo! Cargará de inmediato en cualquier dispositivo.

Generado automáticamente: ${fecha}
=======================================================================`;

  // 1. Guardar en la raíz del proyecto
  try {
    fs.writeFileSync(path.join(__dirname, 'ENLACE_CELULAR.txt'), infoTxt, 'utf8');
    fs.writeFileSync(path.join(__dirname, 'ENLACE_CELULAR_QR.html'), generateQrHtml(url, wifiUrl), 'utf8');
  } catch (e) {}

  // 2. Guardar en el Escritorio del usuario (OneDrive y Local)
  const desktopPaths = [
    path.join(os.homedir(), 'OneDrive', 'Desktop'),
    path.join(os.homedir(), 'Desktop')
  ];

  desktopPaths.forEach(dp => {
    try {
      if (fs.existsSync(dp)) {
        fs.writeFileSync(path.join(dp, 'ENLACE_CELULAR_DNI.txt'), infoTxt, 'utf8');
        fs.writeFileSync(path.join(dp, 'ABRIR_CELULAR_DNI.html'), generateQrHtml(url, wifiUrl), 'utf8');
      }
    } catch (e) {}
  });
}

console.log('\x1b[34m%s\x1b[0m', '=======================================================================');
console.log('\x1b[32m%s\x1b[0m', '   AGROINDUSTRIAS CHAVIN • SISTEMA ESCANDNI PERU                       ');
console.log('\x1b[34m%s\x1b[0m', '=======================================================================');
console.log('\x1b[36m%s\x1b[0m', '  Iniciando servidores locales y enlace celular...');

const pythonCmd = getPythonCommand();
let backendProcess = null;
let frontendProcess = null;
let tunnelProcess = null;
let backendReady = false;
let mobileTunnelReady = false;

function killOldTunnels() {
  if (tunnelProcess) {
    try { tunnelProcess.kill(); } catch (e) {}
    tunnelProcess = null;
  }
  if (process.platform === 'win32') {
    try { execSync('taskkill /IM cloudflared.exe /F 2>nul'); } catch (e) {}
    try { execSync('powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Where-Object { $_.CommandLine -like \'*start_tunnel*\' } | Stop-Process -Force" 2>nul'); } catch (e) {}
  } else {
    try { execSync('pkill -f "start_tunnel" 2>/dev/null'); } catch (e) {}
  }
}

// Opción para detener todo explícitamente: npm run stop o node dev.js --stop
if (process.argv.includes('--stop')) {
  console.log('\x1b[33m%s\x1b[0m', 'Deteniendo todos los servidores y túneles en segundo plano...');
  killOldTunnels();
  if (process.platform === 'win32') {
    try { execSync('powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'python.exe\'\\" | Where-Object { $_.CommandLine -like \'*uvicorn backend.main:app*\' } | Stop-Process -Force" 2>nul'); } catch (e) {}
    try { execSync('powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Where-Object { $_.CommandLine -like \'*vite*\' -or $_.CommandLine -like \'*start_tunnel*\' } | Stop-Process -Force" 2>nul'); } catch (e) {}
  } else {
    try { execSync('pkill -f "uvicorn backend.main:app" 2>/dev/null'); } catch (e) {}
    try { execSync('pkill -f "vite" 2>/dev/null'); } catch (e) {}
    try { execSync('pkill -f "start_tunnel" 2>/dev/null'); } catch (e) {}
  }
  console.log('\x1b[32m%s\x1b[0m', '✓ Todos los servicios han sido detenidos.');
  process.exit(0);
}

function launchMobileTunnel() {
  if (tunnelProcess) return;

  const nodeCmd = process.platform === 'win32' ? 'node.exe' : 'node';
  const tunnelScript = path.join(__dirname, 'frontend', 'start_tunnel.cjs');

  tunnelProcess = spawn(`${nodeCmd} "${tunnelScript}"`, {
    cwd: path.join(__dirname, 'frontend'),
    shell: true,
    stdio: 'pipe',
  });

  const handleTunnelData = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
      currentPublicUrl = match[0];
      mobileTunnelReady = true;
      const netIps = getNetworkIps();
      const wifiUrl = netIps.length > 0 ? `http://${netIps[0].ip}:5173` : null;
      saveMobileLink(currentPublicUrl, wifiUrl);
      renderBanner();
    }
  };

  if (tunnelProcess.stdout) tunnelProcess.stdout.on('data', handleTunnelData);
  if (tunnelProcess.stderr) tunnelProcess.stderr.on('data', handleTunnelData);

  tunnelProcess.on('close', () => {
    tunnelProcess = null;
    mobileTunnelReady = false;
  });
}

async function bootstrap() {
  // 1. Backend FastAPI: Verificar si ya estaba corriendo
  const isBackendRunning = await checkPortListening(8000);
  if (isBackendRunning) {
    backendReady = true;
    console.log('\x1b[32m%s\x1b[0m', '  ✓ Backend FastAPI ya está activo en puerto 8000');
  } else {
    const backendFullCmd = `${pythonCmd} -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend`;
    backendProcess = spawn(backendFullCmd, {
      cwd: __dirname,
      shell: true,
      stdio: 'pipe',
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    backendProcess.stderr.on('data', (data) => {
      const text = data.toString();
      if (text.includes('Traceback') || text.includes('CRITICAL')) {
        console.error(`\x1b[31m[Backend Error]\x1b[0m ${text.trim()}`);
      }
    });

    backendProcess.on('error', (err) => {
      console.error('\x1b[31m%s\x1b[0m', `[Backend Error] No se pudo iniciar FastAPI: ${err.message}`);
    });
  }

  // 2. Frontend Vite: Verificar si ya estaba corriendo
  const isFrontendRunning = await checkPortListening(5173);
  if (isFrontendRunning) {
    console.log('\x1b[32m%s\x1b[0m', '  ✓ Frontend Vite ya está activo en puerto 5173');
  } else {
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    frontendProcess = spawn(`${npxCmd} vite --host 0.0.0.0`, {
      cwd: path.join(__dirname, 'frontend'),
      shell: true,
      stdio: 'pipe'
    });

    frontendProcess.stderr.on('data', (data) => {
      const text = data.toString();
      if (text.includes('error') || text.includes('Error')) {
        console.error(`\x1b[31m[Frontend Error]\x1b[0m ${text.trim()}`);
      }
    });
  }

  // 3. Enlace Celular / Laptop Externa (Túnel Cloudflare)
  const netIps = getNetworkIps();
  const wifiUrl = netIps.length > 0 ? `http://${netIps[0].ip}:5173` : null;
  saveMobileLink(currentPublicUrl || wifiUrl || 'http://localhost:5173', wifiUrl);
  launchMobileTunnel();

  // Healthcheck de Backend para renderizar banner inicial
  const healthInterval = setInterval(() => {
    if (backendReady) {
      clearInterval(healthInterval);
      renderBanner();
      return;
    }
    const req = http.get('http://127.0.0.1:8000/api/health', (res) => {
      if (res.statusCode === 200 && !backendReady) {
        backendReady = true;
        clearInterval(healthInterval);
        renderBanner();
      }
    });
    req.on('error', () => {});
    req.setTimeout(1500, () => req.destroy());
  }, 1000);
}

// Mantener activo el proceso Node de forma indefinida
const keepAlive = setInterval(() => {}, 1000 * 60 * 60);

// Función para renderizar el panel limpio principal
function renderBanner() {
  const networkIps = getNetworkIps();
  const wifiUrl = networkIps.length > 0 ? `http://${networkIps[0].ip}:5173` : 'http://localhost:5173';

  try {
    console.clear();
  } catch (e) {}

  console.log('\x1b[32m%s\x1b[0m', '=======================================================================');
  console.log('\x1b[32m%s\x1b[0m', '   AGROINDUSTRIAS CHAVIN • SISTEMA ESCANDNI PERU                       ');
  console.log('\x1b[32m%s\x1b[0m', '=======================================================================');
  console.log('\x1b[32m%s\x1b[0m', '  ✓ SISTEMA 100% LISTO Y OPERATIVO:');
  console.log('\x1b[32m%s\x1b[0m', '=======================================================================');
  console.log('\x1b[36m%s\x1b[0m', '  💻 En tu Laptop (Localhost)         : http://localhost:5173');
  
  if (currentPublicUrl) {
    console.log('\x1b[35m%s\x1b[0m', `  🌐 ENLACE TEMPORAL NUBE (RECOMENDADO): ${currentPublicUrl}`);
    console.log('\x1b[35m%s\x1b[0m', `     (Abre en cualquier Celular 4G/5G u OTRA LAPTOP desde cualquier lugar)`);
  } else {
    console.log('\x1b[33m%s\x1b[0m', `  🌐 ENLACE TEMPORAL NUBE             : Conectando túnel Cloudflare...`);
  }

  if (networkIps.length > 0) {
    networkIps.forEach(net => {
      console.log('\x1b[32m%s\x1b[0m', `  ⚡ Red Local Wi-Fi (Misma red)      : http://${net.ip}:5173`);
    });
  }

  console.log('\x1b[34m%s\x1b[0m', '  ⚙️ Backend API Docs                 : http://127.0.0.1:8000/docs');
  console.log('\x1b[32m%s\x1b[0m', '=======================================================================');
  console.log('\x1b[32m%s\x1b[0m', `  📱 Enlace Activo para Celular / Lap : ${currentPublicUrl || wifiUrl}`);
  console.log('\x1b[32m%s\x1b[0m', '  📄 Guardado en tu Escritorio        : "ENLACE_CELULAR_DNI.txt"');
  console.log('\x1b[32m%s\x1b[0m', '  📷 Código QR en pantalla            : "ABRIR_CELULAR_DNI.html"');
  console.log('\x1b[32m%s\x1b[0m', '=======================================================================');
  console.log('\x1b[33m%s\x1b[0m', '  📌 NOTA: Este sistema se mantiene activo en segundo plano.');
  console.log('\x1b[33m%s\x1b[0m', '     Puedes cerrar esta ventana sin que se detenga el servicio.');
  console.log('\x1b[33m%s\x1b[0m', '     Para detener los servicios completamente: npm run stop');
  console.log('\x1b[32m%s\x1b[0m', '=======================================================================\n');
}

// Cierre controlado de la ventana de terminal: los servicios CONTINÚAN en segundo plano
let isShuttingDown = false;
function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  clearInterval(keepAlive);
  console.log('\n\x1b[32m%s\x1b[0m', '=======================================================================');
  console.log('\x1b[32m%s\x1b[0m', '  ✓ CONSOLA CERRADA');
  console.log('\x1b[36m%s\x1b[0m', '  📌 Los servidores y el enlace celular CONTINÚAN ACTIVOS en segundo plano.');
  console.log('\x1b[36m%s\x1b[0m', '  📱 Tu celular puede seguir usando la cámara y el sistema sin problemas.');
  console.log('\x1b[33m%s\x1b[0m', '  🛑 Si deseas apagarlos por completo en cualquier momento: npm run stop');
  console.log('\x1b[32m%s\x1b[0m', '=======================================================================\n');
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

bootstrap();
