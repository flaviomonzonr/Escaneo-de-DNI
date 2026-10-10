import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[34m%s\x1b[0m', '=======================================================================');
console.log('\x1b[32m%s\x1b[0m', '   AGROINDUSTRIAS CHAVIN • SISTEMA ESCANDNI PERU - DEV SERVER          ');
console.log('\x1b[34m%s\x1b[0m', '=======================================================================');

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

const pythonCmd = getPythonCommand();
console.log('\x1b[36m%s\x1b[0m', `  [1/2] Iniciando Backend FastAPI (${pythonCmd}) en http://127.0.0.1:8000 ...`);

const backendFullCmd = `${pythonCmd} -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`;
const backendProcess = spawn(backendFullCmd, {
  cwd: __dirname,
  shell: true,
  stdio: 'pipe',
  env: { ...process.env, PYTHONUNBUFFERED: '1' }
});

backendProcess.stdout.on('data', (data) => {
  const text = data.toString();
  text.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      console.log(`\x1b[36m[Backend]\x1b[0m ${trimmed}`);
    }
  });
});

backendProcess.stderr.on('data', (data) => {
  const text = data.toString();
  text.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      console.log(`\x1b[33m[Backend]\x1b[0m ${trimmed}`);
    }
  });
});

backendProcess.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `[Backend Error] Error al iniciar FastAPI: ${err.message}`);
});

// 2. Start Frontend Vite
console.log('\x1b[35m%s\x1b[0m', '  [2/2] Iniciando Frontend Vite (React) en http://localhost:5173 ...');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const frontendFullCmd = `${npmCmd} run dev -- --host 0.0.0.0`;

const frontendProcess = spawn(frontendFullCmd, {
  cwd: path.join(__dirname, 'frontend'),
  shell: true,
  stdio: 'pipe'
});

frontendProcess.stdout.on('data', (data) => {
  const text = data.toString();
  text.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      console.log(`\x1b[35m[Frontend]\x1b[0m ${trimmed}`);
    }
  });
});

frontendProcess.stderr.on('data', (data) => {
  const text = data.toString();
  text.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      console.log(`\x1b[90m[Frontend]\x1b[0m ${trimmed}`);
    }
  });
});

// Check for backend health in background
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
      console.log('\n\x1b[32m%s\x1b[0m', '-----------------------------------------------------------------------');
      console.log('\x1b[32m%s\x1b[0m', '  ✓ SISTEMA 100% LISTO Y OPERATIVO:');
      console.log('\x1b[32m%s\x1b[0m', '    > Laptop:   http://localhost:5173');
      console.log('\x1b[32m%s\x1b[0m', '    > Backend:  http://127.0.0.1:8000/docs');
      console.log('\x1b[32m%s\x1b[0m', '-----------------------------------------------------------------------\n');
    }
  });
  req.on('error', () => {});
  req.setTimeout(1500, () => req.destroy());
}, 2000);

// Clean shutdown
function cleanup() {
  console.log('\n\x1b[33m%s\x1b[0m', 'Cerrando servidores Backend y Frontend...');
  try {
    if (process.platform === 'win32') {
      if (backendProcess && backendProcess.pid) spawn(`taskkill /pid ${backendProcess.pid} /T /F`, { shell: true, stdio: 'ignore' });
      if (frontendProcess && frontendProcess.pid) spawn(`taskkill /pid ${frontendProcess.pid} /T /F`, { shell: true, stdio: 'ignore' });
    } else {
      if (backendProcess) backendProcess.kill('SIGINT');
      if (frontendProcess) frontendProcess.kill('SIGINT');
    }
  } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
