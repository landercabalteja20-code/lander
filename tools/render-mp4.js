#!/usr/bin/env node
// Render the film to MP4: soundtrack offline, frames in a headless browser, H.264 + AAC via ffmpeg.
//
//   cd tools && npm install && cd ..
//   node tools/render-mp4.js --workers 3 --quality high --out hiraya.mp4
//
// Options: --workers N  --quality high|medium|low  --out file.mp4  --from 0 --to 180 (seconds)
// Needs ffmpeg on PATH. Renders 1280x720 at 24 fps.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');

const ROOT = path.resolve(__dirname, '..');
const FPS = 24, W = 1280, H = 720;
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const WORKERS = +(args.workers || 3), QUALITY = args.quality || 'high';
const OUT = path.resolve(args.out || 'hiraya.mp4');
const FROM = Math.round(+(args.from || 0) * FPS), TO = Math.round(+(args.to || 180) * FPS);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hiraya-'));

// ---- static server for the repo ----
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, () => res(srv));
  });
}

// ---- browser page with local three.js and fonts fetched through curl (works behind proxies) ----
const fontCache = new Map();
async function openPage(port, query) {
  const { chromium } = require(require.resolve('playwright', { paths: [__dirname] }));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H + 60 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(900000);
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  const three = path.join(__dirname, 'node_modules/three');
  if (fs.existsSync(three)) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => r.fulfill({ path: path.join(three, r.request().url().split('three@0.160.0/')[1]), contentType: 'application/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => {
    const u = r.request().url();
    try {
      if (!fontCache.has(u)) fontCache.set(u, execFileSync('curl', ['-s', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', u], { maxBuffer: 1 << 26 }));
      r.fulfill({ body: fontCache.get(u), contentType: u.includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
    } catch (e) { r.continue(); }
  });
  await page.goto(`http://localhost:${port}/index.html?q=${QUALITY}&capture=1&${query}`);
  await page.waitForFunction(() => window.__film);
  await page.evaluate(() => document.fonts.ready);
  return { browser, page };
}

// ---- worker: one segment of frames → H.264 ----
async function worker(port, f0, f1, out) {
  const { browser, page } = await openPage(port, `t=${f0 / FPS}`);
  const bb = await page.locator('#frame').boundingBox();
  await page.evaluate(([a, fps]) => { for (let k = Math.round(1.5 * fps); k >= 1; k--) window.__film.step(Math.max(0, (a - k) / fps), 1 / fps); }, [f0, FPS]);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-g', '48', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = f0; f < f1; f++) {
    await page.evaluate(([t, fps]) => window.__film.renderAt(t, 1 / fps), [f / FPS, FPS]);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 93, clip: { x: bb.x, y: bb.y, width: W, height: H } });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
}

// ---- soundtrack → 16-bit WAV ----
async function soundtrack(port, file) {
  const { browser, page } = await openPage(port, 't=0');
  const n = await page.evaluate(async () => {
    const buf = await window.__film.AudioEngine.renderOffline(44100);
    const L = buf.getChannelData(0), R = buf.getChannelData(1), len = L.length;
    const d = new DataView(new ArrayBuffer(44 + len * 4));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); d.setUint32(4, 36 + len * 4, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 2, true);
    d.setUint32(24, 44100, true); d.setUint32(28, 44100 * 4, true); d.setUint16(32, 4, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, len * 4, true);
    for (let i = 0; i < len; i++) { d.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); d.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    window.__wav = new Uint8Array(d.buffer);
    return window.__wav.length;
  });
  const fd = fs.openSync(file, 'w');
  for (let off = 0; off < n; off += 4 << 20) {
    const b64 = await page.evaluate(([o, k]) => { const s = window.__wav.subarray(o, o + k); let x = ''; for (let i = 0; i < s.length; i += 32768) x += String.fromCharCode.apply(null, s.subarray(i, i + 32768)); return btoa(x); }, [off, 4 << 20]);
    fs.writeSync(fd, Buffer.from(b64, 'base64'));
  }
  fs.closeSync(fd);
  await browser.close();
}

// ---- segments split on camera cuts, so physics warm-up seams are hidden by cuts ----
function segments() {
  const cam = fs.readFileSync(path.join(ROOT, 'src/camera.js'), 'utf8');
  const cuts = [...cam.matchAll(/^\s*\[(\d+(?:\.\d+)?), \d/gm)].map((m) => Math.round(parseFloat(m[1]) * FPS));
  const b = [FROM];
  for (const c of [...new Set(cuts)].sort((x, y) => x - y)) if (c > FROM && c < TO && c - b[b.length - 1] >= 4 * FPS) b.push(c);
  b.push(TO);
  return b.slice(0, -1).map((f0, i) => ({ f0, f1: b[i + 1], out: path.join(TMP, `seg_${String(i).padStart(3, '0')}.mp4`) }));
}

(async () => {
  if (process.argv[2] === '--worker') { await worker(+process.argv[3], +process.argv[4], +process.argv[5], process.argv[6]); return; }
  const srv = await serve();
  const port = srv.address().port;
  const t0 = Date.now();
  const log = (m) => console.log(`[${((Date.now() - t0) / 60000).toFixed(1)} min] ${m}`);
  log('rendering soundtrack');
  const wav = path.join(TMP, 'track.wav');
  await soundtrack(port, wav);
  const segs = segments();
  const queue = [...segs];
  let frames = 0;
  log(`rendering ${TO - FROM} frames in ${segs.length} segments with ${WORKERS} workers`);
  const run = () => {
    const s = queue.shift();
    if (!s) return Promise.resolve();
    return new Promise((res, rej) => {
      const p = spawn(process.execPath, [__filename, '--worker', String(port), String(s.f0), String(s.f1), s.out], { stdio: 'inherit' });
      p.on('close', (code) => {
        if (code !== 0) return rej(new Error(`segment ${s.f0}-${s.f1} failed`));
        frames += s.f1 - s.f0;
        log(`${frames}/${TO - FROM} frames`);
        res(run());
      });
    });
  };
  await Promise.all(Array.from({ length: WORKERS }, run));
  const list = path.join(TMP, 'concat.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s.out}'`).join('\n') + '\n');
  const video = path.join(TMP, 'video.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-ss', String(FROM / FPS), '-t', String((TO - FROM) / FPS), '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-metadata', 'title=What If P-POP Was Bigger Than K-POP?', OUT]);
  srv.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  log(`wrote ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
