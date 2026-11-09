#!/usr/bin/env node
// Frame renderer: headless Chromium (Playwright) -> JPEG frames -> ffmpeg MP4 with the episode audio.
//
//   node engine/render.cjs <episode> [--workers 3] [--w 1080 --h 1920] [--from 0 --to 192]
//   node engine/render.cjs <episode> --stills 3,12.5,40 [--out dir]      # review stills only
//   node engine/render.cjs <episode> --mux-only                        # re-mux existing frames
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (_) {}
  const g = execSync('npm root -g').toString().trim();
  return require(path.join(g, 'playwright'));
}

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const ep = args[0];
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes('--' + name);
if (!ep) { console.error('usage: render.cjs <episode> [options]'); process.exit(1); }

const W = +opt('w', 1080), H = +opt('h', 1920);
const SCALE = +opt('scale', 1);
const WORKERS = +opt('workers', 3);
const EP_DIR = path.join(ROOT, 'episodes', ep);
const BUILD = path.join(EP_DIR, 'build');
const FRAMES = opt('frames', path.join(BUILD, 'frames'));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
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

const LAUNCH = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] };

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: Math.min(W, 1200), height: Math.min(H, 1200) } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()); });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  await page.goto(`http://127.0.0.1:${port}/engine/player.html?ep=${ep}&render=1&w=${W}&h=${H}&scale=${SCALE}`);
  await page.waitForFunction('window.ready === true', null, { timeout: 180000 });
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
    if (done % 60 === 0) {
      const rate = (Date.now() - t0) / done;
      console.log(`[${label}] ${done}/${frames.length} frames, ${(rate / 1000).toFixed(2)} s/frame, eta ${((frames.length - done) * rate / 60000).toFixed(1)} min`);
    }
  }
  await browser.close();
}

(async () => {
  const pw = loadPlaywright();
  const srv = await serve();
  const port = srv.address().port;
  fs.mkdirSync(BUILD, { recursive: true });

  const stills = opt('stills', null);
  if (stills) {
    const out = opt('out', path.join(BUILD, 'stills'));
    fs.mkdirSync(out, { recursive: true });
    const browser = await pw.chromium.launch(LAUNCH);
    const page = await openPage(browser, port);
    for (const s of stills.split(',')) {
      const t = parseFloat(s);
      const url = await page.evaluate((t) => window.renderFrame(t), t);
      const file = path.join(out, `t${t.toFixed(2).padStart(7, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log('wrote', file);
    }
    await browser.close(); srv.close();
    return;
  }

  // probe episode info
  const probe = await pw.chromium.launch(LAUNCH);
  const pp = await openPage(probe, port);
  const info = await pp.evaluate(() => window.episodeInfo);
  await probe.close();
  const fps = info.fps;
  const from = +opt('from', 0), to = +opt('to', info.duration);
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
  fs.mkdirSync(FRAMES, { recursive: true });

  if (!flag('mux-only')) {
    const all = []; for (let f = f0; f < f1; f++) all.push(f);
    // contiguous chunks per worker so each browser builds as few scenes as possible
    const chunks = Array.from({ length: WORKERS }, (_, i) => all.slice(Math.floor((i * all.length) / WORKERS), Math.floor(((i + 1) * all.length) / WORKERS)));
    console.log(`rendering ${all.length} frames @ ${W}x${H} with ${WORKERS} workers`);
    const T = Date.now();
    await Promise.all(chunks.map((c, i) => renderRange(pw, port, c, fps, 'w' + i)));
    console.log(`frames done in ${((Date.now() - T) / 60000).toFixed(1)} min`);
  }
  srv.close();

  const out = opt('out', path.join(EP_DIR, 'out', `${ep}.mp4`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const audioArg = [];
  const audio = path.join(EP_DIR, 'build', 'song.wav');
  if (fs.existsSync(audio)) audioArg.push('-ss', String(from), '-i', audio);
  const ff = ['-y', '-framerate', String(fps), '-start_number', String(f0), '-i', path.join(FRAMES, '%05d.jpg'), ...audioArg,
    '-frames:v', String(f1 - f0),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    ...(audioArg.length ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), '-movflags', '+faststart', out];
  console.log('ffmpeg', ff.join(' '));
  const r = spawnSync('ffmpeg', ff, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);
  console.log('wrote', out);
})();
