const { spawn } = require('child_process');

async function test() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const port = 9446;
    const userDataDir = 'c:\\apps-flavio\\Escaneo de DNI\\scratch_edge_shot\\debug_profile_inspect2';

    const proc = spawn(edgePath, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--headless=new',
        'http://localhost:8085/'
    ], { stdio: 'ignore' });

    await new Promise(r => setTimeout(r, 2000));
    const targetsRes = await fetch(`http://127.0.0.1:${port}/json`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('8085'));
    if (!pageTarget) { proc.kill(); return; }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let msgId = 1;
    function send(method, params = {}) {
        return new Promise((resolve) => {
            const id = msgId++;
            const handler = (event) => {
                const data = JSON.parse(event.data);
                if (data.id === id) {
                    ws.removeEventListener('message', handler);
                    resolve(data);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    await send('Runtime.enable');
    await send('Page.enable');
    await new Promise(r => setTimeout(r, 2000));

    const evalRes = await send('Runtime.evaluate', {
        expression: `({
            countConectar: document.querySelectorAll('#modal-conectar-celular').length,
            buttonsCerrar: Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Cerrar').length,
            bodyWidth: document.body.clientWidth
        })`,
        returnByValue: true
    });
    console.log('Result:', JSON.stringify(evalRes));

    ws.close();
    proc.kill();
}
test().catch(e => console.error(e));
