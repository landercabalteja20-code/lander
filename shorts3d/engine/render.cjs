#!/usr/bin/env node
// Frame renderer: headless Chromium (Playwright, SwiftShader WebGL) -> JPEG frames -> ffmpeg MP4.
// Adapted from the pop-star studio's renderer (branch claude/funny-gates-8k40w2).
//
//   node engine/render.cjs <episode> --stills 1.5,7,12 [--w 540 --h 960] [--out dir] [--q key=val&...]
//   node engine/render.cjs <episode> [--workers 4] [--from 0 --to 44]       # frames -> build/frames
//   node engine/render.cjs <episode> --mux-only                             # frames + build/mix.wav + build/captions.ass
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const ep = args[0];
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes('--' + name);
if (!ep) { console.error('usage: render.cjs <episode> [options]'); process.exit(1); }

const W = +opt('w', 1080), H = +opt('h', 1920);
const WORKERS = +opt('workers', 4);
const EXTRA = opt('q', '');
const EP_DIR = path.join(ROOT, 'episodes', ep);
const BUILD = path.join(EP_DIR, 'build');
const FRAMES = opt('frames', path.join(BUILD, 'frames'));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, resp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { resp.writeHead(404); return resp.end(); }
      resp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const LAUNCH = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] };

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: Math.min(W, 1200), height: Math.min(H, 1200) } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text().slice(0, 600)); });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  await page.goto(`http://127.0.0.1:${port}/engine/player.html?ep=${ep}&render=1&w=${W}&h=${H}${EXTRA ? '&' + EXTRA : ''}`);
  await page.waitForFunction('window.ready === true || window.loadError', null, { timeout: 300000 });
  const err = await page.evaluate(() => window.loadError);
  if (err) { console.error(err); process.exit(1); }
  return page;
}

async function renderRange(pw, port, frames, fps, label) {
  const browser = await pw.chromium.launch(LAUNCH);
  const page = await openPage(browser, port);
  let done = 0; const t0 = Date.now();
  for (const f of frames) {
    const file = path.join(FRAMES, String(f).padStart(5, '0') + '.jpg');
    if (fs.existsSync(file) && fs.statSync(file).size > 0) { done++; continue; }
    const url = await page.evaluate((t) => window.renderFrame(t), f / fps);
    fs.writeFileSync(file + '.tmp', Buffer.from(url.split(',')[1], 'base64'));
    fs.renameSync(file + '.tmp', file);
    done++;
    if (done % 30 === 0) {
      const rate = (Date.now() - t0) / done;
      console.log(`[${label}] ${done}/${frames.length} frames, ${(rate / 1000).toFixed(2)} s/frame, eta ${((frames.length - done) * rate / 60000).toFixed(1)} min`);
    }
  }
  await browser.close();
}

(async () => {
  const pw = require('playwright');
  const srv = await serve();
  const port = srv.address().port;
  fs.mkdirSync(BUILD, { recursive: true });

  if (flag('shots')) {  // print the shot list (start, end, scene) and mid-shot times
    const browser = await pw.chromium.launch(LAUNCH);
    const page = await openPage(browser, port);
    const shots = await page.evaluate(() => window.engine.ep.shots.map((s) => [s.t0, s.t1, s.scene, s.start]));
    shots.forEach(([a, b, sc, st], i) => console.log(`${String(i + 1).padStart(2)} ${a.toFixed(2).padStart(6)} ${b.toFixed(2).padStart(6)} ${(b - a).toFixed(2).padStart(5)}  ${sc.padEnd(10)} ${st}`));
    console.log('mids', shots.map(([a, b]) => ((a + Math.min(b, a + 6)) / 2).toFixed(2)).join(','));
    await browser.close(); srv.close();
    return;
  }

  const stills = opt('stills', null);
  if (stills) {
    const out = opt('out', path.join(BUILD, 'stills'));
    fs.mkdirSync(out, { recursive: true });
    const browser = await pw.chromium.launch(LAUNCH);
    const page = await openPage(browser, port);
    for (const s of stills.split(',')) {
      const t = parseFloat(s);
      const t0 = Date.now();
      const url = await page.evaluate((t) => window.renderFrame(t), t);
      const file = path.join(out, `t${t.toFixed(2).padStart(6, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log('wrote', file, `(${((Date.now() - t0) / 1000).toFixed(2)} s)`);
    }
    await browser.close(); srv.close();
    return;
  }

  const probe = await pw.chromium.launch(LAUNCH);
  const info = await (await openPage(probe, port)).evaluate(() => window.episodeInfo);
  await probe.close();
  const fps = info.fps;
  const from = +opt('from', 0), to = +opt('to', info.duration);
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
  fs.mkdirSync(FRAMES, { recursive: true });

  if (!flag('mux-only')) {
    const all = []; for (let f = f0; f < f1; f++) all.push(f);
    // interleave frames across workers so every worker builds every scene once and finishes together
    const chunks = Array.from({ length: WORKERS }, (_, i) => all.filter((_, j) => Math.floor(j / 15) % WORKERS === i));
    console.log(`rendering ${all.length} frames @ ${W}x${H} with ${WORKERS} workers`);
    const T = Date.now();
    await Promise.all(chunks.map((c, i) => renderRange(pw, port, c, fps, 'w' + i)));
    console.log(`frames done in ${((Date.now() - T) / 60000).toFixed(1)} min`);
  }
  srv.close();

  const out = opt('out', path.join(EP_DIR, 'out', `${ep}.mp4`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const audio = path.join(BUILD, 'mix.wav');
  const subs = path.join(BUILD, 'captions.ass');
  const fontsDir = path.join(ROOT, 'assets', 'fonts');
  const vf = fs.existsSync(subs) ? ['-vf', `ass=${subs}:fontsdir=${fontsDir}`] : [];
  const ff = ['-y', '-framerate', String(fps), '-start_number', String(f0), '-i', path.join(FRAMES, '%05d.jpg'),
    ...(fs.existsSync(audio) ? ['-ss', String(from), '-i', audio] : []),
    '-frames:v', String(f1 - f0), ...vf,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', opt('crf', '21'), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    ...(fs.existsSync(audio) ? ['-c:a', 'aac', '-b:a', '192k'] : []), '-movflags', '+faststart', out];
  console.log('ffmpeg', ff.join(' '));
  const r = spawnSync('ffmpeg', ff, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);
  console.log('wrote', out);
})();
