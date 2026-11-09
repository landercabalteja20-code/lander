// Player entry. Preview: /engine/player.html?ep=popstar-47-planets
// Render mode (used by render.cjs): add &render=1 — exposes window.renderFrame(t) -> JPEG data URL.
import { Engine } from './engine.js';

const q = new URLSearchParams(location.search);
const epName = q.get('ep') || 'popstar-47-planets';
const render = q.get('render') === '1';
const W = parseInt(q.get('w') || '1080', 10), H = parseInt(q.get('h') || '1920', 10);

const wrap = document.getElementById('wrap');
if (render) {
  document.body.classList.add('render');
  wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
} else {
  const fit = () => { const h = Math.min(innerHeight - 60, 960); wrap.style.height = h + 'px'; wrap.style.width = (h * W) / H + 'px'; };
  fit(); addEventListener('resize', fit);
}

const mod = await import(`../episodes/${epName}/episode.js`);
const ep = mod.default;
const scale = parseFloat(q.get('scale') || '1');
const engine = new Engine({ width: W, height: H, container: wrap, renderScale: scale });
await engine.init(ep);
window.engine = engine;

if (render) {
  window.renderFrame = (t, quality = 0.93) => engine.frame(t, quality);
  window.episodeInfo = { fps: ep.fps, duration: ep.duration };
  window.ready = true;
} else {
  const audio = ep.audio ? new Audio(`../episodes/${epName}/${ep.audio}`) : null;
  const scrub = document.getElementById('scrub'), tl = document.getElementById('time'), btn = document.getElementById('play');
  let playing = false, t = parseFloat(q.get('t') || '0'), last = 0;
  const draw = () => { engine.renderAt(t); scrub.value = (t / ep.duration) * 1000; tl.textContent = t.toFixed(1) + ' s'; };
  btn.onclick = () => {
    playing = !playing; btn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    if (audio) { audio.currentTime = t; playing ? audio.play() : audio.pause(); }
    last = performance.now();
  };
  scrub.oninput = () => { t = (scrub.value / 1000) * ep.duration; if (audio) audio.currentTime = t; draw(); };
  addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); btn.onclick(); } });
  const loop = (now) => {
    if (playing) {
      t = audio ? audio.currentTime : t + (now - last) / 1000; last = now;
      if (t >= ep.duration) { t = 0; if (audio) audio.currentTime = 0; }
      draw();
    }
    requestAnimationFrame(loop);
  };
  draw(); requestAnimationFrame(loop);
}
