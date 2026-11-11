// "What if people never normalized wearing clothes?" — a 3-minute day in a world without clothes.
// Format: references/zackdfilms-3d-shorts/STYLE.md. Shots start on words in build/timeline.json (tools/build_audio.py).
// Family-friendly by construction: doll-smooth cartoon bodies with no anatomy, waist-up framing, props in front
// (desks, counters, seat backs, fanny packs, aprons), and a TV-style pixel mosaic on the one wide race shot.
import * as THREE from 'three';
import { loadCast, blink } from '../../kit/character.js';
import { loadFont, ease, ramp, lerp, clamp01, commas } from '../../kit/fx.js';
import { buildScenes, TLref, at, talk, world, wear, walkNodes, walkTo, bob, pop, carried, V, PI, REST, SIT, SITBED } from './sets.js';

const mixV = (a, b, k) => a.clone().lerp(b, k);
const dist = (a, b) => a.distanceTo(b);
function drift(t, amp = 1) {
  return V(Math.sin(t * 1.3) * 0.006 + Math.sin(t * 3.1 + 1) * 0.002, Math.sin(t * 1.7 + 2) * 0.005, Math.sin(t * 1.1 + 4) * 0.004).multiplyScalar(amp);
}
function aim(cam, pos, target, { fov = 35, roll = 0, t = 0, amp = 1 } = {}) {
  cam.fov = fov; cam.position.copy(pos).add(drift(t, amp)); cam.lookAt(target); if (roll) cam.rotateZ(roll);
}
// camera move from (p0, t0) to (p1, t1) over the shot, eased
const move = (p0, p1, q0, q1, o = {}) => (cam, lt, c) => { const k = (o.ease || ease.inOut)(clamp01(c.u * (o.speed || 1))); aim(cam, mixV(p0, p1, k), mixV(q0, q1, k), { fov: o.fov ?? 35, t: c.t, roll: o.roll ?? 0 }); };
const focusOn = (fn, aperture, maxblur) => ({ focus: (c) => dist(c.camera.position, fn(c)), aperture, ...(maxblur ? { maxblur } : {}) });
const focusAt = (p, aperture) => ({ focus: (c) => dist(c.camera.position, p), aperture });
const head = (c, f = 0.06) => world(c, 'head', [0, 0.16, f]);
const chest = (c) => world(c, 'body', [0, 1.32, 0.1]);
const handL = (c, z = 0.06) => world(c, 'fore_l', [0.01, -0.29, z]);
const handR = (c, z = 0.06) => world(c, 'fore_r', [-0.01, -0.29, z]);
const legend = { saturation: 0.55, contrast: 1.05, warmth: 0.12, vignette: 0.5 };   // ancient-legend grade
function runNodes(ph, amt = 1) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    leg_l: [0.72 * s * amt - 0.12, 0, 0.03], leg_r: [-0.72 * s * amt - 0.12, 0, -0.03],
    shin_l: [0.25 + 1.15 * Math.max(0, -c) * amt, 0, 0], shin_r: [0.25 + 1.15 * Math.max(0, c) * amt, 0, 0],
    arm_l: [-0.75 * s * amt, 0, 0.12], arm_r: [0.75 * s * amt, 0, -0.12], fore_l: [-1.35, 0, 0], fore_r: [-1.35, 0, 0],
  };
}
function runner(r, x, t, extra = {}) {
  const ph = x / 2.4 * PI * 2 + r.seed;
  r.root.position.set(x, Math.abs(Math.cos(ph)) * 0.05, r.lane); r.root.rotation.y = PI / 2;
  r.pose({ body: [0.16, 0, 0], head: [-0.1, 0, 0], lids: blink(t, r.seed), jaw: 0.25, ...extra, nodes: { ...runNodes(ph), ...(extra.nodes || {}) } });
}

