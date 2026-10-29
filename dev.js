import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

console.log('\x1b[34m%s\x1b[0m', '=======================================================================');
console.log('\x1b[32m%s\x1b[0m', '   AGROINDUSTRIAS CHAVIN • SISTEMA ESCANDNI PERU                       ');
console.log('\x1b[34m%s\x1b[0m', '=======================================================================');
console.log('\x1b[36m%s\x1b[0m', '  Iniciando servidores locales y enlace celular...');

const pythonCmd = getPythonCommand();

// 1. Start Backend FastAPI (Silencioso para no saturar la pantalla)
const backendFullCmd = `${pythonCmd} -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend`;
const backendProcess = spawn(backendFullCmd, {
  cwd: __dirname,
  shell: true,
  stdio: 'pipe',
  env: { ...process.env, PYTHONUNBUFFERED: '1' }
});

backendProcess.stderr.on('data', (data) => {
  const text = data.toString();
  // Solo mostrar errores reales, no advertencias o mensajes normales
  if (text.includes('Traceback') || text.includes('Error:') || text.includes('CRITICAL')) {
    console.error(`\x1b[31m[Backend Error]\x1b[0m ${text.trim()}`);
  }
});

backendProcess.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `[Backend Error] No se pudo iniciar FastAPI: ${err.message}`);
});

// 2. Start Frontend Vite (Silencioso)
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const frontendFullCmd = `${npmCmd} run dev -- --host 0.0.0.0`;

const frontendProcess = spawn(frontendFullCmd, {
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

// 3. Start Enlace Celular Permanente (Ngrok para diferente Wi-Fi)
let tunnelProcess = null;
try {
  const nodeCmd = process.platform === 'win32' ? 'node.exe' : 'node';
  tunnelProcess = spawn(`${nodeCmd} start_tunnel.cjs`, {
    cwd: path.join(__dirname, 'frontend'),
    shell: true,
    stdio: 'pipe'
  });
} catch (e) {}

// Mantener activo el proceso Node de forma indefinida
const keepAlive = setInterval(() => {}, 1000 * 60 * 60);

// Comprobar disponibilidad y mostrar el panel limpio principal
let backendReady = false;
const healthInterval = setInterval(() => {
  if (backendReady) {
    clearInterval(healthInterval);
    return;
  }
  const req = http.get('http://127.0.0.1:8000/api/health', (res) => {
    if (res.statusCode === 200 && !backendReady) {
      backendReady = true;
      clearInterval(healthInterval);
      const networkIps = getNetworkIps();

      // Limpiar consola para mostrar únicamente los links principales
      try {
        console.clear();
      } catch (e) {}

      console.log('\x1b[32m%s\x1b[0m', '=======================================================================');
      console.log('\x1b[32m%s\x1b[0m', '   AGROINDUSTRIAS CHAVIN • SISTEMA ESCANDNI PERU                       ');
      console.log('\x1b[32m%s\x1b[0m', '=======================================================================');
      console.log('\x1b[32m%s\x1b[0m', '  ✓ SISTEMA 100% LISTO Y OPERATIVO:');
      console.log('\x1b[32m%s\x1b[0m', '=======================================================================');
      console.log('\x1b[36m%s\x1b[0m', '  💻 En tu Laptop                  : http://localhost:5173');
      
      if (networkIps.length > 0) {
        networkIps.forEach(net => {
          console.log('\x1b[32m%s\x1b[0m', `  📶 Celular (Misma red Wi-Fi)     : http://${net.ip}:5173 (${net.name})`);
        });
      }

      console.log('\x1b[35m%s\x1b[0m', '  🌐 Celular (Diferente red Wi-Fi) : https://obsessive-antiquity-synthesis.ngrok-free.dev');
      console.log('\x1b[34m%s\x1b[0m', '  ⚙️ Backend API Docs              : http://127.0.0.1:8000/docs');
      console.log('\x1b[32m%s\x1b[0m', '=======================================================================');
      console.log('\x1b[33m%s\x1b[0m', '  📌 IMPORTANTE: Mantén esta ventana abierta mientras uses el sistema.');
      console.log('\x1b[33m%s\x1b[0m', '     (NO presiones Ctrl+C para evitar que se apaguen los servidores).');
      console.log('\x1b[32m%s\x1b[0m', '=======================================================================\n');
    }
  });
  req.on('error', () => {});
  req.setTimeout(1500, () => req.destroy());
}, 1500);

// Cierre controlado si se interrumpe
let isShuttingDown = false;
function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  clearInterval(keepAlive);
  clearInterval(healthInterval);
  console.log('\n\x1b[33m%s\x1b[0m', 'Cerrando servidores...');
  try {
    if (process.platform === 'win32') {
      if (backendProcess && backendProcess.pid) spawn(`taskkill /pid ${backendProcess.pid} /T /F`, { shell: true, stdio: 'ignore' });
      if (frontendProcess && frontendProcess.pid) spawn(`taskkill /pid ${frontendProcess.pid} /T /F`, { shell: true, stdio: 'ignore' });
      if (tunnelProcess && tunnelProcess.pid) spawn(`taskkill /pid ${tunnelProcess.pid} /T /F`, { shell: true, stdio: 'ignore' });
    } else {
      if (backendProcess) backendProcess.kill('SIGINT');
      if (frontendProcess) frontendProcess.kill('SIGINT');
      if (tunnelProcess) tunnelProcess.kill('SIGINT');
    }
  } catch (e) {}
  setTimeout(() => process.exit(0), 400);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
