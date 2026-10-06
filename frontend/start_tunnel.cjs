const ngrok = require('@ngrok/ngrok');

async function start() {
  try {
    console.log('=======================================================================');
    console.log('  ESCANDNI PERU - ACCESO PERMANENTE DESDE CELULAR (NGROK FIJO)');
    console.log('=======================================================================');
    console.log('  Iniciando conexion con tu dominio permanente...');
    
    const listener = await ngrok.forward({
      addr: 5173,
      authtoken: '3JiMmGx5tWGjTS1csJ7eJEyzGDX_5caaF5NoGDxv8iFBqAanA',
      domain: 'obsessive-antiquity-synthesis.ngrok-free.dev',
    });

    console.log('\n  =====================================================================');
    console.log('    TU ENLACE PERMANENTE Y FIJO ESTA ACTIVO:');
    console.log('    >>> ' + listener.url());
    console.log('  =====================================================================');
    console.log('\n  * Abre este enlace en el navegador de tu celular.');
    console.log('  * NUNCA cambiara.');
    console.log('  * IMPORTANTE: Mantenga esta ventana abierta mientras use el sistema.');
    console.log('=======================================================================\n');

    // Mantener el proceso Node.js vivo indefinidamente
    setInterval(() => {}, 1000 * 60 * 60);
  } catch (err) {
    console.error('\n  [!] Error al iniciar el tunel:', err.message || err);
    console.log('\n  Asegurate de que el sistema este iniciado con INICIAR_TODO.bat\n');
  }
}

start();