// =========================================================================================================
function shotList() {
  const S = [];
  const add = (start, scene, o) => S.push({ start, scene, ...o });

  // ------------------------------------------------------------------ MORNING: ready in ten seconds
  const slam = () => at('n1@wearing') - 0.55;
  const samInBed = (c, extra = {}) => {
    const R = c.S.R, s = R.sam;
    s.root.position.set(0.6, -0.28, -2.0); s.root.rotation.set(0, 0, 0);
    s.pose({ lids: blink(c.t, 1), ...extra, nodes: { ...REST, ...SITBED, ...(extra.nodes || {}) } });
  };
  add('n1', 'bedroom', {
    update(c) {
      const R = c.S.R, t = c.t;
      const ringing = t < slam();
      R.alarm.rotation.set(0, -0.3, ringing ? 0.07 * Math.sin(t * 70) : 0);
      R.alarm.position.y = 0.55 + (ringing ? 0.004 * Math.abs(Math.sin(t * 47)) : 0);
      const reach = ease.inOut(ramp(t, slam() - 0.5, slam())), back = ease.inOut(ramp(t, slam() + 0.25, slam() + 0.7));
      const k = reach * (1 - back);
      samInBed(c, { body: [0.05, -0.2 * k, -0.42 * k], head: [0.1, 0.5 * k, -0.1 * k], lids: lerp(0.15, 0.55, k), nodes: { arm_l: [-0.6 * k, 0.2, 0.07 + 1.25 * k], fore_l: [-0.25 * k, 0, 0] } });
    },
    camera: move(V(1.0, 0.74, -1.72), V(1.06, 0.71, -1.82), V(1.36, 0.62, -2.24), V(1.34, 0.6, -2.24), { fov: 32 }),
    dof: focusAt(V(1.36, 0.6, -2.24), 0.06),
  });
  add('n1@wearing', 'bedroom', {
    update(c) {
      const t = c.t, k = ease.inOut(ramp(t, at('n1@wearing'), at('n1@wearing') + 0.7)), dn = ease.inOut(ramp(t, at('n1@getting') - 0.5, at('n1@getting')));
      const up = k * (1 - dn);
      samInBed(c, { body: [-0.05, 0, 0], head: [-0.25 * up, 0, 0], jaw: 0.75 * up, jawMax: 0.5, lids: lerp(1, 0.25, up) * blink(t, 1), nodes: { arm_l: [-2.75 * up, 0, 0.07 + 0.25 * up], arm_r: [-2.75 * up, 0, -0.07 - 0.25 * up], fore_l: [-0.5 * up, 0, 0], fore_r: [-0.5 * up, 0, 0] } });
    },
    camera: move(V(0.62, 1.22, -0.35), V(0.6, 1.24, -0.6), V(0.6, 1.22, -2.0), V(0.6, 1.26, -2.0), { fov: 36 }),
    dof: focusOn((c) => head(c.S.R.sam), 0.02),
  });
  add('n1@getting', 'bedroom', {
    update(c) {
      const R = c.S.R;
      const arrived = walkTo(R.sam, V(1.55, 0, -0.85), V(-1.25, 0, -0.5), c.t, at('n1@getting') - 0.2, 1.2, { head: [0, -0.15, 0], seed: 1 });
      if (arrived >= 1) R.sam.pose({ lids: blink(c.t, 1), head: [0, -0.45, 0], look: [-0.5, 0], jaw: 0.15, nodes: { ...REST } });
      R.ten.group.visible = c.t > at('n1@10') - 0.05;
      R.ten.group.scale.setScalar(0.68 * pop(c.t, at('n1@10') - 0.05));
    },
    post(c) {
      const R = c.S.R, p = R.sam.root.position;
      const tgt = V(p.x - 0.15, 1.68, p.z + 0.05), dir = c.camera.position.clone().sub(tgt).normalize();
      R.ten.group.position.copy(tgt).addScaledVector(dir, 0.45).add(V(0, -0.16, 0)); R.ten.group.lookAt(c.camera.position);
    },
    camera(cam, lt, c) { const p = c.S.R.sam.root.position; aim(cam, V(Math.max(-2.8, p.x - 1.5), 1.78, p.z + 0.9), V(p.x - 0.15, 1.68, p.z + 0.05), { fov: 30, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.sam), 0.012),
  });
  const icon = (c) => {
    const R = c.S.R, t = c.t;
    const words = ['n2@outfit', 'n2@iron', 'n2@socks'];
    R.icons.forEach((ic, i) => {
      const t0 = at(words[i]) - 0.12;
      ic.it.visible = t > t0; ic.it.scale.setScalar(pop(t, t0));
      ic.it.rotation.y = 0.4 * Math.sin(t * 1.2 + i);
      const tx = t0 + 0.42;
      ic.xm.visible = t > tx; ic.xm.scale.setScalar(t > tx ? lerp(1.8, 1, ease.out(ramp(t, tx, tx + 0.15))) : 0.001);
    });
  };
  add('n2', 'studio', { station: 'icons', update: icon,
    camera: move(V(-1.0, 1.15, 2.3), V(-1.15, 1.1, 2.0), V(-1.25, 0.95, 0), V(-1.2, 0.95, 0), { fov: 36 }),
    dof: focusAt(V(-1.25, 0.9, 0.1), 0.01) });
  add('n2@nothing', 'studio', { station: 'icons', update: icon,
    camera(cam, lt, c) { const k = ease.inOut(ramp(c.t, at('n2@socks') - 0.5, at('n2@socks') - 0.05)), x = lerp(0, 1.25, k); aim(cam, V(x + 0.25, 1.2, 2.2 - 0.15 * c.u), V(x, 0.78, 0), { fov: 36, t: c.t }); },
    dof: { focus: 2.25, aperture: 0.008 } });
  // the closet that became a pantry
  add('n3', 'bedroom', {
    update(c) {
      const R = c.S.R; R.sam.root.position.set(-2.3, 0, -0.5); R.sam.root.rotation.y = -PI / 2;
      const k = ease.inOut(ramp(c.t, at('n3') + 0.4, at('n3@thats') - 0.1));
      R.sam.pose({ lids: blink(c.t, 2), head: [0.05, 0, 0], nodes: { ...REST, arm_l: [-1.0 * k, 0, 0.25 * k], arm_r: [-1.0 * k, 0, -0.25 * k], fore_l: [-0.5 * k, 0, 0], fore_r: [-0.5 * k, 0, 0] } });
    },
    camera: move(V(-2.15, 1.74, 1.0), V(-2.3, 1.72, 0.85), V(-2.38, 1.62, -0.5), V(-2.45, 1.62, -0.5), { fov: 32 }),
    dof: focusAt(V(-2.5, 1.4, -0.5), 0.01),
  });
  add('n3@thats', 'bedroom', {
    update(c) {
      const R = c.S.R, t = c.t;
      const open = ease.out(ramp(t, at('n3@thats'), at('n3@thats') + 0.45));
      R.doors.forEach((d) => { d.hinge.rotation.y = -d.s * 1.9 * open; });
      R.pantryLight.intensity = 1.2 * open;
      R.sam.root.position.set(-2.3, 0, -0.5); R.sam.root.rotation.y = -PI / 2;
      const grab = ease.inOut(ramp(t, at('n3@pantry'), at('n3@pantry') + 0.5)), pull = ease.inOut(ramp(t, at('n3@now') - 0.1, at('n3@now') + 0.35));
      R.sam.pose({ lids: 1, dilate: 1.3, jaw: 0.45 * open, jawMax: 0.5, head: [-0.1, 0.1 * grab, 0], look: [0.0, 0.1],
        nodes: { ...REST, arm_r: [-1.35 * grab + 0.4 * pull, 0, -0.1], fore_r: [-0.35 * grab - 0.6 * pull, 0, 0] } });
      R.chips.visible = grab > 0.5;
      R.chips.position.copy(handR(R.sam, 0.1)); R.chips.rotation.set(0, PI / 2 - 0.3, 0);
    },
    camera: move(V(-3.36, 1.78, -0.42), V(-3.32, 1.77, -0.45), V(-2.3, 1.72, -0.5), V(-2.3, 1.74, -0.5), { fov: 42 }),
    dof: focusOn((c) => head(c.S.R.sam), 0.03),
  });
  add('n3@pantry+-0.1', 'bedroom', {
    update(c) {
      const R = c.S.R, t = c.t;
      R.doors.forEach((d) => { d.hinge.rotation.y = -d.s * 1.9; }); R.pantryLight.intensity = 1.2;
      R.sam.root.position.set(-2.3, 0, -0.5); R.sam.root.rotation.y = -PI / 2;
      const grab = ease.inOut(ramp(t, at('n3@pantry') + 0.2, at('n3@now') + 0.2)), pull = ease.inOut(ramp(t, at('n3@now') + 0.25, at('n3@now') + 0.6));
      R.sam.pose({ lids: 1, nodes: { ...REST, arm_r: [-1.4 * grab + 0.5 * pull, 0, -0.1], fore_r: [-0.2 * grab - 0.5 * pull, 0, 0] } });
      R.chips.visible = true;
      R.chips.position.copy(grab > 0.85 ? handR(R.sam, 0.1) : V(-3.3, 1.38 + 0.13, -0.47)); R.chips.rotation.set(0, PI / 2 - 0.3 * grab, 0);
    },
    camera: move(V(-2.15, 1.72, -0.2), V(-2.3, 1.7, -0.3), V(-3.3, 1.35, -0.55), V(-3.3, 1.38, -0.5), { fov: 42 }),
    dof: focusAt(V(-3.25, 1.4, -0.5), 0.012),
  });

  // ------------------------------------------------------------------ no pockets
  const doorOpen = (c) => { c.S.R.doorHinge.rotation.y = -1.45 * ease.out(ramp(c.t, at('n4') - 0.2, at('n4') + 0.4)); };
  const holdItems = (c, hold = 1) => {
    const R = c.S.R, s = R.sam;
    const drop = at('n4@pockets') - 0.17;
    [[R.items[0], 'fore_r', [-0.01, -0.3, 0.06], [0.2, 0.6, 0.7]], [R.items[1], 'fore_l', [0.01, -0.3, 0.06], [-0.3, 0.5, 0.9]], [R.items[2], 'fore_l', [0.0, -0.27, 0.07], [0.1, 0.3, 0.5]]]
      .forEach(([m, node, loc, kick], i) => { m.visible = true; carried(m, s, node, loc, c.t, drop + i * 0.04, 0.16, [4 + i, 3 - i, 2], kick); });
  };
  const holding = { arm_l: [-0.55, 0, 0.12], arm_r: [-0.55, 0, -0.12], fore_l: [-0.95, 0, 0], fore_r: [-0.95, 0, 0] };
  const clearDoor = (c) => c.S.R.crowd.forEach((p) => { if (Math.abs(p.root.position.x) < 2.4) p.root.visible = false; });
  add('n4', 'street', {
    update(c) {
      clearDoor(c); const R = c.S.R; doorOpen(c); wear(R.sam, 'pack', false);
      walkTo(R.sam, V(0, 0.15, -8.7), V(0, 0.15, -7.05), c.t, at('n4') + 0.05, 1.0, { nodes: holding, head: [0.1, 0, 0] });
      R.sam.pose({ lids: blink(c.t, 2), head: [0.12, 0, 0], look: [0, -0.2], nodes: { ...REST, ...(c.t < at('n4') + 1.7 ? walkNodes((c.t - at('n4')) * 1.0 / 1.4 * PI * 2, 1, false) : {}), ...holding } });
      holdItems(c);
    },
    camera(cam, lt, c) { const h = head(c.S.R.sam); aim(cam, V(h.x + 0.35, h.y + 0.02, Math.max(h.z + 1.65, -6.4)), h.clone().add(V(0, -0.14, 0)), { fov: 30, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.sam), 0.01),
  });
  add('n4@no', 'street', {
    update(c) {
      clearDoor(c); const R = c.S.R, t = c.t; doorOpen(c); wear(R.sam, 'pack', false);
      R.sam.root.position.set(0, 0.15, -7.05); R.sam.root.rotation.y = 0;
      const k = ease.inOut(ramp(t, at('n4@no') + 0.2, at('n4@pockets') - 0.25));   // hands slide down looking for pockets
      const n = { arm_l: [lerp(-0.55, -0.12, k), 0, lerp(0.12, 0.22, k)], arm_r: [lerp(-0.55, -0.12, k), 0, lerp(-0.12, -0.22, k)], fore_l: [lerp(-0.95, -0.25, k), 0, 0], fore_r: [lerp(-0.95, -0.25, k), 0, 0] };
      R.sam.pose({ lids: blink(t, 2), head: [0.35 * k + 0.1, 0.1 * Math.sin(t * 3) * k, 0], look: [0, -0.5], dilate: 1 + 0.3 * k, jaw: 0.2 * k, nodes: { ...REST, ...n } });
      holdItems(c);
    },
    camera: move(V(0.34, 1.74, -6.0), V(0.3, 1.72, -6.1), V(0, 1.64, -7.05), V(0, 1.6, -7.05), { fov: 30 }),
    dof: focusOn((c) => head(c.S.R.sam), 0.015),
  });
  add('n4@pockets+-0.05', 'street', {
    update(c) {
      clearDoor(c); const R = c.S.R, t = c.t; doorOpen(c); wear(R.sam, 'pack', false);
      R.sam.root.position.set(0, 0.15, -7.05); R.sam.root.rotation.y = 0;
      R.sam.pose({ lids: 1, head: [0.5, 0, 0], look: [0, -0.6], jaw: 0.4, nodes: { ...REST, arm_l: [-0.12, 0, 0.22], arm_r: [-0.12, 0, -0.22], fore_l: [-0.25, 0, 0], fore_r: [-0.25, 0, 0] } });
      holdItems(c);
    },
    camera: move(V(0.55, 0.32, -5.7), V(0.5, 0.3, -5.85), V(0, 0.2, -6.85), V(0, 0.2, -6.85), { fov: 38 }),
    dof: focusAt(V(0, 0.18, -6.75), 0.04),
  });
  // everyone wears a fanny pack
  add('n5', 'street', {
    camera: move(V(7.6, 4.8, -5.0), V(6.2, 4.2, -5.4), V(0.5, 0.9, -6.2), V(-0.8, 1.0, -6.2), { fov: 36 }),
    update(c) { c.S.R.sam.root.visible = false; },
    dof: { focus: 6.0, aperture: 0.004 },
  });
  add('n5@fanny+-0.1', 'street', {
    update(c) {
      clearDoor(c); const R = c.S.R, t = c.t; wear(R.sam, 'pack', true);
      R.sam.root.position.set(0, 0.15, -6.9); R.sam.root.rotation.y = 0;
      R.sam.pose({ lids: 1, head: [0.45, 0, 0], look: [0, -0.5], nodes: { ...REST, arm_l: [-0.35, 0.2, 0.1], fore_l: [-0.9, 0, 0.2], arm_r: [-0.35, -0.2, -0.1], fore_r: [-0.9, 0, -0.2] } });
      const k = ease.inOut(ramp(t, at('n5@fanny') - 0.05, at('n5@fanny') + 0.45));
      R.zip.visible = true;
      R.zip.position.copy(world(R.sam, 'body', [lerp(-0.08, 0.08, k), 0.922, 0.168])); R.zip.rotation.set(0, 0, 0);
    },
    camera: move(V(0.05, 1.085, -6.32), V(0.04, 1.08, -6.35), V(0, 1.075, -6.75), V(0, 1.075, -6.75), { fov: 30 }),
    dof: focusAt(V(0, 1.05, -6.75), 0.02),
  });
  add('n5@making', 'studio', { station: 'pack',
    update(c) {
      const R = c.S.R; R.packTurn.rotation.y = c.t * 0.9;
      const p = pop(c.t, at('n5@best') - 0.05); R.one.group.scale.setScalar(p); R.best.group.scale.setScalar(pop(c.t, at('n5@best') + 0.1));
    },
    camera: move(V(0.2, 1.7, 3.4), V(0.7, 1.55, 3.0), V(0, 1.35, 0), V(0, 1.4, 0), { fov: 36 }),
    dof: focusAt(V(0, 1.3, 0), 0.006) });
  add('n5@accessory', 'studio', { station: 'globe',
    update(c) { const R = c.S.R; R.earth.rotation.y = c.t * 0.25; R.clouds.rotation.y = c.t * 0.3; },
    camera: move(V(0, 1.42, 2.4), V(0, 1.7, 7.4), V(0, 1.38, 0), V(0, 1.5, 0), { fov: 36, ease: ease.out }),
    exposure: 1.1 });

  // ------------------------------------------------------------------ FASHION moves onto your skin
  const flashes = 1;
  add('n6', 'runway', { flashes,
    update(c) { const R = c.S.R; walkTo(R.leopard, V(0, 0.5, -10.4), V(0, 0.5, -2.0), c.t, at('n6') - 0.6, 1.15, { head: [-0.05, 0, 0], seed: 3, nodes: { arm_l: [0, 0, 0.05], arm_r: [0, 0, -0.05] } }); R.tux.root.visible = false; },
    camera: move(V(0.55, 1.0, -0.6), V(0.4, 1.05, -1.4), V(0, 1.55, -8.0), V(0, 1.6, -7.2), { fov: 28 }),
    dof: focusOn((c) => head(c.S.R.leopard), 0.012) });
  const strokeK = (c) => ease.inOut(ramp(c.t, at('n6@it') + 0.1, at('n7') - 0.15));
  add('n6@it', 'runway', {
    update(c) {
      const R = c.S.R, k = strokeK(c);
      const n = Math.floor(k * R.strokeGeo.index.count / 6) * 6; R.stroke.geometry.setDrawRange(0, n);
      const pts = R.strokePts, p = pts[Math.min(pts.length - 1, Math.floor(k * (pts.length - 1)))].clone();
      R.diva.root.updateMatrixWorld(true); const w = R.stroke.localToWorld(p);
      R.brush.position.copy(w).add(V(0.0, 0.02, 0.0)); R.brush.rotation.set(0.3, 0, -0.5);
    },
    camera(cam, lt, c) { const m = world(c.S.R.diva, 'arm_l', [0.02, -0.12, 0.0]); aim(cam, m.clone().add(V(0.28 - 0.04 * c.u, 0.1, 0.32)), m, { fov: 32, t: c.t }); },
    dof: focusOn((c) => world(c.S.R.diva, 'arm_l', [0.02, -0.12, 0.0]), 0.03) });
  add('n7', 'runway', {
    update(c) { const R = c.S.R; R.stroke.geometry.setDrawRange(0, Infinity); R.painter.pose({ lids: blink(c.t, 5), head: [0.05, 0.3, 0], nodes: { ...REST, arm_r: [-0.9, 0, -0.5], fore_r: [-1.3, 0, 0], arm_l: [-0.4, 0, 0.3], fore_l: [-1.1, 0, 0] } }); },
    camera(cam, lt, c) { const h = chest(c.S.R.painter); aim(cam, h.clone().add(V(-1.0 + 0.1 * c.u, 0.2, 0.3)), h.clone().add(V(0, 0.12, 0)), { fov: 34, t: c.t }); },
    dof: focusOn((c) => chest(c.S.R.painter), 0.02) });
  add('n7@glitter', 'runway', {
    update(c) { const R = c.S.R; R.stroke.geometry.setDrawRange(0, Infinity); },
    camera(cam, lt, c) { const h = world(c.S.R.diva, 'body', [0.0, 1.25, 0.1]); aim(cam, h.clone().add(V(0.32, 0.12 + 0.05 * c.u, 0.42)), h, { fov: 30, t: c.t }); },
    dof: focusOn((c) => world(c.S.R.diva, 'body', [0.0, 1.25, 0.1]), 0.04), bloom: { strength: 0.9, threshold: 0.7 } });
  add('n7@tattoos', 'runway', {
    update(c) { const R = c.S.R, f = 0.5 + 0.5 * Math.sin(c.t * 4); R.tat.pose({ lids: blink(c.t, 7), jaw: 0.2, head: [0.05, 0.45, 0.05], look: [0.6, 0], nodes: { ...REST, arm_l: [-0.1, 0, 1.45], fore_l: [0, 0, 1.45 + 0.2 * f], arm_r: [0, 0, -0.1] } }); },
    camera(cam, lt, c) { const h = head(c.S.R.tat); aim(cam, h.clone().add(V(0.6 - 0.1 * c.u, -0.06, 1.45)), h.clone().add(V(0.16, -0.18, 0.05)), { fov: 38, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.tat), 0.015) });
  add('n7@and#2', 'runway', { flashes,
    update(c) {
      const R = c.S.R, t = c.t, part = ease.inOut(ramp(t, at('n7@trend') - 0.1, at('n7@trend') + 0.5));
      R.curtains.forEach((m, i) => { m.position.x = (i ? 1 : -1) * (0.65 + 1.1 * part); });
      R.leopard.root.visible = false;
      walkTo(R.tux, V(0, 0.5, -12.4), V(0, 0.5, -2.0), t, at('n7@trend') + 0.35, 1.05, { seed: 4, nodes: { arm_l: [0, 0, 0.05], arm_r: [0, 0, -0.05] } });
    },
    camera: move(V(0, 1.9, 2.6), V(0, 1.7, 1.6), V(0, 1.7, -11), V(0, 1.6, -11), { fov: 30 }),
    dof: { focus: 12, aperture: 0.002 } });
  add('n7@painted', 'runway', { flashes,
    update(c) { const R = c.S.R; R.leopard.root.visible = false; walkTo(R.tux, V(0, 0.5, -9.4), V(0, 0.5, -2.0), c.t, at('n7@painted') - 0.1, 1.1, { seed: 4, head: [-0.08, 0, 0], nodes: { arm_l: [0, 0, 0.05], arm_r: [0, 0, -0.05] } }); },
    camera: move(V(0.55, 1.1, -2.6), V(0.35, 1.15, -3.3), V(0, 1.4, -8.4), V(0, 1.45, -7.4), { fov: 30 }),
    dof: focusOn((c) => chest(c.S.R.tux), 0.012) });

  // ------------------------------------------------------------------ UNIFORMS: a hat and a badge
  add('n8', 'studio', { station: 'uniform',
    update(c) {
      const R = c.S.R, t = c.t;
      const sh = 1 - ease.inOut(ramp(t, at('n8@shrink'), at('n8@bare') + 0.1));
      R.uShirt.scale.setScalar(Math.max(0.001, sh)); R.uPants.scale.setScalar(Math.max(0.001, sh)); R.uShoes.scale.setScalar(Math.max(0.001, sh));
      const b = 1 + 0.25 * Math.exp(-Math.max(0, t - at('n8@bare') - 0.1) * 6) * (t > at('n8@bare') + 0.1 ? 1 : 0);
      R.uCap.scale.setScalar(b); R.uBadge.scale.setScalar(b);
      R.uCap.rotation.y = 0.3 * Math.sin(t * 1.3); R.uBadge.rotation.y = 0.3 * Math.sin(t * 1.3 + 1);
      R.minimum.group.visible = t > at('n8@bare') - 0.05; R.minimum.group.scale.setScalar(pop(t, at('n8@bare') - 0.05));
    },
    camera: move(V(0.3, 1.35, 3.7), V(0.1, 1.5, 3.2), V(0, 1.15, 0), V(0, 1.55, 0), { fov: 38 }),
    dof: focusAt(V(0, 1.3, 0), 0.006) });
  add('n8@a', 'street', {
    update(c) {
      const R = c.S.R, t = c.t, tip = Math.sin(ramp(t, at('n8@police') + 0.2, at('n8@police') + 1.0) * PI);
      R.sam.root.visible = false;
      R.cop.pose({ lids: blink(t, 3), head: [0.1 * tip, 0.1, 0], nodes: { ...REST, arm_r: [-2.4 * tip, 0, -0.25 * tip], fore_r: [-1.2 * tip, 0, 0], arm_l: [0, 0, 0.12] } });
    },
    camera: move(V(5.6, 1.35, -0.2), V(6.1, 1.3, 0.3), V(7.0, 1.55, 4.75), V(7.0, 1.6, 4.75), { fov: 30 }),
    dof: focusOn((c) => head(c.S.R.cop), 0.012), grade: { saturation: 1.18 } });
  add('n8@hat', 'street', {
    update(c) { const R = c.S.R; R.sam.root.visible = false; R.cop.pose({ lids: blink(c.t, 3), head: [-0.05, 0.05, 0], nodes: { ...REST, arm_l: [0, 0, 0.12] } }); },
    camera(cam, lt, c) {
      const R = c.S.R, k = ease.inOut(ramp(c.t, at('n8@hat') + 0.25, at('n8@badge') + 0.1));
      const top = world(R.cop, 'head', [0, 0.32, 0.08]), bd = world(R.cop, 'body', [0, 1.27, 0.12]);
      const tg = mixV(top, bd, k);
      aim(cam, tg.clone().add(V(-0.25, 0.05, -0.85)), tg, { fov: 30, t: c.t });
    },
    dof: focusOn((c) => world(c.S.R.cop, 'body', [0, 1.45, 0.1]), 0.02) });
  add('n9', 'restaurant', {
    camera: move(V(0.7, 1.55, 1.75), V(0.35, 1.5, 1.35), V(0, 1.38, -0.2), V(0, 1.42, -0.2), { fov: 36 }),
    dof: focusOn((c) => head(c.S.R.chef), 0.012) });
  // the boss still wears a tie
  const bossDesk = (c, extra = {}) => {
    const R = c.S.R, t = c.t, fix = Math.max(0, Math.sin(ramp(t, at('n10@tie') - 0.5, at('n10@tie') + 0.7) * PI));
    R.boss.pose({ lids: blink(t, 6), head: [-0.05, 0, 0], ...extra,
      nodes: { ...REST, ...SIT, arm_l: [-0.6, 0, 0.15], fore_l: [-0.9, 0, 0], arm_r: [-0.6 - 0.9 * fix, 0, -0.15 + 0.25 * fix], fore_r: [-0.9 - 1.1 * fix, 0, 0.2 * fix], ...(extra.nodes || {}) } });
  };
  add('n10', 'office', {
    update(c) { bossDesk(c); c.S.R.boss2.root.visible = false; },
    camera: move(V(7.7, 1.55, 1.9), V(8.7, 1.5, 0.9), V(11, 1.25, -1.8), V(11, 1.25, -1.9), { fov: 34 }),
    dof: focusOn((c) => head(c.S.R.boss), 0.006) });
  add('n10@your', 'office', {
    update(c) { bossDesk(c, { head: [-0.12, 0.05, 0], lids: 0.85 * blink(c.t, 6) }); c.S.R.boss2.root.visible = false; },
    camera: move(V(11.05, 1.15, 0.05), V(11.0, 1.2, -0.2), V(11, 1.3, -2.0), V(11, 1.33, -2.0), { fov: 32 }),
    dof: focusOn((c) => chest(c.S.R.boss), 0.012) });
  add('boss+-0.1', 'office', {
    update(c) { const m = talk('boss', c.t, 1.1); bossDesk(c, { jaw: m, jawMax: 0.35, head: [-0.08 + 0.05 * m, 0.1 * Math.sin(c.t * 2), 0.05], lids: 0.75, nodes: { brow_l: [0, 0, 0.15], brow_r: [0, 0, -0.15] } }); c.S.R.boss2.root.visible = false; },
    camera(cam, lt, c) { const h = head(c.S.R.boss); aim(cam, h.clone().add(V(0.25, -0.03, 1.05 - 0.1 * c.u)), h.clone().add(V(0, -0.06, 0)), { fov: 30, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.boss), 0.03) });

  // ------------------------------------------------------------------ HISTORY: 170,000 years, lice, the Greeks
  add('n11', 'cave', {
    camera: move(V(0.3, 1.5, 4.7), V(0.15, 1.38, 3.9), V(0, 0.8, 0), V(0, 0.85, 0), { fov: 46 }),
    dof: { focus: 3.5, aperture: 0.006 } });
  add('n11@as', 'cave', {
    update(c) { const R = c.S.R, k = ease.out(ramp(c.t, at('n11@as') + 0.15, at('n11@170') + 0.3)); R.years.group.visible = true; R.years.group.position.y = lerp(-0.6, 1.95, k); },
    camera: move(V(-1.5, 1.6, 3.4), V(1.2, 1.75, 3.5), V(0, 1.4, -1.6), V(0, 1.75, -1.6), { fov: 40 }),
    dof: { focus: 4.6, aperture: 0.004 } });
  const itch = (c, amt = 1) => {
    const R = c.S.R, s = Math.sin(c.t * 22) * amt;
    R.man.pose({ lids: blink(c.t, 2) * 0.8, head: [0.25, 0.2, 0.1], jaw: 0.2, look: [0.2, -0.6], nodes: { ...REST, ...SIT, arm_r: [-0.45 + 0.08 * s, 0.3, -0.35], fore_r: [-1.75 + 0.15 * s, 0, 0], arm_l: [-0.7, 0, 0.1], fore_l: [-0.8, 0, 0] } });
  };
  add('n12', 'cave', { update: itch,
    camera(cam, lt, c) { const h = head(c.S.R.man); aim(cam, h.clone().add(V(0.95, -0.12, 0.55)), h.clone().add(V(0.0, -0.18, 0)), { fov: 34, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.man), 0.02) });
  const louseAt = (c) => world(c.S.R.man, 'pelt', [0.03, 0.12, 0.165]);
  add('n12@we#2', 'cave', {
    update(c) {
      const R = c.S.R; itch(c, 0);
      const k = pop(c.t, at('n12@lice') - 0.2, 0.3);
      R.louse.root.visible = true; R.louse.root.scale.setScalar(0.3 * k);
      R.louse.root.position.copy(louseAt(c)); R.louse.root.lookAt(c.camera.position.x, R.louse.root.position.y, c.camera.position.z);
      R.louse.root.rotateX(-0.6);
      R.louse.pose({ lids: blink(c.t, 4, 1.6), look: [0, 0.2], nodes: Object.fromEntries(['0', '1', '2'].flatMap((i) => [[`leg${i}l`, [0, 0, 0.2 * Math.sin(c.t * 9 + +i)]], [`leg${i}r`, [0, 0, -0.2 * Math.sin(c.t * 9 + +i)]]])) });
    },
    camera(cam, lt, c) { const p = louseAt(c); aim(cam, p.clone().add(V(0.22, 0.05, 0.12)), p.clone().add(V(0, 0.01, 0)), { fov: 30, t: c.t, amp: 0.3 }); },
    dof: focusOn(louseAt, 0.05) });
  const crawl = (c) => {
    const R = c.S.R, t = c.t, x = -1.4 + (t - at('n13')) * 0.55, L = R.bigLouse;
    L.root.position.set(x, 0.02 + 0.015 * Math.abs(Math.sin(t * 9)), 0); L.root.rotation.set(0, PI / 2, 0);
    const g = (i, s) => [0, 0.35 * Math.sin(t * 9 + i * 2.1 + (s > 0 ? 0 : PI)), 0.15 * s * Math.cos(t * 9 + i * 2.1)];
    L.pose({ lids: blink(t, 4), look: [0.3, 0.1], nodes: { leg0l: g(0, 1), leg0r: g(0, -1), leg1l: g(1, 1), leg1r: g(1, -1), leg2l: g(2, 1), leg2r: g(2, -1) } });
    return x;
  };
  add('n13', 'cave', { update: crawl,
    camera(cam, lt, c) { const x = 40 + crawl(c); aim(cam, V(x + 0.6, 0.3, 0.6), V(x - 0.05, 0.13, 0), { fov: 38, t: c.t }); },
    dof: { focus: 0.85, aperture: 0.03 }, grade: { warmth: 0.08 } });
  add('n13@and', 'studio', { station: 'lice',
    update(c) {
      const R = c.S.R, t = c.t;
      const kT = ease.out(ramp(t, at('n13@and') - 0.05, at('n13@and') + 0.55)), kB = ease.inOut(ramp(t, at('n13@split'), at('n13@split') + 0.7));
      const cnt = (m, k) => m.geometry.setDrawRange(0, Math.floor(k * m.geometry.index.count / 6) * 6);
      cnt(R.tubes[0], kT); cnt(R.tubes[1], kB); cnt(R.tubes[2], kB);
      R.node.scale.setScalar(pop(t, at('n13@split') - 0.15));
      const pl = pop(t, at('n13@split') + 0.6);
      [R.lblHead.group, R.lblBody.group, R.lh.root, R.lb.root, R.hair, R.cloth].forEach((o) => o.scale.setScalar(o === R.lh.root || o === R.lb.root ? 1.4 * pl : pl));
      R.lblYears.group.scale.setScalar(pop(t, at('n13@right') - 0.1));
      R.lh.pose({ lids: blink(t, 2), look: [-0.4, 0] }); R.lb.pose({ lids: blink(t, 6), look: [-0.4, 0] });
    },
    camera: move(V(0.0, 1.45, 4.7), V(0.0, 1.6, 4.1), V(0, 1.4, 0), V(0, 1.55, 0), { fov: 40 }),
    dof: focusAt(V(0, 1.5, 0), 0.004) });
  add('n13@right', 'studio', { station: 'lice',
    update(c) {
      const R = c.S.R, t = c.t;
      R.tubes.forEach((m) => m.geometry.setDrawRange(0, Infinity));
      [R.lblHead.group, R.lblBody.group, R.hair, R.cloth].forEach((o) => o.scale.setScalar(1)); R.lh.root.scale.setScalar(1.4); R.lb.root.scale.setScalar(1.4);
      R.node.scale.setScalar(1 + 0.15 * Math.sin(t * 8)); R.lblYears.group.scale.setScalar(pop(t, at('n13@right') - 0.1));
    },
    camera: move(V(0.12, 1.42, 2.5), V(0.06, 1.38, 2.05), V(0.02, 1.25, 0), V(0, 1.24, 0), { fov: 36 }),
    dof: focusAt(V(0, 1.25, 0), 0.01) });
  // ancient Greece
  add('n14', 'stadium', {
    update(c) { c.S.R.runners.forEach((r, i) => { r.root.position.set(-30 + i * 0.3, 0, r.lane); r.pose({ nodes: REST }); }); },
    camera: move(V(10.5, 3.2, 2.6), V(12.6, 2.5, 0.8), V(14.2, 1.6, -5.4), V(14.6, 1.7, -5.6), { fov: 40 }),
    dof: { focus: 14, aperture: 0.002 } });
  const raceX = (r, t) => -12 + (t - at('n14@in')) * 4.2 + (r.seed === 1 ? 0.6 : r.seed === 2 ? -0.5 : 0);
  add('n14@in', 'stadium', {
    update(c) { c.S.R.runners.forEach((r) => runner(r, raceX(r, c.t), c.t)); c.S.R.loin.visible = false; },
    camera(cam, lt, c) { const x = raceX(c.S.R.runners[1], c.t); aim(cam, V(x + 2.5, 1.76, 0.85), V(x + 0.05, 1.66, 0.0), { fov: 26, t: c.t }); },
    censor: (c) => c.S.R.runners.map((r) => ({ pos: world(r, 'body', [0, 0.88, 0.02]), r: 0.19 })),
    dof: { focus: 2.1, aperture: 0.01 } });
  add('n14@completely', 'stadium', {
    update(c) { c.S.R.runners.forEach((r) => runner(r, raceX(r, c.t), c.t)); c.S.R.loin.visible = false; },
    camera(cam, lt, c) { const x = raceX(c.S.R.runners[1], c.t); aim(cam, V(x + 1.5, 2.3, 7.6), V(x - 0.2, 1.0, 0), { fov: 38, t: c.t }); },
    censor: (c) => c.S.R.runners.map((r) => ({ pos: world(r, 'body', [0, 0.88, 0.02]), r: 0.19, ry: 1.0 })),
    dof: { focus: 7.7, aperture: 0.002 } });
  const words = (c, swap) => {
    const R = c.S.R, t = c.t;
    R.word1.group.visible = true; R.word1.group.position.set(0, 0.4, 0);
    const s1 = pop(t, at('n15@gymnasium') - 0.1) * (1 - ease.in(ramp(t, swap, swap + 0.3)));
    R.word1.group.scale.setScalar(Math.max(0.0001, s1));
    R.word2.group.visible = R.word3.group.visible = t > swap;
    R.word2.group.position.set(0, 0.8, 0); R.word2.group.scale.setScalar(pop(t, swap + 0.1));
    R.word3.group.position.set(0, 0.35, 0.1); R.word3.group.scale.setScalar(pop(t, at('n15@naked') - 0.1));
    R.runners.forEach((r) => { r.root.position.set(40, 0, r.lane); });
  };
  add('n15', 'stadium', { update: (c) => words(c, at('n15@greek')),
    camera: move(V(-0.35, 1.25, 6.1), V(0.0, 1.18, 5.7), V(0, 0.6, 0), V(0, 0.62, 0), { fov: 40 }),
    dof: { focus: 5.7, aperture: 0.002 } });
  add('n15@greek', 'stadium', { update: (c) => words(c, at('n15@greek')),
    camera: move(V(0.0, 1.2, 5.7), V(0.0, 1.16, 5.35), V(0, 0.65, 0), V(0, 0.62, 0), { fov: 40 }),
    dof: { focus: 5.4, aperture: 0.002 } });
  // the legend of the runner whose loincloth fell off
  const legendX = (t) => -14 + (t - at('n16')) * 4.0;
  const soloRun = (c) => { const R = c.S.R; R.runners.forEach((r, i) => { if (i !== 1) r.root.position.set(60, 0, r.lane); }); runner(R.runners[1], legendX(c.t), c.t); };
  add('n16', 'stadium', { grade: legend,
    update: soloRun,
    camera(cam, lt, c) { const x = legendX(c.t); aim(cam, V(x + 2.3, 1.3, 2.0), V(x + 0.1, 1.15, 0), { fov: 34, t: c.t }); },
    dof: { focus: 3.0, aperture: 0.008 } });
  const offAt = () => at('n16@loincloth') + 0.15;
  const clothPos = (c) => {
    const dt = Math.max(0, c.t - offAt()), x0 = legendX(offAt());
    return V(x0 - 1.2 * dt - 0.4 * dt * dt, 0.95 + 1.6 * dt - 0.15 * dt * dt + 0.1 * Math.sin(dt * 6), 0.2 * dt + 0.15 * Math.sin(dt * 3));
  };
  add('n16@loincloth', 'stadium', { grade: legend,
    update(c) {
      const R = c.S.R; soloRun(c);
      const off = c.t > offAt();
      R.loin.visible = !off; R.fly.visible = off;
      if (off) {
        const dt = c.t - offAt(), p = R.flyGeo.attributes.position, b = R.flyBase;
        for (let i = 0; i < p.count; i++) { const x = b[i * 3], y = b[i * 3 + 1]; p.setZ(i, 0.06 * Math.sin(x * 14 + c.t * 18) + 0.04 * Math.sin(y * 20 + c.t * 13)); }
        p.needsUpdate = true; R.flyGeo.computeVertexNormals();
        R.fly.position.copy(clothPos(c)); R.fly.rotation.set(dt * 2.2, dt * 3.1, Math.sin(dt * 2) * 0.8);
      }
    },
    censor: (c) => (c.t > offAt() ? [{ pos: world(c.S.R.runners[1], 'body', [0, 0.88, 0.02]), r: 0.2 }] : []),
    camera(cam, lt, c) {
      const xr = legendX(c.t), k = ease.inOut(ramp(c.t, offAt(), offAt() + 0.8));
      const tgt = mixV(V(xr + 0.1, 1.15, 0), clothPos(c), k);
      aim(cam, V(lerp(xr + 2.3, legendX(offAt()) + 0.4, k), lerp(1.3, 1.6, k), lerp(2.0, 3.2, k)), tgt, { fov: 34, t: c.t });
    },
    dof: { focus: 3.2, aperture: 0.006 } });
  add('n16@and', 'stadium', { grade: legend,
    update(c) {
      const R = c.S.R, t = c.t, r = R.runners[1];
      R.runners.forEach((q, i) => { if (i !== 1) q.root.position.set(60, 0, q.lane); });
      R.loin.visible = false;
      const x = 17.6 + (t - at('n16@and')) * 4.0;
      const win = t > at('n16@won');
      runner(r, Math.min(x, 21.2), t, win ? { jaw: 0.6, head: [-0.2, 0, 0], nodes: { arm_l: [-2.9, 0, 0.3], arm_r: [-2.9, 0, -0.3], fore_l: [-0.3, 0, 0], fore_r: [-0.3, 0, 0] } } : {});
      wear(r, 'hat', win); const hs = pop(t, at('n16@won')); if (r.nodes.hat) r.nodes.hat.scale.setScalar(Math.max(0.001, hs));
      const br = ease.out(ramp(t, at('n16@won') - 0.12, at('n16@won') + 0.4));
      R.ribbonL.rotation.y = -1.2 * br; R.ribbonR.rotation.y = 1.2 * br;
      R.ribbonL.position.set(20 - 1.2 * br, 1.25 - 0.3 * br, -1.8 * (1 - br * 0.5)); R.ribbonR.position.set(20 - 1.2 * br, 1.25 - 0.3 * br, 1.8 * (1 - br * 0.5));
    },
    censor: (c) => [{ pos: world(c.S.R.runners[1], 'body', [0, 0.88, 0.02]), r: 0.2 }],
    camera(cam, lt, c) { const r = c.S.R.runners[1], h = head(r); aim(cam, V(h.x + 2.3, 1.75, 1.15), V(h.x + 0.1, 1.62, 0), { fov: 30, t: c.t }); },
    dof: { focus: 2.6, aperture: 0.008 } });

  // ------------------------------------------------------------------ THE COMMUTE: towels and sunscreen
  add('n17', 'street', {
    update(c) {
      const R = c.S.R, t = c.t, arrive = ease.out(ramp(t, at('n17') - 0.6, at('n17') + 0.8));
      R.bus.position.x = lerp(-36, -16, arrive);
      const open = ease.inOut(ramp(t, at('n17') + 0.85, at('n17') + 1.2));
      R.bus.userData.doors.forEach((d, i) => { d.position.x = d.userData.x0 + (i ? 1 : -1) * 0.55 * open; });
      wear(R.sam, 'pack', true);
      walkTo(R.sam, V(-18.6, 0.15, 6.8), V(-20.0, 0.15, 4.6), t, at('n17') + 0.5, 1.0, { seed: 2 });
      R.crowd.forEach((p) => { p.root.visible = Math.abs(p.root.position.x + 16) > 6; });
    },
    camera(cam, lt, c) { const p = c.S.R.sam.root.position; aim(cam, V(p.x + 0.6, 1.98, p.z + 1.4), V(-19.4, 1.7, 3.0), { fov: 36, t: c.t }); },
    dof: { focus: 4.5, aperture: 0.003 } });
  const towelPull = () => at('n17@towel') - 0.12;
  const samBus = (c) => {
    const R = c.S.R, t = c.t, seat = R.samSeat;
    const sitT = at('n18') + 1.2;
    const disp = R.seats.find((s) => Math.abs(s.x - seat.x) < 0.01 && Math.abs(s.z - (seat.z - 1.05)) < 0.01);
    const pull = ease.inOut(ramp(t, towelPull(), towelPull() + 0.35)), lay = ease.inOut(ramp(t, towelPull() + 0.45, towelPull() + 0.9));
    const sit = ease.inOut(ramp(t, sitT, sitT + 0.6));
    R.sam.root.position.set(lerp(0.1, seat.x, sit), lerp(0, -0.27, sit), lerp(seat.z - 0.38, seat.z + 0.08, sit)); R.sam.root.rotation.y = lerp(PI - 0.35, PI, sit);
    const reach = Math.sin(clamp01(ramp(t, towelPull() - 0.35, towelPull() + 0.9)) * PI);
    R.sam.pose({ lids: blink(t, 2), head: [0.15 + 0.2 * reach, 0.2, 0], body: [0.25 * reach * (1 - sit), 0, 0],
      nodes: { ...REST, leg_l: [-1.5 * sit, 0, 0.05], leg_r: [-1.5 * sit, 0, -0.05], shin_l: [1.48 * sit, 0, 0], shin_r: [1.48 * sit, 0, 0],
        arm_r: [-1.1 * reach, 0, -0.1], fore_r: [-0.4 * reach, 0, 0], arm_l: [-0.5 * sit, 0, 0.1], fore_l: [-0.7 * sit, 0, 0] } });
    const tw = R.samTowel; tw.visible = t > towelPull();
    const h = handR(R.sam, 0.1), rest = V(seat.x, 0.555, seat.z + 0.02);
    tw.position.copy(lay > 0 ? mixV(h, rest, lay) : h); tw.rotation.set(lerp(1.2, 0, lay), 0, 0);
    if (disp) disp.tongue.visible = t < towelPull();
  };
  add('n17@every', 'bus', { update: samBus,
    camera(cam, lt, c) { const h = head(c.S.R.sam); aim(cam, V(-0.18, 1.86, -0.55 + 0.1 * c.u), h.clone().add(V(0, -0.12, 0)), { fov: 30, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.sam), 0.008) });
  add('n18', 'bus', { update: samBus,
    camera: move(V(0.0, 1.6, -2.3), V(0.0, 1.75, -3.0), V(0, 1.7, -5.95), V(0, 1.84, -5.95), { fov: 30 }),
    dof: focusAt(V(0, 1.86, -5.95), 0.006) });
  add('n18@always', 'bus', { update: samBus,
    camera: move(V(-0.5, 1.85, -4.8), V(-0.3, 1.8, -4.3), V(0.2, 0.9, 1.5), V(0.3, 0.95, 1.8), { fov: 40 }),
    dof: { focus: 5, aperture: 0.003 } });
  const lotion = (c) => {
    const R = c.S.R, t = c.t, p = R.sunscreener;
    p.root.visible = true; p.root.position.set(14, 0.15, -5.75); p.root.rotation.y = PI;
    const pump = Math.sin(clamp01(ramp(t, at('n19@sunscreen') - 0.4, at('n19@sunscreen') + 0.3)) * PI);
    const rub = t > at('n19@sunscreen') + 0.35 ? Math.sin(t * 9) : 0;
    p.pose({ lids: blink(t, 3), head: [0.25, 0.3 * (t > at('n19@because') ? 1 : 0), 0], look: [0, -0.3],
      nodes: { ...REST, arm_r: [-1.1 - 0.3 * pump + (rub ? -0.2 : 0), 0, -0.2 + (rub ? 0.6 : 0)], fore_r: [-0.6 + (rub ? -1.2 + 0.2 * rub : 0), 0, 0], arm_l: [rub ? -0.6 : -0.9, 0, rub ? 0.2 : 0.1], fore_l: [rub ? -0.5 : -0.8, 0, 0] } });
  };
  add('n19', 'street', {
    update(c) { lotion(c); c.S.R.sam.root.visible = false; },
    camera: move(V(12.2, 1.65, -3.6), V(12.7, 1.6, -4.2), V(14, 1.65, -6.2), V(14, 1.6, -6.0), { fov: 36 }),
    dof: focusOn((c) => head(c.S.R.sunscreener), 0.008) });
  add('n19@because', 'street', {
    update(c) { lotion(c); c.S.R.sam.root.visible = false; },
    camera(cam, lt, c) { const h = head(c.S.R.sunscreener); aim(cam, h.clone().add(V(-0.55 + 0.1 * c.u, -0.1, -0.85)), h.clone().add(V(0, -0.22, 0)), { fov: 34, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.sunscreener), 0.02) });
  add('n19@shot', 'studio', { station: 'shot',
    update(c) { const R = c.S.R; R.oz.group.scale.setScalar(pop(c.t, at('n19@shot') + 0.15)); R.every.group.scale.setScalar(0.001); R.minH.rotation.z = 0; R.hourH.rotation.z = -PI / 3; },
    camera: move(V(-0.5, 1.5, 3.0), V(-0.6, 1.45, 2.6), V(-0.85, 1.25, 0), V(-0.85, 1.3, 0), { fov: 38 }),
    dof: focusAt(V(-0.85, 1.1, 0.2), 0.008) });
  add('n19@every#2', 'studio', { station: 'shot',
    update(c) {
      const R = c.S.R, k = ease.inOut(ramp(c.t, at('n19@2') - 0.1, at('n19@hours') + 0.5));
      R.oz.group.scale.setScalar(1); R.every.group.scale.setScalar(pop(c.t, at('n19@every#2') - 0.05));
      R.minH.rotation.z = -k * PI * 4; R.hourH.rotation.z = -PI / 3 - k * PI / 3;
    },
    camera: move(V(0.95, 1.55, 3.3), V(1.0, 1.5, 3.0), V(1.1, 1.45, 0), V(1.1, 1.5, 0), { fov: 38 }),
    dof: focusAt(V(1.1, 1.25, 0.1), 0.008) });

  // ------------------------------------------------------------------ WORK: name tags and 82 degrees
  add('n20', 'office', {
    update(c) { c.S.R.boss2.root.visible = false; c.S.R.sam.root.visible = false; },
    camera: move(V(-5.95, 1.45, 4.55), V(-6.1, 1.42, 4.3), V(-7.0, 1.36, 2.64), V(-7.0, 1.35, 2.64), { fov: 44 }),
    dof: focusAt(V(-7, 1.35, 2.65), 0.008) });
  add('n20@name', 'office', {
    update(c) {
      const R = c.S.R, t = c.t, slap = at('n20@name') + 0.1;
      R.boss2.root.visible = false;
      R.sam.root.position.set(-5.6, 0, 2.4); R.sam.root.rotation.y = 0; wear(R.sam, 'pack', true);
      const k = Math.sin(clamp01(ramp(t, slap - 0.35, slap + 0.25)) * PI);
      R.sam.pose({ lids: blink(t, 2), head: [0.3 * (1 - ramp(t, slap + 0.3, slap + 0.6)), 0, 0], look: [0, -0.3], jaw: 0.25 * ramp(t, slap + 0.2, slap + 0.5), nodes: { ...REST, arm_r: [-0.9 * k - 0.2, 0.5 * k, -0.1], fore_r: [-1.6 * k, 0, 0] } });
      R.samTag.visible = t > slap - 0.02; R.samTag.scale.setScalar(t > slap ? lerp(1.4, 1, ease.out(ramp(t, slap, slap + 0.12))) : 1);
    },
    camera: move(V(-5.43, 1.6, 3.6), V(-5.45, 1.58, 3.5), V(-5.6, 1.5, 2.4), V(-5.6, 1.48, 2.4), { fov: 36 }),
    dof: focusOn((c) => chest(c.S.R.sam), 0.015) });
  const shiver = (c, cold) => {
    const R = c.S.R, t = c.t;
    R.workers.forEach((w, i) => {
      const s = Math.sin(t * 40 + i) * 0.03 * cold;
      w.pose({ lids: blink(t, w.seed) * (1 - 0.2 * cold), head: [0.1 * cold, s, s], jaw: 0.15 * cold * Math.abs(Math.sin(t * 30)), nodes: { ...REST, ...SIT, arm_l: [-1.0 * cold - 0.6 * (1 - cold), 0.6 * cold, 0.12], arm_r: [-1.0 * cold - 0.6 * (1 - cold), -0.6 * cold, -0.12], fore_l: [-1.6 * cold - 0.7 * (1 - cold), 0, 0], fore_r: [-1.6 * cold - 0.7 * (1 - cold), 0, 0] } });
    });
  };
  add('n21', 'office', {
    update(c) { shiver(c, 1); c.S.R.boss2.root.visible = false; c.S.R.sam.root.visible = false; },
    camera: move(V(1.9, 1.95, 4.1), V(1.55, 1.85, 3.7), V(-0.2, 1.2, -1.4), V(-0.1, 1.22, -1.4), { fov: 40 }),
    dof: { focus: 4.6, aperture: 0.003 } });
  add('n21@finally', 'office', {
    update(c) {
      const R = c.S.R; shiver(c, 1); R.boss2.root.visible = false; R.sam.root.visible = false;
      const k = ramp(c.t, at('n21@finally'), at('n21@82')); R.setTemp(Math.round(lerp(68, 82, k)));
    },
    camera: move(V(3.68, 1.5, -0.25), V(3.62, 1.49, -0.38), V(3.4, 1.48, -0.89), V(3.4, 1.48, -0.89), { fov: 30 }),
    dof: focusAt(V(3.4, 1.48, -0.87), 0.02) });
  const relaxed = (c, cheer) => {
    const R = c.S.R, t = c.t;
    R.workers.forEach((w, i) => {
      const up = cheer * (1 + 0.1 * Math.sin(t * 9 + i));
      w.pose({ lids: blink(t, w.seed) * (cheer ? 1 : 0.7), head: [-0.15, 0.1 * Math.sin(t + i), 0], jaw: 0.35 * cheer, nodes: { ...REST, ...SIT, arm_l: [-2.6 * up - 2.2 * (1 - cheer), 0, 0.3 + 0.4 * (1 - cheer)], arm_r: [-2.6 * up - 2.2 * (1 - cheer), 0, -0.3 - 0.4 * (1 - cheer)], fore_l: [-0.3 * cheer - 1.9 * (1 - cheer), 0, 0], fore_r: [-0.3 * cheer - 1.9 * (1 - cheer), 0, 0] } });
    });
  };
  add('n21@most', 'office', {
    update(c) { relaxed(c, 0); const R = c.S.R; R.boss2.root.visible = false; R.sam.root.visible = false; R.setTemp(Math.round(lerp(68, 82, ramp(c.t, at('n21@finally'), at('n21@82'))))); },
    camera: move(V(1.2, 1.8, 3.7), V(0.9, 1.72, 3.3), V(-0.15, 1.25, -1.2), V(-0.2, 1.25, -1.2), { fov: 40 }),
    dof: { focus: 4.4, aperture: 0.003 } });
  add('n21@82', 'office', {
    update(c) {
      const R = c.S.R; relaxed(c, 1); R.boss2.root.visible = false; R.sam.root.visible = false; R.setTemp(82);
      R.big82.group.visible = true; R.big82.group.scale.setScalar(pop(c.t, at('n21@82') - 0.05));
    },
    post(c) { c.S.R.big82.group.lookAt(c.camera.position); },
    camera: move(V(1.4, 1.9, 4.6), V(1.6, 2.0, 5.0), V(-0.1, 1.55, -1.3), V(-0.1, 1.65, -1.3), { fov: 42 }),
    dof: { focus: 5.5, aperture: 0.002 } });
  add('n22', 'office', {
    update(c) {
      const R = c.S.R, t = c.t; R.boss2.root.visible = false; R.sam.root.visible = false; R.setTemp(82); relaxed(c, 0);
      R.workers[2].pose({ lids: 0.1, head: [-0.3, 0, 0.05], jaw: 0.1, nodes: { ...REST, ...SIT, arm_l: [-2.4, 0, 0.6], arm_r: [-2.4, 0, -0.6], fore_l: [-2.0, 0, 0], fore_r: [-2.0, 0, 0] } });
    },
    camera(cam, lt, c) { const h = head(c.S.R.workers[2]); aim(cam, h.clone().add(V(0.45, 0.05, 1.1 - 0.12 * c.u)), h.clone().add(V(0, -0.1, 0)), { fov: 32, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.workers[2]), 0.02) });
  add('n22@and', 'office', {
    update(c) {
      const R = c.S.R, t = c.t; R.sam.root.visible = false; R.setTemp(82);
      R.setBill(clamp01(ramp(t, at('n22@and') - 0.1, at('n23') - 0.2)) * 3.6);
      R.boss2.root.visible = true;
      const shock = ease.out(ramp(t, at('n22@terrible'), at('n22@terrible') + 0.3));
      R.boss2.pose({ lids: 1, dilate: 1 + 0.5 * shock, jaw: 0.7 * shock, jawMax: 0.5, head: [0.35 - 0.3 * shock, 0, 0], look: [0, -0.4 + 0.4 * shock],
        nodes: { ...REST, arm_l: [-1.0 - 1.2 * shock, 0, 0.3], arm_r: [-1.0 - 1.2 * shock, 0, -0.3], fore_l: [-1.3, 0, 0], fore_r: [-1.3, 0, 0], brow_l: [0, 0, 0.2 * shock], brow_r: [0, 0, -0.2 * shock] } });
    },
    camera: move(V(5.15, 1.45, 3.2), V(5.0, 1.52, 2.8), V(4.6, 1.15, 0.4), V(4.6, 1.42, 0.1), { fov: 36 }),
    dof: focusOn((c) => head(c.S.R.boss2), 0.006) });

  // ------------------------------------------------------------------ THE ECONOMY AND THE PLANET
  add('n23', 'factory', {
    camera: move(V(-9.5, 4.6, 6.5), V(-6.5, 3.6, 5.4), V(-1, 1.0, -4), V(0, 1.0, -4.5), { fov: 40 }),
    dof: { focus: 9, aperture: 0.002 } });
  add('n23@worth', 'factory', {
    update(c) {
      const R = c.S.R; R.money.group.visible = true; R.money.group.scale.setScalar(pop(c.t, at('n23@17') - 0.1)); R.money.group.position.set(-1, 3.6, 0.5); R.money.group.rotation.set(0, 0, 0);
      R.coins.visible = true;
    },
    camera: move(V(-1, 3.1, 6.8), V(-1, 3.35, 5.7), V(-1, 3.45, 0.5), V(-1, 3.5, 0.5), { fov: 38 }),
    dof: focusAt(V(-1, 3.5, 0.6), 0.004) });
  add('n23@would', 'factory', { vanish: at('n23@almost'),
    update(c) {
      const R = c.S.R, t = c.t;
      const fall = ease.in(ramp(t, at('n23@disappear'), at('n23@disappear') + 0.7));
      R.money.group.visible = true; R.money.group.scale.setScalar(1); R.money.group.position.set(-1, 3.6 - 3.8 * fall, 0.5 + fall); R.money.group.rotation.set(-1.2 * fall, 0, 0.2 * fall);
      R.coins.visible = fall < 0.3;
    },
    camera: move(V(-4.5, 2.4, 9.0), V(-3.6, 2.2, 8.2), V(-1.5, 1.6, 2.5), V(-1.2, 1.5, 2.8), { fov: 40 }),
    dof: { focus: 6.5, aperture: 0.003 } });
  add('n24', 'studio', { station: 'globe',
    update(c) { const R = c.S.R; R.earth.rotation.y = c.t * 0.25; R.clouds.rotation.y = c.t * 0.3; },
    camera: move(V(1.0, 2.0, 7.6), V(0.3, 1.75, 7.0), V(0, 1.5, 0), V(0, 1.48, 0), { fov: 38 }),
    exposure: 1.1 });
  add('n24@making', 'studio', { station: 'water',
    update(c) {
      const R = c.S.R, t = c.t, k = ease.inOut(ramp(t, at('n24@takes') - 0.1, at('n24@liters') + 0.1));
      const n = Math.round(2700 * k); R.bottles.count = n;
      R.liters.setText(`${commas(n)} LITERS`); R.liters.group.scale.setScalar(pop(t, at('n24@takes') - 0.15));
      R.oneShirt.group.scale.setScalar(pop(t, at('n24@one') - 0.1));
    },
    camera(cam, lt, c) { const k = ease.inOut(ramp(c.t, at('n24@takes') - 0.4, at('n24@liters') + 0.3)); aim(cam, mixV(V(-1.8, 1.2, 1.7), V(0.6, 2.6, 8.6), k), mixV(V(-2.1, 1.0, 0), V(-0.2, 1.95, -0.2), k), { fov: 38, t: c.t }); },
    dof: { focus: (c) => lerp(1.75, 8.5, ease.inOut(ramp(c.t, at('n24@takes') - 0.4, at('n24@liters') + 0.3))), aperture: 0.004 } });
  add('n25', 'kitchen', {
    update(c) {
      const R = c.S.R, t = c.t; R.glass.visible = true;
      const drink = ease.inOut(ramp(t, at('n25') + 0.1, at('n25') + 0.6));
      R.sam.pose({ lids: blink(t, 2) * (1 - 0.6 * drink), head: [-0.35 * drink, 0, 0], nodes: { ...REST, arm_r: [-1.5, 0.35, -0.12], fore_r: [-1.65, 0, 0.45] } });
      R.glass.position.copy(world(R.sam, 'head', [0.0, 0.0, 0.2])).add(V(0, -0.13 + 0.05 * drink, 0)); R.glass.rotation.set(1.0 * drink, 0, 0);
      R.water.scale.set(1, Math.max(0.05, 1 - ramp(t, at('n25') + 0.5, at('n25@25')) * 0.95), 1);
    },
    camera: move(V(0.45, 1.65, 0.95), V(0.35, 1.62, 0.8), V(0, 1.6, -0.55), V(0, 1.6, -0.55), { fov: 32 }),
    dof: focusOn((c) => head(c.S.R.sam), 0.02) });
  add('n25@25', 'studio', { station: 'years',
    update(c) {
      const R = c.S.R, t = c.t;
      R.pages.forEach((pg, i) => { const t0 = at('n25@25') - 0.1 + i * 0.045, k = ease.in(ramp(t, t0, t0 + 0.35)); pg.visible = k < 1; pg.position.set(0.0, -0.1 + 1.6 * k, 0.065 + (30 - i) * 0.0008 + 0.6 * k); pg.rotation.set(-2.0 * k, 0, 0.6 * k * (i % 2 ? 1 : -1)); });
      R.yrs.group.scale.setScalar(pop(t, at('n25@25') - 0.05));
    },
    camera: move(V(0.12, 1.75, 5.2), V(0.02, 1.68, 4.8), V(0, 1.5, 0), V(0, 1.52, 0), { fov: 38 }),
    dof: focusAt(V(0, 1.4, 0), 0.006) });

  // ------------------------------------------------------------------ THE DOWNSIDES: bacon, winter
  const fry = (c, amt = 1) => {
    const R = c.S.R, t = c.t, M = new THREE.Matrix4();
    R.drops.count = 60;
    for (let i = 0; i < 60; i++) {
      const ph = ((t * (0.9 + (i % 7) * 0.13) + i * 0.137) % 1);
      const a = i * 2.39996, sp = 0.6 + (i % 5) * 0.25;
      const p = V(Math.cos(a) * 0.12 * (1 + ph * sp), 0.99 + ph * sp * 0.8 - ph * ph * 0.9, 0.2 + Math.sin(a) * 0.12 * (1 + ph * sp) + ph * 0.25 * amt);
      M.makeScale(1, 1 + ph * 2, 1).setPosition(p); R.drops.setMatrixAt(i, M);
    }
    R.drops.instanceMatrix.needsUpdate = true;
    R.strips.forEach((s, i) => { s.position.y = 0.022 + 0.004 * Math.abs(Math.sin(t * 23 + i)); });
  };
  add('n26', 'kitchen', {
    update(c) { const R = c.S.R; fry(c, 0.5); R.sam.pose({ lids: 1, head: [0.35, 0, 0], look: [0, -0.4], dilate: 1.2, nodes: { ...REST, arm_r: [-0.6, 0, -0.25], fore_r: [-1.0, 0, 0.2], arm_l: [-0.3, 0, 0.1] } }); },
    camera: move(V(-0.75, 1.55, 1.55), V(-0.5, 1.5, 1.3), V(0, 1.3, -0.3), V(0, 1.3, -0.35), { fov: 36 }),
    dof: focusOn((c) => head(c.S.R.sam), 0.008) });
  add('n26@cooking', 'kitchen', {
    update(c) { fry(c, 1); },
    camera: move(V(0.42, 1.18, 0.78), V(0.36, 1.14, 0.7), V(0, 0.98, 0.2), V(0, 0.98, 0.2), { fov: 32 }),
    dof: focusAt(V(0, 0.99, 0.2), 0.03), bloom: { strength: 0.5, threshold: 0.8 } });
  add('n26@extreme', 'kitchen', {
    update(c) {
      const R = c.S.R, t = c.t, k = ease.out(ramp(t, at('n26@extreme') - 0.05, at('n26@extreme') + 0.25)); fry(c, 2);
      R.sam.root.position.set(0, 0, -0.55 - 0.15 * k);
      R.sam.pose({ lids: 1 - 0.7 * k, jaw: 0.8 * k, jawMax: 0.5, head: [-0.2 * k, 0.3 * k, 0], body: [-0.12 * k, 0, 0], dilate: 1.4, nodes: { ...REST, arm_l: [-2.0 * k, 0.4, 0.4], arm_r: [-2.0 * k, -0.4, -0.4], fore_l: [-1.5 * k, 0, 0], fore_r: [-1.5 * k, 0, 0] } });
    },
    camera(cam, lt, c) { const sh = Math.exp(-lt * 5) * 0.015; aim(cam, V(0.25 + Math.sin(lt * 70) * sh, 1.5 + Math.cos(lt * 63) * sh, 1.05), V(0, 1.45, -0.55), { fov: 34, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.sam), 0.01) });
  add('n27', 'kitchen', {
    update(c) {
      const R = c.S.R, t = c.t; fry(c, 1);
      const on = t > at('n27@aprons') - 0.08; wear(R.sam, 'apron', on); wear(R.sam, 'pack', !on);
      R.sam.root.position.set(0, 0, -0.55);
      const proud = ease.out(ramp(t, at('n27@aprons') - 0.05, at('n27@aprons') + 0.4));
      R.sam.pose({ lids: blink(t, 2), head: [-0.15 * proud, 0, 0], jaw: 0.15 * proud, body: [-0.05 * proud, 0, 0], nodes: { ...REST, arm_l: [0, 0, 0.3 + 0.3 * proud], arm_r: [0, 0, -0.3 - 0.3 * proud], fore_l: [-1.6 * proud, 0, 0.6 * proud], fore_r: [-1.6 * proud, 0, -0.6 * proud] } });
    },
    camera: move(V(0.6, 0.95, 0.95), V(0.4, 1.0, 0.75), V(0, 1.55, -0.55), V(0, 1.5, -0.55), { fov: 38 }),
    dof: focusOn((c) => chest(c.S.R.sam), 0.008), bloom: { strength: 0.45 } });
  add('n27@one', 'kitchen', {
    update(c) {
      const R = c.S.R, t = c.t; fry(c, 1.5); wear(R.sam, 'apron', true); wear(R.sam, 'pack', false);
      R.sam.root.position.set(0, 0, -0.55);
      const flip = Math.max(0, Math.sin(t * 5));
      R.sam.pose({ lids: blink(t, 2), head: [0.3, 0, 0], jaw: 0.2, nodes: { ...REST, arm_r: [-0.9 - 0.3 * flip, 0, -0.2], fore_r: [-0.9, 0, 0.2], arm_l: [-0.2, 0, 0.5], fore_l: [-1.4, 0, 0.5] } });
    },
    camera(cam, lt, c) { const a = lerp(-0.6, 0.5, ease.inOut(c.u)); aim(cam, V(Math.sin(a) * 1.5, 1.42, -0.4 + Math.cos(a) * 1.5), V(0, 1.25, -0.4), { fov: 38, t: c.t }); },
    dof: focusOn((c) => chest(c.S.R.sam), 0.008) });
  // winter: coats work like umbrellas
  add('n28', 'snow', {
    update(c) { const R = c.S.R; walkTo(R.coatB, V(-5.5, 0, -3.2), V(4, 0, -3.2), c.t, at('n28') - 2.5, 0.9, { seed: 5, head: [0.1, 0, 0] }); R.coatA.root.position.set(-30, 0, 0); },
    camera(cam, lt, c) { const p = c.S.R.coatB.root.position; aim(cam, V(p.x + 1.3, 1.85, p.z + 3.3), V(p.x + 0.1, 1.5, p.z), { fov: 36, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.coatB), 0.004) });
  const toCafe = (c) => walkTo(c.S.R.coatA, V(-4.5, 0, -4.6), V(0.95, 0, -4.6), c.t, at('n28@coats') - 1.6, 1.1, { seed: 6, head: [0.05, 0, 0], lids: 0.8 });
  add('n28@coats', 'snow', {
    update(c) { toCafe(c); c.S.R.coatB.root.position.set(-30, 0, 0); },
    camera(cam, lt, c) { const p = c.S.R.coatA.root.position; aim(cam, V(p.x + 1.6, 1.62, p.z + 1.9), V(p.x, 1.45, p.z), { fov: 36, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.coatA), 0.008) });
  add("n28@you'd", 'snow', {
    update(c) {
      const R = c.S.R, t = c.t; R.coatB.root.position.set(-30, 0, 0);
      const open = ease.inOut(ramp(t, at("n28@you'd") + 0.2, at("n28@you'd") + 0.7)); R.door.rotation.y = 1.3 * open;
      walkTo(R.coatA, V(0.95, 0, -4.6), V(0.95, 0, -6.6), t, at("n28@you'd") + 0.55, 1.0, { seed: 6, lids: 0.8 });
      if (t < at("n28@you'd") + 0.55) { R.coatA.root.rotation.y = PI; R.coatA.pose({ lids: 0.8, head: [0.05, 0, 0], nodes: { ...REST, arm_l: [-0.3 + 0.05 * Math.sin(t * 30), 0, 0.15], arm_r: [-0.3, 0, -0.15] } }); }
    },
    camera: move(V(2.6, 1.6, -2.4), V(2.3, 1.55, -2.7), V(0.95, 1.45, -5.0), V(0.95, 1.45, -5.6), { fov: 38 }),
    dof: focusOn((c) => head(c.S.R.coatA), 0.006) });
  const dropAt = () => at('n28@drop') + 0.05;
  add('n28@drop', 'snow', {
    update(c) {
      const R = c.S.R, t = c.t; R.coatB.root.position.set(-30, 0, 0); R.door.rotation.y = 1.3;
      R.coatA.root.position.set(0.95, 0, -6.75); R.coatA.root.rotation.y = PI;
      const off = t > dropAt();
      wear(R.coatA, 'coat', !off); wear(R.coatA, 'cs', !off); wear(R.coatA, 'scarf', !off); wear(R.coatA, 'pack', off);
      const k = ease.out(ramp(t, dropAt(), dropAt() + 0.55));
      R.flyCoat.visible = off && k < 1;
      const hook = V(-0.35, 1.85, -6.95);
      R.flyCoat.position.copy(mixV(world(R.coatA, 'body', [0, 1.45, 0]), hook, k)).add(V(0, Math.sin(k * PI) * 0.4, 0)); R.flyCoat.rotation.set(0, PI * k, 0.3 * Math.sin(k * PI));
      const relief = ease.out(ramp(t, dropAt() + 0.2, dropAt() + 0.7));
      R.coatA.pose({ lids: lerp(0.8, 0.35, relief), jaw: 0.25 * relief, head: [-0.25 * relief, 0, 0], nodes: { ...REST, arm_l: [0, 0, 0.12 + 0.5 * relief], arm_r: [0, 0, -0.12 - 0.5 * relief] } });
    },
    camera: move(V(1.22, 1.76, -7.98), V(1.2, 1.74, -7.88), V(0.95, 1.6, -6.75), V(0.95, 1.6, -6.75), { fov: 32 }),
    dof: focusOn((c) => head(c.S.R.coatA), 0.008), exposure: 1.05 });

  // ------------------------------------------------------------------ EVENING: dressing up, the costume party
  const samDoor = (c, extra = {}) => { const R = c.S.R; R.sam.root.position.set(12.05, 0, 0.75); R.sam.root.rotation.y = PI; wear(R.sam, 'pack', true); R.sam.pose({ lids: blink(c.t, 2), ...extra, nodes: { ...REST, ...(extra.nodes || {}) } }); };
  add('n29', 'dining', {
    update(c) { const t = c.t, ring = Math.sin(clamp01(ramp(t, at('n29@dinner') - 0.5, at('n29@dinner') + 0.2)) * PI); samDoor(c, { head: [0.05, -0.3 * ring, 0], nodes: { arm_r: [-1.4 * ring, 0.6 * ring, -0.3], fore_r: [-0.3 * ring, 0, 0] } }); },
    camera: move(V(13.25, 1.72, 0.05), V(13.18, 1.7, 0.08), V(12.05, 1.6, 0.75), V(12.05, 1.6, 0.75), { fov: 38 }),
    dof: focusOn((c) => head(c.S.R.sam), 0.01) });
  add("n29@you'd", 'dining', {
    update(c) { const sm = Math.sin(clamp01(ramp(c.t, at("n29@you'd"), at('n29@a#2'))) * PI); samDoor(c, { head: [-0.1, 0.1, 0], jaw: 0.1, nodes: { arm_l: [-2.7 * sm, 0, 0.5], fore_l: [-1.6 * sm, 0, 0] } }); },
    camera: move(V(11.0, 1.72, 0.12), V(11.06, 1.7, 0.15), V(12.05, 1.6, 0.75), V(12.05, 1.6, 0.75), { fov: 38 }),
    dof: focusOn((c) => head(c.S.R.sam), 0.02) });
  const watchUp = (c) => { const k = ease.inOut(ramp(c.t, at('n29@a#2') - 0.05, at('n29@a#2') + 0.4)); samDoor(c, { head: [0.35 * k, 0.4 * k, 0], look: [0.4, -0.4], jaw: 0.2 * k, nodes: { arm_l: [-1.0 * k, -0.5 * k, 0.2], fore_l: [-1.3 * k, -0.6 * k, 0] } }); };
  add('n29@a#2', 'dining', {
    update: watchUp,
    camera(cam, lt, c) { const w = world(c.S.R.sam, 'watch', [0.06, 0, 0]); aim(cam, w.clone().add(V(0.12, 0.12, -0.28)), w, { fov: 30, t: c.t, amp: 0.4 }); },
    dof: focusOn((c) => world(c.S.R.sam, 'watch', [0.06, 0, 0]), 0.04), bloom: { strength: 0.8, threshold: 0.7 } });
  const dinner = (c, stare) => {
    const R = c.S.R, t = c.t, door = V(1.4, 1.7, -3.3);
    R.guests.forEach((g, i) => {
      const hp = g.root.position.clone().add(V(0, 1.5, 0)), d = door.clone().sub(hp);
      const yaw = Math.atan2(d.x, d.z) - g.root.rotation.y;
      const k = ease.out(ramp(t, stare + i * 0.05, stare + 0.25 + i * 0.05));
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      g.pose({ lids: k ? 1 : blink(t, g.seed), dilate: 1 + 0.4 * k, jaw: 0.25 * k + (1 - k) * 0.2 * Math.max(0, Math.sin(t * 6 + i * 2)), head: [0.0, wrap(yaw) * k * 0.9, 0], look: [wrap(yaw) * k * 0.4, 0], nodes: { ...REST, ...SIT, arm_l: [-0.7, 0, 0.12], arm_r: [-0.7, 0, -0.12], fore_l: [-0.8, 0, 0], fore_r: [-0.8, 0, 0] } });
    });
    R.suit.root.visible = t > at('n30@dressed') - 0.1;
    R.suit.root.position.set(1.4, 0, -3.25); R.suit.root.rotation.y = 0.15;
    R.suit.pose({ lids: blink(t, 8), dilate: 1.2, nodes: { ...REST, arm_r: [-0.4, 0, -0.1], fore_r: [-1.2, 0, 0] } });
  };
  add('n30', 'dining', {
    update(c) { dinner(c, at('n30@dressed') + 0.15); },
    camera: move(V(-0.3, 1.75, 2.9), V(-0.2, 1.65, 2.4), V(0.5, 1.2, -2.4), V(0.6, 1.25, -2.6), { fov: 38 }),
    dof: { focus: 4.2, aperture: 0.003 } });
  add('n30@would', 'dining', {
    update(c) { dinner(c, at('n30@dressed') + 0.15); c.S.R.suit.root.visible = false; },
    camera: move(V(1.4, 1.72, -3.05), V(1.3, 1.66, -2.6), V(0.0, 1.25, -0.6), V(0.0, 1.25, -0.4), { fov: 40 }),
    dof: { focus: 2.8, aperture: 0.004 } });
  add('n30@like', 'dining', {
    update(c) { dinner(c, at('n30@dressed') + 0.15); },
    post(c) {
      const R = c.S.R, g = R.guests[1], h = head(g);
      R.bubble.update(c.camera, { from: h, at: h.clone().add(V(0.25, 0.55, 0.25)), open: ease.out(ramp(c.t, at('n30@like') + 0.1, at('n30@like') + 0.55)), lt: c.lt });
    },
    camera(cam, lt, c) { const h = head(c.S.R.guests[1]); aim(cam, h.clone().add(V(1.55, 0.3, 1.1)), h.clone().add(V(0.15, 0.36, 0.15)), { fov: 40, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.guests[1]), 0.004) });
  add('suit+-0.1', 'dining', {
    update(c) {
      dinner(c, at('n30@dressed') + 0.15);
      const R = c.S.R, m = talk('suit', c.t, 1.15);
      R.suit.pose({ lids: blink(c.t, 8), dilate: 1.3, jaw: m, jawMax: 0.4, head: [0.05, -0.15 + 0.1 * Math.sin(c.t * 3), 0.08], look: [-0.3, 0], nodes: { ...REST, arm_r: [-1.3, 0, -0.2], fore_r: [-1.3, 0, 0], brow_l: [0, 0, 0.2], brow_r: [0, 0, -0.2] } });
    },
    camera(cam, lt, c) { const h = head(c.S.R.suit); aim(cam, h.clone().add(V(-0.35, -0.05, 1.15 - 0.1 * c.u)), h.clone().add(V(0, -0.08, 0)), { fov: 32, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.suit), 0.02) });

  // ------------------------------------------------------------------ NO MORE LAUNDRY
  add('n31', 'laundry', {
    camera: move(V(0.7, 1.35, 1.7), V(0.25, 1.15, 1.25), V(-0.25, 0.6, -0.45), V(-0.3, 0.55, -0.45), { fov: 38 }),
    dof: focusAt(V(-0.4, 0.75, -0.3), 0.008) });
  add('n31@the', 'studio', { station: 'loads',
    update(c) {
      const R = c.S.R, t = c.t, k = ease.inOut(ramp(t, at('n31@washes') - 0.1, at('n31@loads') + 0.2));
      const n = Math.round(R.basketN * k); R.baskets.count = R.laundry.count = n;
      R.loads.setText(`${commas(Math.round(300 * k))} LOADS`); R.loads.group.scale.setScalar(pop(t, at('n31@washes') - 0.15));
      const poof = ramp(t, at('n31@year') + 0.25, at('n31@year') + 0.6);
      const sc = Math.max(0.0001, 1 - poof);
      R.baskets.scale.setScalar(sc); R.laundry.scale.setScalar(sc); R.baskets.position.y = R.laundry.position.y = 0;
      const M = new THREE.Matrix4();
      R.puffs.count = poof > 0 && poof < 1 ? 40 : 0;
      for (let i = 0; i < 40; i++) { const a = i * 2.4, rr = 0.5 + (i % 5) * 0.45; M.makeScale(0.6 + poof * 2.5, 0.6 + poof * 2.5, 0.6 + poof * 2.5).setPosition(Math.cos(a) * rr * (1 + poof), 0.3 + (i % 8) * 0.35 + poof * 0.5, Math.sin(a) * rr * 0.4); R.puffs.setMatrixAt(i, M); }
      R.puffs.instanceMatrix.needsUpdate = true;
      R.puffs.material.opacity = 0.85 * (1 - poof);
    },
    camera: move(V(0.4, 2.1, 6.6), V(0, 2.3, 7.3), V(0, 1.45, 0), V(0, 1.6, 0), { fov: 40 }),
    dof: { focus: 7, aperture: 0.002 } });
  add('n31@now', 'laundry', {
    camera: move(V(-0.35, 0.44, 0.95), V(-0.38, 0.42, 0.8), V(-0.4, 0.4, 0.33), V(-0.4, 0.4, 0.33), { fov: 34 }),
    dof: focusAt(V(-0.4, 0.4, 0.1), 0.02) });

  // ------------------------------------------------------------------ BEDTIME, and the twist
  add('n32', 'bedroomNight', {
    update(c) {
      const R = c.S.R, t = c.t;
      const k = walkTo(R.sam, V(2.2, 0, 0.7), V(-0.05, 0, -0.25), t, at('n32') - 0.6, 1.1, { seed: 2, jaw: 0.6 * Math.max(0, Math.sin((t - at('n32')) * 2.2)), lids: 0.55 });
      R.zero.group.visible = false; R.dog.pose({ lids: blink(t, 3), head: [0.1, -0.4, 0], tail: Math.sin(t * 5) * 0.3, ears: [0.05, 0.05] });
    },
    camera(cam, lt, c) { const h = head(c.S.R.sam); aim(cam, V(0.15, 1.78, -1.35), h.clone().add(V(0, -0.08, 0)), { fov: 24, t: c.t }); },
    dof: focusOn((c) => head(c.S.R.sam), 0.006) });
  const flopAt = () => at('n32@0') - 0.42;
  add('n32@exactly', 'bedroomNight', {
    update(c) {
      const R = c.S.R, t = c.t, k = ease.in(ramp(t, flopAt() - 0.35, flopAt()));
      const s = R.sam;
      s.root.position.set(-0.05, lerp(0, 0.78, k), lerp(-0.25, -0.3, k)); s.root.rotation.set(lerp(0, -(PI / 2 - 0.06), k), PI, 0);
      const settle = t > flopAt() ? Math.exp(-(t - flopAt()) * 7) * Math.sin((t - flopAt()) * 30) * 0.03 : 0;
      s.root.position.y += settle;
      s.pose({ lids: lerp(0.5, 0.0, ramp(t, flopAt(), flopAt() + 0.4)), head: [0, 0.6 * k, 0], nodes: { ...REST, arm_l: [-2.6 * k, 0, 0.3], arm_r: [-2.6 * k, 0, -0.3] } });
      R.zero.group.visible = t > at('n32@0') - 0.05; R.zero.group.scale.setScalar(pop(t, at('n32@0') - 0.05));
      const kb = ease.out(ramp(t, flopAt() + 0.05, flopAt() + 0.3)); R.blanket.visible = t > flopAt() + 0.05;
      R.blanket.position.set(-0.05, lerp(1.75, 0.95, kb), -1.08); R.blanket.scale.set(1, lerp(1, 1, kb), 1);
      R.dog.pose({ lids: blink(t, 3), head: [0.1, -0.5, 0], tail: Math.sin(t * 5) * 0.3 });
    },
    post(c) { c.S.R.zero.group.lookAt(c.camera.position); },
    camera: move(V(0.28, 1.8, -2.42), V(0.24, 1.77, -2.4), V(-0.05, 0.92, -0.75), V(-0.05, 0.9, -0.8), { fov: 44 }),
    dof: { focus: 2.2, aperture: 0.004 } });
  const asleep = (c) => {
    const R = c.S.R, s = R.sam;
    s.root.position.set(-0.05, 0.78, -0.3); s.root.rotation.set(-(PI / 2 - 0.06), PI, 0);
    s.pose({ lids: 0, head: [0, 0.6, 0], jaw: 0.1 + 0.05 * Math.sin(c.t * 2), nodes: { ...REST, arm_l: [-2.6, 0, 0.3], arm_r: [-2.6, 0, -0.3] } });
    R.zero.group.visible = false; R.blanket.visible = true; R.blanket.position.set(-0.05, 0.95, -1.08);
  };
  add('n33', 'bedroomNight', {
    update(c) { asleep(c); c.S.R.dog.pose({ lids: blink(c.t, 3), head: [0.05, -0.2, 0], tail: Math.sin(c.t * 4) * 0.2 }); },
    camera: move(V(0.95, 1.32, -1.65), V(0.62, 0.92, 1.55), V(-0.05, 0.92, -2.0), V(0.25, 0.62, 0.35), { fov: 40 }),
    dof: { focus: (c) => lerp(1.4, 0.9, c.u), aperture: 0.006 } });
  add('n33@would', 'bedroomNight', {
    update(c) {
      asleep(c);
      const t = c.t, tilt = ease.out(ramp(t, at('n33@dog') - 0.1, at('n33@dog') + 0.35));
      c.S.R.dog.pose({ lids: blink(t, 3, 2.2), head: [0.05, -0.1, 0.4 * tilt], ears: [0.15 + 0.2 * tilt, 0.1], look: [0, 0.05], dilate: 1.1 + 0.2 * tilt, tail: Math.sin(t * 7) * 0.4 });
    },
    camera(cam, lt, c) { const h = world(c.S.R.dog, 'head', [0, 0.12, 0.12]); const k = ease.out(c.u); aim(cam, h.clone().add(V(0.15, 0.02, lerp(1.3, 0.85, k))), h.clone().add(V(0, -0.03, 0)), { fov: 34, t: c.t }); },
    dof: focusOn((c) => world(c.S.R.dog, 'head', [0, 0.12, 0.12]), 0.03) });
  return S;
}

// =========================================================================================================
const episode = {
  fps: 24,
  duration: 180,
  scenes: buildScenes(),
  shots: [],
  async setup() {
    const TL = await fetch(new URL('./build/timeline.json', import.meta.url)).then((r) => r.json());
    TLref.TL = TL;
    episode.fps = TL.fps; episode.duration = TL.duration;
    await Promise.all([loadCast(['sam', 'boss', 'cop', 'chef', 'tux', 'diva', 'painter', 'runner1', 'runner2', 'runner3', 'caveman', 'cavewoman',
      'suit', 'guest_a', 'guest_b', 'guest_c', 'guest_d', 'leopard', 'stripes', 'coat_a', 'coat_b', 'greek_a', 'greek_b', 'dog_sweater', 'louse', 'headlouse']), loadFont()]);
    const S = shotList();
    episode.shots = S.map((s, i) => ({ ...s, t0: i === 0 ? 0 : at(s.start), t1: i + 1 < S.length ? at(S[i + 1].start) : TL.duration + 1 }));
    for (let i = 1; i < episode.shots.length; i++) if (episode.shots[i].t0 <= episode.shots[i - 1].t0) console.error('shot order problem at', i, episode.shots[i].start);
  },
};
export default episode;
