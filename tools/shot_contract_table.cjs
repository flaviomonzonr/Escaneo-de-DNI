const { spawn } = require('child_process');
const fs = require('fs');

async function test() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const port = 9555;
    const userDataDir = 'c:\\apps-flavio\\Escaneo de DNI\\scratch_edge_shot\\debug_profile_table';

    const proc = spawn(edgePath, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--headless=new',
        'http://localhost:5173/'
    ], { stdio: 'ignore' });

    await new Promise(r => setTimeout(r, 2500));
    const targetsRes = await fetch(`http://127.0.0.1:${port}/json`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('5173'));
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
                    resolve(data.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    await send('Runtime.enable');
    await send('Page.enable');
    await new Promise(r => setTimeout(r, 2000));

    // Navigate to "Generar Excel por Lote"
    await send('Runtime.evaluate', {
        expression: `
            (() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const btn = buttons.find(b => b.textContent.includes('Generar Excel') || b.textContent.includes('Excel'));
                if (btn) btn.click();
            })()
        `
    });

    await new Promise(r => setTimeout(r, 2500));

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.data) {
        fs.writeFileSync('C:/apps-flavio/Escaneo de DNI/scratch_edge_shot/contract_table_view.png', Buffer.from(shot.data, 'base64'));
        console.log('Saved screenshot to contract_table_view.png');
    }

    ws.close();
    proc.kill();
}
test().catch(e => console.error(e));

