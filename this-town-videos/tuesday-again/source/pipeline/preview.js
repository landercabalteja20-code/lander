// node preview.js <outdir> <width> [frac] [shotFrom] [shotTo]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [out, w, frac = '0.6', s0 = '0', s1 = '999'] = process.argv.slice(2); const W = +w, H = Math.round(W * 16 / 9);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto(`http://127.0.0.1:8765/anim.html?w=${W}`);
  await p.waitForFunction(() => window.ready === true || window.loadError, null, { timeout: 120000 });
  const le = await p.evaluate(() => window.loadError); if (le) { console.log('LOAD ERROR', le); await b.close(); return; }
  const shots = await p.evaluate(() => window.SHOTT); console.log('shots', shots.length, 'duration', await p.evaluate(() => window.DURATION));
  const list = s0.includes(',') ? s0.split(',').map(Number) : Array.from({ length: Math.min(shots.length, +s1 + 1) - +s0 }, (_, k) => +s0 + k);
  for (const i of list) {
    const s = shots[i]; const t = s.start + (s.end - s.start) * (+frac);
    try { await p.evaluate(t => window.renderAt(t), t); } catch (e) { console.log('shot', i, 'ERR', e.message.slice(0, 200)); }
    await p.screenshot({ path: `${out}/s${String(i).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 80 });
  }
  console.log('errors:', [...new Set(errs)].slice(0, 15));
  await b.close();
})();
