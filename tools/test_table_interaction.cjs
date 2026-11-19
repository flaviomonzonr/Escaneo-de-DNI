const { spawn } = require('child_process');

async function test() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const port = 9556;
    const userDataDir = 'c:\\apps-flavio\\Escaneo de DNI\\scratch_edge_shot\\debug_profile_test';

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
                    resolve(data.result?.result?.value !== undefined ? data.result.result.value : data.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    await send('Runtime.enable');
    await send('Page.enable');
    await new Promise(r => setTimeout(r, 2000));

    // 1. Click "Generar Excel por Lote"
    const navResult = await send('Runtime.evaluate', {
        expression: `
            (() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const btn = buttons.find(b => b.textContent.includes('Generar Excel') || b.textContent.includes('Excel'));
                if (btn) {
                    btn.click();
                    return 'Navigated';
                }
                return 'Not found';
            })()
        `,
        returnByValue: true
    });
    console.log('Navigation:', navResult);

    await new Promise(r => setTimeout(r, 2000));

    // Select "Todas las fechas" to see all 14 rows
    await send('Runtime.evaluate', {
        expression: `
            (() => {
                const selects = Array.from(document.querySelectorAll('select'));
                const dateSelect = selects.find(s => Array.from(s.options).some(o => o.value === 'all'));
                if (dateSelect) {
                    dateSelect.value = 'all';
                    dateSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    return 'Date set to all';
                }
                return 'Date select not found';
            })()
        `,
        returnByValue: true
    });

    await new Promise(r => setTimeout(r, 2500));

    // 2. Click "S/. 51.82" (Suggested Jornal Agrario)
    const clickJornal = await send('Runtime.evaluate', {
        expression: `
            (() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const chip = buttons.find(b => b.textContent.includes('51.82'));
                if (chip) {
                    chip.click();
                    return 'Clicked S/. 51.82';
                }
                return '51.82 not found';
            })()
        `,
        returnByValue: true
    });
    console.log('Click 51.82 result:', clickJornal);

    await new Promise(r => setTimeout(r, 1500));

    // 3. Verify all 14 rows have 51.82
    const verifyBasicos = await send('Runtime.evaluate', {
        expression: `
            (() => {
                const rows = Array.from(document.querySelectorAll('tbody tr'));
                const inputs = rows.map(r => {
                    const basicInput = r.querySelector('input[type="number"]');
                    return basicInput ? basicInput.value : null;
                });
                return { totalRows: rows.length, allAre5182: inputs.every(v => v === '51.82'), sample: inputs.slice(0, 5) };
            })()
        `,
        returnByValue: true
    });
    console.log('Básicos after applying 51.82 to all rows:', verifyBasicos);

    // 4. Test copying Cod. Planilla from Row 1 to all rows
    const testCopyHeader = await send('Runtime.evaluate', {
        expression: `
            (() => {
                const thButtons = Array.from(document.querySelectorAll('th button'));
                const copyPlanillaBtn = thButtons.find(b => b.title?.includes('Cod. Planilla'));
                if (copyPlanillaBtn) {
                    copyPlanillaBtn.click();
                    return 'Clicked ⬇️ 1° in Cod. Planilla header';
                }
                return 'Header button not found';
            })()
        `,
        returnByValue: true
    });
    console.log('Copy column header test:', testCopyHeader);

    // 5. Test master button "⚡ Copiar Toda la Fila 1 a Filas Seleccionadas"
    const masterBtn = await send('Runtime.evaluate', {
        expression: `
            (() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const btn = buttons.find(b => b.textContent.includes('Copiar Toda la Fila 1'));
                if (btn) {
                    btn.click();
                    return btn.textContent.trim();
                }
                return 'Master btn not found';
            })()
        `,
        returnByValue: true
    });
    console.log('Master button clicked:', masterBtn);

    await new Promise(r => setTimeout(r, 1500));

    // 6. Check toast notification
    const toastCheck = await send('Runtime.evaluate', {
        expression: `
            (() => {
                const toast = document.querySelector('.animate-fade-in span');
                return toast ? toast.textContent.trim() : 'No toast';
            })()
        `,
        returnByValue: true
    });
    console.log('Toast notification active:', toastCheck);

    ws.close();
    proc.kill();
}

test().catch(e => console.error(e));
