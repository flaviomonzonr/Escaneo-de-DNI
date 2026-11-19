const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=======================================================================');
console.log('  ESCANDNI PERU - TUNEL NUBE TEMPORAL (CLOUDFLARE)');
console.log('  Acceso para celular (4G/5G) y otra laptop desde cualquier lugar');
console.log('=======================================================================');

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const cf = spawn(npxCmd, ['-y', 'cloudflared', 'tunnel', '--url', 'http://localhost:5173'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

let tunnelUrl = '';

function checkOutput(data) {
  const str = data.toString();
  const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !tunnelUrl) {
    tunnelUrl = match[0];
    console.log('\n  =====================================================================');
    console.log('    TU ENLACE TEMPORAL DE ACCESO PUBLICO ESTA ACTIVO:');
    console.log('    >>> ' + tunnelUrl);
    console.log('  =====================================================================');
    console.log('  * Abre este enlace en el celular (incluso con datos moviles 4G/5G).');
    console.log('  * O abrelo en otra laptop o computadora.');
    console.log('  * 100% seguro con HTTPS sin bloqueos ni pantallas en blanco.');
    console.log('  =====================================================================\n');

    try {
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(path.join(dataDir, 'tunnel_url.txt'), tunnelUrl, 'utf8');
    } catch (e) {}
  }
}

cf.stdout.on('data', checkOutput);
cf.stderr.on('data', checkOutput);

cf.on('close', (code) => {
  console.log(`[!] Tunel Cloudflare finalizo con codigo ${code}`);
});
