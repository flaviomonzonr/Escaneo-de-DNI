const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        return net.address;
      }
    }
  }
  return '192.168.100.27';
}

function getCloudflareUrl() {
  const tunnelFile = path.join(__dirname, 'data', 'tunnel_url.txt');
  if (fs.existsSync(tunnelFile)) {
    const content = fs.readFileSync(tunnelFile, 'utf8').trim();
    if (content.startsWith('https://')) return content;
  }
  return 'https://ons-subjects-pizza-specialties.trycloudflare.com';
}

const localIp = getLocalIp();
const wifiUrl = `http://${localIp}:5173`;
const onlineUrl = getCloudflareUrl();

// Copiar al portapapeles el enlace público temporal para compartir fácilmente
if (process.platform === 'win32') {
  try {
    const proc = exec('clip');
    proc.stdin.write(onlineUrl);
    proc.stdin.end();
  } catch (e) {}
}

const fecha = new Date().toLocaleString();
const infoTxt = `=======================================================================
  AGROINDUSTRIAS CHAVIN - SISTEMA ESCANDNI PERU
  ENLACE DE ACCESO PARA CELULARES Y OTRAS LAPTOPS
=======================================================================

🌐 1. ENLACE TEMPORAL NUBE (RECOMENDADO PARA ABRIR EN CELULAR U OTRA LAPTOP):
${onlineUrl}

ℹ️ ¿POR QUÉ USAR ESTE ENLACE?
- Funciona desde CUALQUIER celular (incluso con datos móviles 4G/5G sin Wi-Fi).
- Funciona desde OTRA laptop o computadora en cualquier oficina o fuera.
- 100% seguro con HTTPS, sin bloqueos de firewall corporativo ni pantallas en blanco.
- Permite tomar fotos y escanear DNI con la cámara del celular.

-----------------------------------------------------------------------
⚡ 2. ENLACE DIRECTO WI-FI (Si ambos están conectados al mismo Wi-Fi):
${wifiUrl}

💻 3. EN ESTA COMPUTADORA (LOCALHOST):
http://localhost:5173

⚙️ 4. DOCUMENTACION API BACKEND:
http://127.0.0.1:8000/docs

INSTRUCCIONES DE USO:
1. Copia y envía el Enlace Temporal (1) por WhatsApp a tu celular o a la otra laptop.
2. Ábrelo en Chrome o Safari.
3. ¡Listo! La pantalla cargará de inmediato en cualquier dispositivo.

Generado automáticamente: ${fecha}
=======================================================================`;

fs.writeFileSync(path.join(__dirname, 'ENLACE_CELULAR.txt'), infoTxt, 'utf8');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>EscanDNI Perú - Acceso para Celular y Otra Laptop</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 20px; padding: 28px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    h1 { font-size: 20px; color: #38bdf8; margin-bottom: 6px; }
    p { color: #94a3b8; font-size: 13px; margin-top: 0; margin-bottom: 16px; line-height: 1.4; }
    .badge-fast { display: inline-block; background: #064e3b; color: #34d399; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-bottom: 12px; }
    .qr { background: white; padding: 12px; border-radius: 16px; display: inline-block; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .qr img { display: block; width: 220px; height: 220px; }
    .url { background: #030712; border: 1px solid #059669; padding: 12px; border-radius: 10px; font-family: monospace; font-size: 13px; font-weight: bold; color: #34d399; word-break: break-all; margin-bottom: 16px; }
    .btn { display: block; width: 100%; box-sizing: border-box; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; border: none; margin-bottom: 10px; transition: transform 0.1s; }
    .btn:active { transform: scale(0.98); }
    .btn-p { background: linear-gradient(135deg, #059669, #10b981); color: white; }
    .btn-s { background: #1f2937; color: #e2e8f0; border: 1px solid #374151; }
    .note { font-size: 11px; color: #94a3b8; margin-top: 14px; background: #030712; padding: 10px; border-radius: 8px; border: 1px solid #1f2937; text-align: left; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge-fast">🌐 ENLACE TEMPORAL UNIVERSAL</div>
    <h1>EscanDNI Perú - Acceso Móvil</h1>
    <p>Escanea este código o abre el enlace en tu celular (4G/5G o Wi-Fi) o desde otra laptop:</p>
    
    <div class="qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(onlineUrl)}" alt="QR Celular" />
    </div>
    
    <div class="url">${onlineUrl}</div>

    <button class="btn btn-p" onclick="navigator.clipboard.writeText('${onlineUrl}'); alert('¡Enlace temporal copiado al portapapeles!');">
      📋 Copiar Enlace para WhatsApp
    </button>

    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #1f2937; text-align: left;">
      <div style="font-size: 11px; color: #38bdf8; font-weight: bold; margin-bottom: 4px;">⚡ Alternativa Wi-Fi Local (Si están en la misma red):</div>
      <div style="font-family: monospace; font-size: 12px; color: #94a3b8; word-break: break-all; margin-bottom: 8px;">${wifiUrl}</div>
      <button class="btn btn-s" onclick="navigator.clipboard.writeText('${wifiUrl}'); alert('¡Enlace Wi-Fi copiado!');" style="font-size: 12px; padding: 9px;">
        Copiar Enlace Wi-Fi Local
      </button>
    </div>

    <a class="btn btn-s" href="http://localhost:5173" target="_blank" style="margin-top: 10px;">
      💻 Abrir en esta PC (Localhost)
    </a>

    <div class="note">
      💡 <strong>Universal:</strong> Este enlace abre de inmediato en cualquier dispositivo con navegador web moderno.
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'ENLACE_CELULAR_QR.html'), htmlContent, 'utf8');

const desktopPaths = [
  path.join(os.homedir(), 'OneDrive', 'Desktop'),
  path.join(os.homedir(), 'Desktop')
];

desktopPaths.forEach(dp => {
  try {
    if (fs.existsSync(dp)) {
      fs.writeFileSync(path.join(dp, 'ENLACE_CELULAR_DNI.txt'), infoTxt, 'utf8');
      fs.writeFileSync(path.join(dp, 'ABRIR_CELULAR_DNI.html'), htmlContent, 'utf8');
      console.log('Saved to Desktop:', dp);
    }
  } catch (e) {}
});

console.log('Mobile links successfully updated with ultra-fast Wi-Fi URL:', wifiUrl);
