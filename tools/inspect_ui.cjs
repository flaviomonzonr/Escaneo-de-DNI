const { spawn } = require('child_process');
const fs = require('fs');

async function test() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const port = 9557;
    const userDataDir = 'c:\\apps-flavio\\Escaneo de DNI\\scratch_edge_shot\\debug_profile_inspect_ui';

    const proc = spawn(edgePath, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--headless=new',
        'http://localhost:5173/'
    ], { stdio: 'ignore' });

    await new Promise(r => setTimeout(r, 2000));
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
    await new Promise(r => setTimeout(r, 1000));

    // Click 'Generar Excel por Lote'
    await send('Runtime.evaluate', {
        expression: `(() => {
            const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Generar Excel') || x.textContent.includes('Excel'));
            if (b) b.click();
        })()`
    });
    await new Promise(r => setTimeout(r, 1500));

    // Inspect UI
    const evalResult = await send('Runtime.evaluate', {
        expression: `(() => {
            const select = document.querySelector('select');
            const selectOptions = select ? Array.from(select.options).map(o => o.text) : [];
            const hasCircle2 = !!document.body.innerText.includes('PANEL DE ASIGNACIÓN MASIVA Y COPIADO DE CONTRATOS');
            const hasPersonalTab = !!document.body.innerText.includes('Plantilla Datos de Personal');
            const hasContractTab = !!document.body.innerText.includes('Matriz Contratos');
            return { selectOptions, hasCircle2, hasPersonalTab, hasContractTab };
        })()`,
        returnByValue: true
    });
    console.log('UI Evaluation:', JSON.stringify(evalResult.result.value, null, 2));

    // Select personal data template
    await send('Runtime.evaluate', {
        expression: `(() => {
            const select = document.querySelector('select');
            if (select) {
                const opt = Array.from(select.options).find(o => o.value.includes('20261102') || o.text.includes('CARGA MASIVA DE DATOS NISIRA'));
                if (opt) {
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        })()`
    });

    await new Promise(r => setTimeout(r, 1500));

    // Capture screenshot of Personal Matrix
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.data) {
        fs.writeFileSync('C:/Users/Usuario/.gemini/antigravity/brain/015feff8-c66d-42ec-9cee-deea21bd28a3/personal_matrix_view.png', Buffer.from(shot.data, 'base64'));
        console.log('Saved personal_matrix_view.png');
    }

    ws.close();
    proc.kill();
}
test().catch(e => console.error(e));

