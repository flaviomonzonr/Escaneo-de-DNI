const { spawn } = require('child_process');
const fs = require('fs');

async function shot() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const port = 9339;
    const userDataDir = 'C:\\apps-flavio\\Escaneo de DNI\\scratch_edge_shot';
    
    const proc = spawn(edgePath, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--headless=new',
        '--window-size=1400,900',
        'http://localhost:5173/'
    ], { stdio: 'ignore' });

    await new Promise(r => setTimeout(r, 2500));
    const targetsRes = await fetch(`http://127.0.0.1:${port}/json`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) { proc.kill(); return; }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let msgId = 1;
    function send(method, params = {}) {
        return new Promise(resolve => {
            const id = msgId++;
            const handler = (evt) => {
                const data = JSON.parse(evt.data);
                if (data.id === id) {
                    ws.removeEventListener('message', handler);
                    resolve(data.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    await send('Page.enable');
    await new Promise(r => setTimeout(r, 2000));
    const shotData = await send('Page.captureScreenshot', { format: 'png' });
    if (shotData && shotData.data) {
        fs.writeFileSync('C:/apps-flavio/Escaneo de DNI/screenshot_high_contrast.png', Buffer.from(shotData.data, 'base64'));
        console.log('SUCCESS: Saved screenshot_high_contrast.png');
    }
    ws.close();
    proc.kill();
}
shot().catch(console.error);

