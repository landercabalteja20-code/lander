// node render.js <outdir> <width> <fps> <frameFrom> <frameTo>  -> writes f_%06d.jpg
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [out, w, fps, ranges] = process.argv.slice(2); const W = +w, H = Math.round(W * 16 / 9);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(`http://127.0.0.1:8766/anim.html?w=${W}`);
  await p.waitForFunction(() => window.ready === true || window.loadError, null, { timeout: 180000 });
  const le = await p.evaluate(() => window.loadError); if (le) { console.log('LOAD ERROR', le); process.exit(1); }
  const t0 = Date.now(); let n = 0;
  const frames = []; for (const r of ranges.split(',')) { const [a, b] = r.split('-').map(Number); for (let f = a; f <= b; f++) frames.push(f); }
  for (const f of frames) {
    const file = `${out}/f_${String(f).padStart(6, '0')}.jpg`;
    if (fs.existsSync(file)) continue;
    await p.evaluate(t => window.renderAt(t), f / +fps);
    await p.screenshot({ path: file + '.tmp', type: 'jpeg', quality: 93 }); fs.renameSync(file + '.tmp', file); n++;
    if (n % 100 === 0) console.log(`at ${f}, ${n} done, ${((Date.now() - t0) / n).toFixed(0)} ms/frame`);
  }
  console.log(`done: ${n} frames, ${((Date.now() - t0) / Math.max(1, n)).toFixed(0)} ms/frame`);
  await b.close();
})();
