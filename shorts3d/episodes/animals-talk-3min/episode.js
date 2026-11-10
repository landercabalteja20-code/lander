// "What if animals could somehow talk?" — 3-minute version: one day in a world of talking animals.
// Format: references/zackdfilms-3d-shorts/STYLE.md. Shots start on words in build/timeline.json (tools/build_audio.py).
import * as THREE from 'three';
import { loadCast, makeCharacter, blink } from '../../kit/character.js';
import { loadFont, ease, ramp, lerp, clamp01, commas } from '../../kit/fx.js';
import { buildScenes, cast, W, TLref, at, talk, world, V, PI } from './sets.js';

const mixV = (a, b, k) => a.clone().lerp(b, k);
const dist = (a, b) => a.distanceTo(b);
function drift(t, amp = 1) {
  return V(Math.sin(t * 1.3) * 0.006 + Math.sin(t * 3.1 + 1) * 0.002, Math.sin(t * 1.7 + 2) * 0.005, Math.sin(t * 1.1 + 4) * 0.004).multiplyScalar(amp);
}
function aim(cam, pos, target, { fov = 35, roll = 0, t = 0, amp = 1 } = {}) {
  cam.fov = fov; cam.position.copy(pos).add(drift(t, amp)); cam.lookAt(target); if (roll) cam.rotateZ(roll);
}
const focusOn = (fn, aperture, maxblur) => ({ focus: (c) => dist(c.camera.position, fn(c)), aperture, ...(maxblur ? { maxblur } : {}) });
const memory = { saturation: 0.28, contrast: 1.04, vignette: 0.6, warmth: 0.07 };   // flashback grade

// =========================================================================================================
function shotList() {
  const S = [];
  const add = (start, scene, o) => S.push({ start, scene, ...o });
  const dog = () => cast.dogD, cat = () => cast.catD;
  const dogHead = () => world(cast.dogD, 'head', [0, 0.13, 0.12]);
  const catHead = (n = 'D') => world(cast['cat' + n], 'head', [0, 0.04, 0.06]);

  // ------------------------------------------------------------------ MORNING: 5 a.m.
  add('n1', 'bedroom', {
    update(c) { cast.ownerBedD.root.visible = false; dog().pose({ head: [0.12, -0.25, 0.05], tail: Math.sin(c.t * 9) * 0.5, lids: blink(c.t, 1, 2.6), look: [0.05, 0.2], ears: [0.05, 0.05] }); },
    camera(cam, lt, c) { const e = dogHead(); aim(cam, mixV(V(-0.12, 0.92, -2.05), V(-0.3, 0.9, -2.15), ease.inOut(lt / c.dur)), V(e.x, e.y - 0.02, e.z), { fov: 32, t: c.t }); },
    dof: focusOn(dogHead, 0.05),
  });
  add('n1@your', 'bedroom', {
    update(c) { dog().pose({ head: [0.1, -0.2, 0], tail: Math.sin(c.t * 10) * 0.6, lids: 1, look: [0.2, 0] }); },
    camera(cam, lt, c) { const k = ease.out(lt / c.dur); aim(cam, mixV(V(-0.35, 1.05, -1.75), V(1.05, 2.0, 0.55), k), mixV(V(-0.7, 0.8, -2.35), V(-0.45, 0.7, -2.35), k), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(-0.6, 0.75, -2.4)), aperture: 0.012 },
  });
  add('n1@5', 'bedroom', {
    update(c) {
      dog().root.position.set(-1.0, 0, -2.25); dog().root.rotation.y = PI / 2 - 0.6;
      const lean = ease.inOut(ramp(c.t, at('n1@5') + 0.6, at('n1@to')));
      dog().pose({ head: [0.25 + 0.1 * lean, 0.35 * lean, 0], lids: 1, look: [0.6, -0.3], tail: Math.sin(c.t * 9) * 0.4 });
    },
    camera(cam, lt, c) { aim(cam, mixV(V(-0.55, 0.7, -2.45), V(-0.66, 0.68, -2.52), ease.inOut(lt / c.dur)), V(-1.22, 0.6, -2.78), { fov: 30, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(-1.22, 0.6, -2.78)), aperture: 0.06 },
  });
  add('n1@to', 'bedroom', {
    update(c) { cast.ownerBedD.root.visible = false; dog().pose({ head: [0.0, -0.3, 0.1], lids: 1, look: [0.1, 0.25], ears: [0.15, 0.15], tail: Math.sin(c.t * 12) * 0.7 }); },
    camera(cam, lt, c) { const e = dogHead(); aim(cam, mixV(V(-0.1, 0.95, -2.0), V(-0.25, 0.92, -2.12), ease.inOut(lt / c.dur)), e, { fov: 30, t: c.t }); },
    dof: focusOn(dogHead, 0.05),
  });
  ['dog1', 'dog2', 'dog3'].forEach((id, i) => add(`${id}+-0.06`, 'bedroom', {
    update(c) {
      cast.ownerBedD.root.visible = false;
      const m = talk('dog', c.t, 1.15);
      const ear = i === 2 ? 0.25 + 0.35 * Math.sin(c.lt * 30) * Math.exp(-c.lt * 3) : 0.08 * i;
      dog().pose({ head: [0.0 - m * 0.12, -0.3 + i * 0.05, 0.08 * (i - 1)], jaw: m, jawMax: 0.5, lids: 1, look: [0.08, 0.2], ears: [ear, ear], tail: Math.sin(c.t * 14) * 0.8, dilate: 1.1 + i * 0.1 });
    },
    camera(cam, lt, c) {
      const e = dogHead(); const d0 = [1.0, 0.76, 0.58][i], d1 = d0 * 0.9;
      const k = ease.expo(lt / 0.22) * 0.7 + 0.3 * (lt / c.dur);
      const shake = i === 2 ? Math.exp(-lt * 6) * 0.012 : 0.0;
      const pos = e.clone().addScaledVector(V(0.85, 0.08, 0.5).normalize(), lerp(d0 * 1.12, d1, k)).add(V(Math.sin(lt * 70) * shake, Math.cos(lt * 63) * shake, 0));
      aim(cam, pos, e, { fov: 32, t: c.t, roll: (i - 1) * 0.04 });
    },
    dof: focusOn(dogHead, 0.05),
  }));
  const vocab = {
    update(c) {
      const d = dog(); d.root.position.set(0.55, 0, 0.6); d.root.rotation.y = 0;
      d.pose({ head: [0.08, 0.1 * Math.sin(c.t), Math.sin(c.t * 1.6) * 0.18], lids: blink(c.t, 1), look: [0, 0.15], tail: Math.sin(c.t * 8) * 0.5, ears: [0.1, -0.05] });
      const n = Math.round(165 * ease.out(ramp(c.t, at('n2@knows'), at('n2@words') + 0.25)));
      W.cgrp.visible = c.t > at('n2@knows') - 0.2;
      const pop = ease.back(ramp(c.t, at('n2@knows') - 0.2, at('n2@knows') + 0.25));
      W.cgrp.scale.setScalar(Math.max(0.001, pop) * (n === 165 ? 1 + 0.08 * Math.exp(-(c.t - at('n2@words') - 0.25) * 6) : 1));
      W.cgrp.position.set(0.55, 2.15, 0.5);
    },
    post(c) {
      const head = world(dog(), 'head', [0, 0.12, 0.05]);
      W.words.forEach((w, j) => {
        const a = c.t * 0.9 + (j / W.words.length) * PI * 2, rr = 0.42 + 0.04 * Math.sin(j * 2.1);
        w.group.visible = true;
        w.group.position.set(head.x + Math.cos(a) * rr, head.y + 0.3 + 0.05 * Math.sin(a * 2 + j), head.z + Math.sin(a) * rr * 0.8);
        w.group.lookAt(c.camera.position.x, w.group.position.y, c.camera.position.z);
        w.group.scale.setScalar(Math.max(0.001, ease.back(ramp(c.t, at('n2') + j * 0.12, at('n2') + 0.4 + j * 0.12))));
      });
      W.cgrp.lookAt(c.camera.position);
    },
  };
  add('n2', 'bedroom', { ...vocab,
    camera(cam, lt, c) { const a = lerp(0.32, 0.08, ease.inOut(lt / c.dur)); aim(cam, V(0.55 + Math.sin(a) * 1.45, 0.72 + 0.06 * (lt / c.dur), 0.6 + Math.cos(a) * 1.45), V(0.55, 0.92, 0.75), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(0.55, 0.9, 0.75)), aperture: 0.02 } });
  add('n2@165+-0.1', 'bedroom', { ...vocab,
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); const a = lerp(-0.4, 0.2, k); aim(cam, V(0.55 + Math.sin(a) * 3.2, 1.5 - 0.1 * k, 0.6 + Math.cos(a) * 3.2), V(0.55, 1.45, 0.6), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(0.55, 0.9, 0.7)), aperture: 0.012 } });
  add('n2@and', 'bedroom', {
    update(c) {
      const d = dog(); d.root.position.set(0.55, 0, 0.6); d.root.rotation.y = 0;
      const look = ease.inOut(ramp(c.t, at('n2@and'), at('n2@and') + 0.6));
      d.pose({ head: [-0.35 * look, 0.15 * look, 0.12 * look], jaw: 0.25 + 0.1 * Math.sin(c.t * 7), lids: 1, look: [0.3 * look, 0.7 * look], tail: Math.sin(c.t * 13) * 0.8, ears: [0.15, 0.15], dilate: 1.25 });
    },
    post(c) {
      const head = world(dog(), 'head', [0, 0.16, 0.08]);
      W.foodBubble.update(c.camera, { from: head, at: head.clone().add(V(0.3, 0.5, 0.05)), open: ease.out(ramp(c.t, at('n2@use') - 0.2, at('n2@use') + 0.25)), lt: c.lt });
    },
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(1.05, 1.3, 3.0), V(0.95, 1.4, 2.6), k), mixV(V(0.7, 1.35, 0.6), V(0.75, 1.45, 0.6), k), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(0.6, 1.1, 0.65)), aperture: 0.008 },
  });

  // ------------------------------------------------------------------ breakfast: the vase, the snitch, the silent cat
  const sill = V(2.43, 1.12, -0.7);
  add('n3', 'bedroom', {
    update(c) { cat().pose({ head: [0.05, 0.55, 0.05], tail: Math.sin(c.t * 1.6) * 0.15, lids: blink(c.t, 4, 4.4), look: [0.4, 0] }); },
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(1.25, 1.25, 0.25), V(1.55, 1.2, -0.05), k), V(2.43, 1.1, -0.66), { fov: 36, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, sill), aperture: 0.02 },
  });
  add('n3@biggest', 'bedroom', {
    update(c) {
      const flick = ease.inOut(ramp(c.t, at('n3@snitch') - 0.1, at('n3@snitch') + 0.35));
      cat().pose({ head: [0.05, 0.75, 0.05], tail: 0.15 + 0.9 * flick, lids: 0.75, look: [0.7, 0] });
    },
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(1.85, 1.02, -0.05), V(1.95, 1.0, -0.15), k), V(2.43, 1.03, -0.5), { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(2.43, 1.05, -0.45)), aperture: 0.03 },
  });
  add('n3.end+-0.45', 'bedroom', {
    update(c) { cat().pose({ head: [0.25, 0.9, 0.05], tail: 1.05, lids: 0.7, look: [0.6, -0.6] }); },
    camera(cam, lt, c) { const shake = Math.exp(-Math.max(0, c.t - at('n3.end') - 0.08) * 8) * (c.t > at('n3.end') + 0.08 ? 0.015 : 0); aim(cam, V(1.25 + Math.sin(c.t * 80) * shake, 0.32, 0.3), V(2.05, 0.2, -0.5), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(2.05, 0.1, -0.5)), aperture: 0.015 },
  });
  const snitchDog = (c, gain = 1.15) => {
    const d = dog(); d.root.position.set(1.45, 0, -0.35); d.root.rotation.set(0, PI / 2 + 0.15, 0);
    const m = talk('dog', c.t, gain, ['snitch']);
    d.pose({ head: [-0.25 - m * 0.1, 0.25, 0.05], jaw: m, jawMax: 0.5, lids: 1, look: [0.5, 0.5], ears: [0.2, 0.2], tail: Math.sin(c.t * 14) * 0.8 });
  };
  add('snitch+-0.15', 'bedroom', {
    update(c) { snitchDog(c); cat().pose({ head: [0.1, 0.9, 0.05], tail: 0.6, lids: 0.6, look: [0.7, -0.4] }); },
    camera(cam, lt, c) { const e = dogHead(); aim(cam, e.clone().add(V(0.62 - 0.05 * (lt / c.dur), 0.02, 0.5)), e.clone().add(V(0.05, 0.02, 0)), { fov: 38, t: c.t }); },
    dof: focusOn(dogHead, 0.03),
  });
  add('snitch@was+-0.1', 'bedroom', {
    update(c) { snitchDog(c); cat().pose({ head: [0.12, 0.95, 0.1], tail: Math.sin(c.t * 2) * 0.1, lids: 0.5, look: [0.75, -0.3] }); },
    camera(cam, lt, c) { const e = catHead(); aim(cam, e.clone().add(V(-0.5, -0.04, 0.3)), e.clone().add(V(0, -0.03, 0)), { fov: 32, t: c.t }); },
    dof: focusOn(() => catHead(), 0.04),
  });
  add('n4', 'bedroom', {
    update(c) {
      const sl = clamp01(Math.sin(ramp(c.t, at('n4@wouldn') - 0.1, at('n4@thing') + 0.3) * PI));
      cat().pose({ head: [0.05, 0.3, 0.04], lids: 1 - 0.65 * sl, look: [0.15, 0], tail: Math.sin(c.t * 2.1) * 0.12 });
    },
    camera(cam, lt, c) { const a = lerp(-0.55, -0.25, ease.inOut(lt / c.dur)); aim(cam, V(2.43 - Math.cos(a) * 1.15, 1.08, -0.9 - Math.sin(a) * 1.15), V(2.43, 1.12, -0.88), { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(2.43, 1.2, -0.9)), aperture: 0.03 }, exposure: 1.05,
  });

  // ------------------------------------------------------------------ the goodbye
  const goodbye = (c) => {
    const o = cast.ownerUpD; o.root.visible = true;
    const leave = ease.inOut(ramp(c.t, at('bye.end') - 0.6, at('bye.end') + 0.2));
    o.root.position.set(lerp(-1.95, -3.0, leave), 0, 1.6); o.root.rotation.set(0, -PI / 2 + 0.3 * (1 - leave), 0);
    o.pose({ lids: blink(c.t, 3), look: [0.4, -0.5], head: [0.35, 0.2, 0], nodes: { arm_r: [-0.4, 0, 0.2], fore_r: [-0.6, 0, 0] } });
    const d = dog(); d.root.position.set(-1.2, 0, 1.45); d.root.rotation.set(0, -PI / 2 - 0.1, 0);
    const m = talk('dog', c.t, 1.15, ['bye']);
    const howl = ease.inOut(ramp(c.t, at('bye@love') - 0.1, at('bye@love') + 0.25));
    d.pose({ head: [-0.3 - 0.45 * howl - m * 0.08, 0.15, 0.1 * Math.sin(c.t * 3)], jaw: m, jawMax: 0.55, lids: 0.92, look: [0, 0.6], ears: [-0.25, -0.25], dilate: 1.45, tail: 0.15 * Math.sin(c.t * 4) });
  };
  add('n5', 'bedroom', { update: goodbye,
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(0.9, 1.6, 3.3), V(0.5, 1.45, 3.0), k), V(-1.6, 0.9, 1.5), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(-1.4, 0.8, 1.5)), aperture: 0.012 } });
  add('n5@even', 'bedroom', { update: goodbye,
    camera(cam, lt, c) { const e = dogHead(); aim(cam, e.clone().add(V(-0.3 + 0.04 * (lt / c.dur), 0.26, 0.66)), e, { fov: 34, t: c.t }); },
    dof: focusOn(dogHead, 0.04) });
  add('n5@same', 'bedroom', { update: goodbye,
    camera(cam, lt, c) { aim(cam, mixV(V(-0.2, 0.55, 2.4), V(-0.35, 0.6, 2.25), ease.inOut(lt / c.dur)), V(-1.75, 1.05, 1.55), { fov: 38, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(-1.3, 0.8, 1.5)), aperture: 0.015 } });
  add('bye+-0.1', 'bedroom', { update: goodbye,
    camera(cam, lt, c) { const e = dogHead(); aim(cam, e.clone().add(V(-0.32, 0.2, 0.58)), e, { fov: 32, t: c.t, roll: 0.03 }); },
    dof: focusOn(dogHead, 0.05) });
  add('bye@coming+-0.2', 'bedroom', { update: goodbye,
    camera(cam, lt, c) { const e = dogHead(); aim(cam, e.clone().add(V(-0.26 + 0.04 * (lt / c.dur), 0.14, 0.46)), e, { fov: 32, t: c.t, roll: -0.03 }); },
    dof: focusOn(dogHead, 0.05) });
  add('bye@love+-0.12', 'bedroom', { update: goodbye,
    camera(cam, lt, c) { const e = dogHead(); aim(cam, e.clone().add(V(-0.38, -0.35, 0.68)), e.clone().add(V(0, 0.08, 0)), { fov: 38, t: c.t }); },
    dof: focusOn(dogHead, 0.03) });

  // ------------------------------------------------------------------ the vet
  const vetDog = (c) => {
    const d = cast.dogVet; const m = talk('dog', c.t, 1.15, ['vet']);
    const flop = ease.inOut(ramp(c.t, at('vet@you') - 0.15, at('vet@you') + 0.25));
    d.root.position.set(-0.6, 0.18 * flop, 0.6); d.root.rotation.set(0, 1.9, 0);
    d.pose({ body: [-0.22 - 0.2 * flop, 0, 1.45 * flop], head: [0.1 - m * 0.1, -0.3 * flop, 0], jaw: m, jawMax: 0.55, ears: [-0.35, -0.35], lids: 0.9 - 0.3 * flop, look: [0.2, 0.2], tail: 0.6 });
  };
  const leash = (c) => { const d = cast.dogVet; c.S.leash(world(d, 'body', [0, 0.6, 0.16]), world(cast.ownerVet, 'fore_r', [-0.012, -0.29, 0.04])); };
  add('n6', 'vetlot', { update: vetDog, post: leash,
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(-3.4, 1.7, 5.8), V(-2.8, 1.45, 5.0), k), V(-0.3, 1.9, -1.8), { fov: 44, t: c.t }); },
    dof: { focus: 4.5, aperture: 0.006 } });
  add('n6@hostage+-0.1', 'vetlot', { update: vetDog, post: leash,
    camera(cam, lt, c) { aim(cam, mixV(V(-2.0, 0.45, 2.1), V(-1.85, 0.42, 1.9), ease.inOut(lt / c.dur)), V(0.0, 0.55, 0.35), { fov: 38, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.dogVet, 'head')), aperture: 0.02 } });
  add('vet+-0.1', 'vetlot', { update: vetDog, post: leash,
    camera(cam, lt, c) { const e = world(cast.dogVet, 'head', [0, 0.13, 0.12]); aim(cam, e.clone().add(V(0.6, -0.12, 0.05)), e, { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.dogVet, 'head', [0, 0.12, 0.12])), aperture: 0.04 } });
  add('vet@you+-0.1', 'vetlot', { update: vetDog, post: leash,
    camera(cam, lt, c) { const e = world(cast.dogVet, 'body', [0, 0.4, 0.1]); aim(cam, e.clone().add(V(0.9, 1.1, 0.45)), e, { fov: 40, t: c.t, roll: 0.12 }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.dogVet, 'body', [0, 0.4, 0])), aperture: 0.02 } });

  // ------------------------------------------------------------------ CITY: pigeons
  add('n7', 'city', {
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(10, 32, -26), V(4, 24, -17), k), V(0, 12, -2), { fov: 44, t: c.t, amp: 3 }); },
  });
  add('n7@pigeons+-0.1', 'city', {
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, V(lerp(-2.7, -2.15, k), 15.24, lerp(-0.42, -0.36, k)), V(lerp(0.6, 0.9, k), 15.06, -0.05), { fov: 30, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(-1.15, 15.12, -0.08)), aperture: 0.01 },
  });
  const pigeonTalk = (c) => {
    const m = talk('pigeon', c.t, 1.0);
    W.pigeons[2].pose({ head: [0.55 + m * 0.15, 0.0, 0.0], jaw: m, jawMax: 0.7, lids: 1, look: [0, -0.4] });
    const laugh = ramp(c.t, at('pigeon@spot') + 0.15, at('pigeon@spot') + 0.35);
    W.pigeons.forEach((q, i) => {
      if (i === 2 || laugh <= 0) return;
      const b = Math.abs(Math.sin(c.t * 12 + i * 1.3));
      q.pose({ head: [-0.2 + 0.45 * b * laugh, (i < 2 ? 0.55 : -0.55) * laugh, 0], jaw: 0.8 * b * laugh, jawMax: 0.7, lids: 1 - 0.5 * laugh });
    });
    cast.bald.root.position.set(0.35 - (c.t - at('pigeon')) * 0.9, 0.15, -1.55);
  };
  add('pigeon+-0.12', 'city', { update: pigeonTalk,
    camera(cam, lt, c) { const head = world(cast.bald, 'head', [0, 0.18, 0]); aim(cam, V(head.x + 0.35, 15.35, -0.62), head.clone().add(V(0, 0, -0.1)), { fov: lerp(7.5, 6.2, ease.inOut(lt / c.dur)), t: c.t, amp: 0.15 }); } });
  add('pigeon@spot+0.12', 'city', {
    update(c) { W.pigeons.forEach((p, i) => { p.root.position.set((i - 2) * 0.2, 15.0, -0.1 + (i % 2) * 0.05); p.root.rotation.y = PI + (i - 2) * 0.25; }); pigeonTalk(c); },
    camera(cam, lt, c) { aim(cam, mixV(V(0.2, 15.12, -1.75), V(0.08, 15.12, -1.5), ease.out(lt / c.dur)), V(0.0, 15.12, -0.05), { fov: 38, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(0, 15.13, -0.08)), aperture: 0.01 },
  });

  // ------------------------------------------------------------------ CITY: crows
  const crowsWatch = (c, target, lean = 0) => {
    W.crows.forEach((cr, i) => {
      const p = world(cr, 'head'); const d = target.clone().sub(p);
      const yaw = Math.atan2(d.x, -d.z) * 0.6, pitch = clamp01(-d.y / (d.length() + 0.01)) * 0.9;
      cr.pose({ head: [pitch * 0.8 + lean, -yaw, 0], lids: blink(c.t, i + 7, 3.1) * (0.85 - lean * 0.3), jaw: lean > 0 ? 0.7 * Math.abs(Math.sin(c.t * 9 + i)) : 0, jawMax: 0.7 });
    });
  };
  add('n8', 'city', {
    update(c) { crowsWatch(c, V(33, 1.6, 4)); },
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(32.4, 2.4, 2.2), V(32.9, 2.9, 1.4), k), V(33.0, 6.1, -2.9), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(33.2, 6.3, -2.9)), aperture: 0.006 },
  });
  add('n8@in+-0.1', 'city', {
    update(c) { crowsWatch(c, V(30, 1.6, 4)); },
    post(c) {
      const h = world(W.crows[2], 'head', [0, 0.05, 0]);
      W.crowBubble.update(c.camera, { from: h, at: h.clone().add(V(-0.42, 0.78, 0.3)), open: ease.out(ramp(c.t, at('n8@in') + 0.1, at('n8@in') + 0.5)), lt: c.lt });
    },
    camera(cam, lt, c) { const h = world(W.crows[2], 'head'); aim(cam, h.clone().add(V(-0.6 + 0.1 * (lt / c.dur), -0.4, 2.6)), h.clone().add(V(-0.45, 0.45, 0)), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(W.crows[2], 'head')), aperture: 0.006 },
  });
  const sciWalk = (c) => {
    const s = cast.sciCity; const k = c.t - at('n8@and#2');
    s.root.position.set(38 - k * 1.1, 0.15, -2.2); s.root.rotation.set(0, -PI / 2, 0);
    const sw = Math.sin(c.t * 8);
    s.pose({ body: [0, 0, sw * 0.02], head: [0.3, -0.2, 0], lids: 1, look: [0, 0.5], nodes: { arm_l: [-2.4, 0, 0.3], fore_l: [-1.2, 0, 0], arm_r: [-sw * 0.4, 0, 0] } });
  };
  add('n8@and#2+-0.1', 'city', {
    update(c) { sciWalk(c); crowsWatch(c, world(cast.sciCity, 'head'), 0.45); },
    camera(cam, lt, c) { const h = world(cast.sciCity, 'head'); aim(cam, h.clone().add(V(-3.2, -0.6, 3.0)), V(h.x + 0.6, 3.6, -2.6), { fov: 46, t: c.t, amp: 2 }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.sciCity, 'head')), aperture: 0.005 },
  });
  const youWalk = (c) => {
    const o = cast.ownerCity; const k = c.t - at('n9');
    o.root.position.set(39 - k * 1.05, 0.15, -2.0); o.root.rotation.set(0, -PI / 2, 0);
    const sw = Math.sin(c.t * 7.5);
    const up = ease.inOut(ramp(c.t, at('crow@the') - 0.2, at('crow@the') + 0.2));
    o.pose({ body: [0, 0, sw * 0.02], head: [-0.55 * up, -0.35 * up, 0], lids: 1, look: [0, 0.6 * up], dilate: 1 + 0.3 * up, nodes: { arm_l: [sw * 0.4, 0, 0], arm_r: [-sw * 0.4, 0, 0] } });
  };
  add('n9', 'city', {
    update(c) { youWalk(c); crowsWatch(c, world(cast.ownerCity, 'head')); },
    camera(cam, lt, c) { const h = world(cast.ownerCity, 'head'); aim(cam, h.clone().add(V(-2.6, -0.2, 0.9)), h.clone().add(V(0, -0.15, 0)), { fov: 38, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.ownerCity, 'head')), aperture: 0.012 },
  });
  add('n9@warn+-0.1', 'city', {
    update(c) {
      youWalk(c);
      W.crows.forEach((cr, i) => { const k = ramp(c.t, at('n9@warn') + i * 0.22, at('n9@warn') + i * 0.22 + 0.25) * (1 - ramp(c.t, at('n9@warn') + i * 0.22 + 0.5, at('n9@warn') + i * 0.22 + 0.7));
        cr.pose({ head: [0.15, (i % 2 ? 1 : -1) * 0.9 * k, 0.25 * k], jaw: 0.5 * k, jawMax: 0.6, lids: blink(c.t, i + 7, 3.1) * 0.85 }); });
    },
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, V(lerp(28.5, 32.5, k), 6.15, -1.4), V(lerp(31.5, 35.5, k), 6.25, -2.9), { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(lerp(31.5, 35.5, c.u), 6.3, -2.9)), aperture: 0.012 },
  });
  add('crow+-0.1', 'city', {
    update(c) { youWalk(c); crowsWatch(c, world(cast.ownerCity, 'head')); const m = talk('crow', c.t, 1.0); W.crows[3].pose({ head: [0.85, 0.2, 0], jaw: m, jawMax: 0.75, lids: 0.7, look: [0, -0.5] }); },
    camera(cam, lt, c) { const h = world(W.crows[3], 'head', [0, 0.062, 0.03]); aim(cam, h.clone().add(V(0.2, -0.12, -0.5)), h, { fov: 32, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(W.crows[3], 'head', [0, 0.062, 0.03])), aperture: 0.03 },
  });
  add('crow@the+-0.2', 'city', {
    update(c) { youWalk(c); crowsWatch(c, world(cast.ownerCity, 'head')); const m = talk('crow', c.t, 1.0); W.crows[3].pose({ head: [0.85, 0.2, 0], jaw: m, jawMax: 0.75, lids: 0.7 }); },
    camera(cam, lt, c) { const h = world(cast.ownerCity, 'head'); aim(cam, h.clone().add(V(-0.9, -0.15, 0.7)), h.clone().add(V(0, 0.05, 0)), { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.ownerCity, 'head')), aperture: 0.02 },
  });

  // ------------------------------------------------------------------ LUNCH: burger, cows
  add('n10', 'drivethru', {
    camera(cam, lt, c) { aim(cam, V(0.02, 1.02, 0.32), mixV(V(-0.45, 0.68, -0.05), V(-0.55, 0.7, 0.05), ease.inOut(lt / c.dur)), { fov: 44, t: c.t }); },
    dof: { focus: 0.45, aperture: 0.015 },
  });
  add('n10@earth+-0.1', 'farm', {
    camera(cam, lt, c) { const H = c.S.H; aim(cam, mixV(V(-7, 40, -28), V(2, 18, -55), ease.inOut(lt / c.dur)), V(0, H(0, -125) + 3.2, -125), { fov: 42, t: c.t, amp: 4 }); },
  });
  add('n10@and', 'drivethru', {
    update(c) {
      const k = ease.out(ramp(c.t, at('n10@and') + 0.15, at('n10@burgers')));
      cast.cowHead.root.position.set(lerp(-2.6, -1.32, k), -0.5, 0.18); cast.cowHead.root.rotation.set(0, PI / 2, 0);
      cast.cowHead.pose({ head: [0.1, -0.15 * (1 - k), 0], lids: blink(c.t, 2, 3.0), look: [0.35, -0.1], ears: [0.2 * Math.sin(c.t * 3), 0.1] });
    },
    camera(cam, lt, c) { aim(cam, V(0.02, 1.02, 0.32), mixV(V(-0.7, 0.62, -0.2), V(-0.85, 0.78, 0.12), ease.inOut(lt / c.dur)), { fov: 44, t: c.t }); },
    dof: { focus: 1.0, aperture: 0.01 },
  });
  add('cow+-0.1', 'drivethru', {
    update(c) {
      const cow = cast.cowHead; cow.root.position.set(-1.27, -0.5, 0.18); cow.root.rotation.set(0, PI / 2, 0);
      const m = talk('cow', c.t, 1.0);
      cow.pose({ head: [0.12 - m * 0.04, 0.05, 0], jaw: m, jawMax: 0.32, lids: 0.72, look: [0.45, -0.05], ears: [-0.15, -0.15] });
      const lower = ease.inOut(ramp(c.t, at('cow@to'), at('cow.end') + 0.2));
      W.handBurger.position.set(-0.32, 0.74 - lower * 0.18, 0.08 + lower * 0.04); W.handBurger.rotation.set(0.25 + lower * 0.3, -PI / 2 + 0.3, -0.15);
    },
    camera(cam, lt, c) { const e = world(cast.cowHead, 'head', [0, -0.07, 0.24]); aim(cam, mixV(V(0.02, 0.95, 0.32), V(-0.2, 0.9, 0.26), ease.inOut(lt / c.dur)), e, { fov: 38, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.cowHead, 'head', [0, 0.06, 0.22])), aperture: 0.03 },
  });

  // ------------------------------------------------------------------ chickens
  const henTalk = (c) => {
    const m = talk('chicken', c.t, 1.0);
    const smug = ramp(c.t, at('chicken@obviously') - 0.05, at('chicken@obviously') + 0.2);
    cast.hen.pose({ head: [-0.1 - m * 0.1 - 0.15 * smug, 0.5 - 0.9 * smug, 0.15 * smug], jaw: m, jawMax: 0.6, lids: 1 - 0.5 * smug, look: [0.5 - smug, 0.1] });
  };
  const sciMic = (c, reach) => {
    const s = cast.sci; const m = talk('sci', c.t, 1.0);
    s.pose({ jaw: m, jawMax: 0.35, head: [0.25, -0.25, 0], lids: blink(c.t, 6), look: [0.5, -0.4], nodes: { arm_r: [-1.1 * reach - 0.2, 0.25 * reach, -0.3], fore_r: [-0.5 - 0.3 * reach, 0, 0], arm_l: [-0.3, 0, 0], fore_l: [-1.3, 0, 0] } });
    W.mic.visible = true; W.mic.position.copy(world(s, 'fore_r', [-0.012, -0.24, 0.06])); W.mic.rotation.set(0, 0, 0.6);
  };
  add('n11', 'farm', {
    update(c) {
      W.chickGroup.visible = true;
      W.chickGroup.scale.setScalar(Math.max(0.001, ease.back(ramp(c.t, at('n11@more') - 0.2, at('n11@more') + 0.2))));
    },
    camera(cam, lt, c) { const H = c.S.H; const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(-37.4, H(-37.4, -48) + 2.6, -47.5), V(-37.9, H(-37.9, -50) + 2.2, -49.8), k), V(-41.6, H(-41.6, -60) + 2.1, -61), { fov: 44, t: c.t, amp: 2 }); },
    dof: { focus: 9, aperture: 0.003 },
  });
  add('n11@so+-0.1', 'farm', {
    update(c) {
      const s = cast.sci; const k = ease.out(ramp(c.t, at('n11@so'), at('n11@settle')));
      s.root.position.set(lerp(-37.5, -38.95, k), s.root.position.y, lerp(-54.5, -57.1, k)); sciMic(c, 0.0); henTalk(c);
    },
    camera(cam, lt, c) { const h = world(cast.hen, 'head'); aim(cam, mixV(h.clone().add(V(-2.2, 0.9, 4.4)), h.clone().add(V(-1.9, 0.75, 3.8)), ease.inOut(lt / c.dur)), h.clone().add(V(0.5, 0.05, 0.45)), { fov: 46, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.hen, 'head')), aperture: 0.008 },
  });
  add('sci+-0.1', 'farm', {
    update(c) { cast.sci.root.position.set(-38.95, cast.sci.root.position.y, -57.1); sciMic(c, ease.out(ramp(c.t, at('sci') - 0.1, at('sci') + 0.3))); henTalk(c); },
    camera(cam, lt, c) { const h = world(cast.hen, 'head'); const s = world(cast.sci, 'head'); aim(cam, s.clone().add(V(0.35, 0.42, 1.05)), h.clone().add(V(0.15, 0.05, 0)), { fov: 38, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.hen, 'head')), aperture: 0.02 },
  });
  add('chicken+-0.1', 'farm', {
    update(c) { cast.sci.root.position.set(-38.95, cast.sci.root.position.y, -57.1); sciMic(c, 1); henTalk(c); },
    camera(cam, lt, c) { const h = world(cast.hen, 'head', [0, 0.06, 0.08]); aim(cam, h.clone().add(V(0.1 - 0.03 * (lt / c.dur), 0.02, 0.62)), h, { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.hen, 'head', [0, 0.06, 0.08])), aperture: 0.035 },
  });
  add('chicken@obviously+-0.1', 'farm', {
    update(c) { cast.sci.root.position.set(-38.95, cast.sci.root.position.y, -57.1); sciMic(c, 1); henTalk(c); },
    camera(cam, lt, c) { const h = world(cast.hen, 'head', [0, 0.06, 0.08]); aim(cam, h.clone().add(V(0.45, 0.02, 0.42)), h, { fov: 32, t: c.t, roll: 0.04 }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.hen, 'head', [0, 0.06, 0.08])), aperture: 0.04 },
  });
  // ------------------------------------------------------------------ the strike
  const strike = (c, chant = false) => {
    W.jugs.forEach((j, i) => j.scale.setScalar(Math.max(0.001, ease.back(ramp(c.t, at('n12@7') + i * 0.12, at('n12@7') + 0.25 + i * 0.12)))));
    W.galGroup.visible = c.t < at('n12@and') + 0.3;
    W.galGroup.scale.setScalar(Math.max(0.001, ease.back(ramp(c.t, at('n12@7') - 0.15, at('n12@7') + 0.2))));
    const stern = ramp(c.t, at('n12@and'), at('n12@and') + 0.6);
    W.strikers.forEach((s, i) => {
      const m = chant ? talk('cows', c.t, 1.0) : 0;
      s.pose({ head: [0.12 - m * 0.06, 0.06 * Math.sin(c.t * 1.1 + i), 0.03 * Math.sin(c.t * 4 + i) * (chant ? 1 : 0)], jaw: m, jawMax: 0.35, lids: lerp(1, 0.68, stern) * blink(c.t, i + 3, 3.3), look: [0, -0.1], ears: [-0.25 * stern, -0.25 * stern] });
    });
    if (chant) W.signs.forEach((s, i) => { s.position.y = c.S.H(s.position.x, s.position.z) + 0.12 * Math.abs(Math.sin(c.t * 6.5 + i)); });
  };
  add('n12', 'farm', { update: (c) => strike(c),
    camera(cam, lt, c) { const H = c.S.H; const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(6.1, H(6, -11) + 1.5, -10.6), V(6.2, H(6, -11) + 1.3, -11.4), k), V(6.1, H(6, -18) + 1.2, -18.3), { fov: 44, t: c.t }); },
    dof: { focus: 6.2, aperture: 0.006 } });
  add('n12@and', 'farm', { update: (c) => strike(c),
    camera(cam, lt, c) { const H = c.S.H; const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(4.2, H(4, -15) + 1.3, -14.4), V(5.3, H(5, -15) + 1.2, -15.1), k), V(6.3, H(6, -20) + 1.3, -21), { fov: 44, t: c.t }); },
    dof: { focus: 5.2, aperture: 0.01 } });
  add('cows+-0.1', 'farm', { update: (c) => strike(c, true),
    camera(cam, lt, c) { const H = c.S.H; aim(cam, mixV(V(6.3, H(6, -15) + 0.7, -14.8), V(6.3, H(6, -15) + 0.75, -15.3), ease.out(lt / c.dur)), V(6.3, H(6, -21) + 1.45, -21.4), { fov: 50, t: c.t, roll: Math.sin(c.t * 6.5) * 0.01 }); },
    dof: { focus: 5.0, aperture: 0.008 } });
  // ------------------------------------------------------------------ the bee
  const beeOn = (c, flower = 0) => {
    const b = cast.bee; const fl = W.flowerSpot;
    if (flower > 0) {
      b.root.position.set(fl.x + 0.18, fl.y + 0.52 + 0.02 * Math.sin(c.t * 9), fl.z + 0.62); b.root.rotation.set(0.15, 0.6, 0);
    }
    const m = talk('bee', c.t, 1.1);
    const wink = ramp(c.t, at('bee@welcome'), at('bee@welcome') + 0.12) * (1 - ramp(c.t, at('bee.end') + 0.1, at('bee.end') + 0.3));
    const f = Math.sin(c.t * 95);
    b.pose({ jaw: m, jawMax: 0.5, lids: [1 - 0.9 * wink, 1 - 0.2 * wink], look: [0.1, 0.1], head: [0, 0.1 * Math.sin(c.t * 3), 0.12 * wink], nodes: { wing_l: [0, 0, 0.7 * f], wing_r: [0, 0, -0.7 * f] } });
  };
  add('n13', 'farm', { update: (c) => beeOn(c, 0),
    camera(cam, lt, c) { const b = world(cast.bee, 'head'); aim(cam, b.clone().add(V(-0.25, 0.05, 1.3 - 0.3 * (lt / c.dur))), b, { fov: 34, t: c.t, amp: 0.6 }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.bee, 'head')), aperture: 0.03 } });
  add('n13@about+-0.1', 'farm', {
    update(c) { beeOn(c, 0); W.biteGroup.visible = true; W.biteGroup.scale.setScalar(Math.max(0.001, ease.back(ramp(c.t, at('n13@1') - 0.1, at('n13@1') + 0.3)))); },
    camera(cam, lt, c) { const fl = W.flowerSpot; const a = lerp(-0.4, 0.3, ease.inOut(lt / c.dur)); aim(cam, V(fl.x + Math.sin(a) * 3.6, fl.y + 1.25, fl.z + Math.cos(a) * 3.6), V(fl.x, fl.y + 1.25, fl.z - 0.4), { fov: 40, t: c.t }); },
    dof: { focus: 3.6, aperture: 0.008 } });
  add('n13@depends+-0.1', 'farm', { update: (c) => beeOn(c, 1),
    camera(cam, lt, c) { const b = world(cast.bee, 'head'); aim(cam, b.clone().add(V(0.35, 0.1, 0.55 - 0.08 * (lt / c.dur))), b.clone().add(V(0, -0.03, 0)), { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.bee, 'head')), aperture: 0.04 } });
  add('bee+-0.1', 'farm', { update: (c) => beeOn(c, 1),
    camera(cam, lt, c) { const b = world(cast.bee, 'head', [0, 0.003, 0.014]); aim(cam, b.clone().add(V(0.15, 0.02, 0.24)), b, { fov: 32, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.bee, 'head', [0, 0.003, 0.014])), aperture: 0.045 } });

  // ------------------------------------------------------------------ BEACH
  const gullAct = (c) => {
    const g = cast.gull; const Hb = c.S.Hb;
    const land = ease.out(ramp(c.t, at('n14') + 0.2, at('n14@steal')));
    const grab = ease.inOut(ramp(c.t, at('n14@fries') - 0.1, at('n14@fries') + 0.25));
    const off = ease.inOut(ramp(c.t, at('gull.end') + 0.05, at('gull.end') + 0.6));
    g.root.position.set(lerp(3.5, 1.0, land) + 0.6 * off, lerp(4.0, Hb(1.0, 2.95) - 0.01, land) + 2.5 * off * off, lerp(1.5, 2.95, land));
    g.root.rotation.set(0, -0.9 + 0.4 * grab, 0);
    const m = talk('gull', c.t, 1.0);
    g.pose({ head: [0.35 * grab * (1 - grab) * 4 - m * 0.08, 0.3 * grab, 0], jaw: m, jawMax: 0.6, lids: blink(c.t, 5, 2.8), look: [0.3, 0] });
    W.fry.visible = grab > 0.5;
    if (W.fry.visible) { W.fry.position.copy(world(g, 'jaw', [0, -0.002, 0.03])); W.fry.rotation.set(PI / 2, 0, 0.3); }
  };
  add('n14', 'beach', { update: gullAct,
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(3.2, 1.6, 7.5), V(2.6, 1.35, 6.6), k), V(0.6, 0.9, 3.2), { fov: 42, t: c.t }); },
    dof: { focus: 4.0, aperture: 0.006 } });
  add('n14@fries+-0.15', 'beach', { update: gullAct,
    camera(cam, lt, c) { const f = W.fries.position; aim(cam, f.clone().add(V(0.9, 0.05, 0.55)), f.clone().add(V(0.2, -0.05, 0)), { fov: 36, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, W.fries.position), aperture: 0.02 } });
  add('n14@but+-0.1', 'beach', { update: gullAct,
    camera(cam, lt, c) { const g = world(cast.gull, 'head'); aim(cam, g.clone().add(V(0.5 - 0.06 * (lt / c.dur), 0.08, 0.75)), g.clone().add(V(-0.12, 0.1, 0)), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.gull, 'head')), aperture: 0.015 } });
  add('gull+-0.1', 'beach', { update: gullAct,
    camera(cam, lt, c) { const g = world(cast.gull, 'head', [0, 0.064, 0.031]); aim(cam, g.clone().add(V(0.28, 0.0, 0.42)), g, { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.gull, 'head', [0, 0.064, 0.031])), aperture: 0.035 } });
  const dolphins = (c, jump = false) => {
    W.dolphins.forEach((d, i) => {
      d.root.visible = true;
      const ph = c.t * 0.9 + i * 2.1;
      const arc = Math.sin(ph); const y = -0.24 + 0.6 * Math.max(0, arc);
      d.root.position.set(-2.2 + i * 3.6 + Math.cos(ph) * 1.0, y, -7.5 - i * 1.5); d.root.rotation.set(-Math.cos(ph) * 0.6, i ? -0.9 : 0.9, 0);
      d.pose({ jaw: 0.2 * Math.max(0, arc), lids: blink(c.t, i + 2, 3.2), nodes: { tail: [0.3 * Math.sin(ph * 2), 0, 0] } });
    });
    if (jump) {
      const d = W.dolphins[0]; const tj = (c.t - (at('dolphin') - 0.55)) / 2.75;
      const k = clamp01(tj);
      d.root.position.set(-1.5 + 2.2 * k, -0.9 + 4.2 * k * (1 - k) * 1.9, -7.5); d.root.rotation.set(-(1 - 2 * k) * 0.9, 0.55, 0);
      const m = talk('dolphin', c.t, 1.0);
      d.pose({ jaw: m, jawMax: 0.45, lids: 1, look: [0.8, 0.2], nodes: { tail: [0.5 * Math.sin(c.t * 9), 0, 0] } });
      W.splash.visible = tj > -0.05 && tj < 0.25;
      W.splash.children.forEach((s, j) => { const a = j * 2.4, sp = 0.6 + (j % 5) * 0.25, u = clamp01(tj + 0.05) * 1.6; s.position.set(-1.5 + Math.cos(a) * sp * u * 1.5, 0.2 + sp * 3 * u - 6 * u * u, -7.5 + Math.sin(a) * sp * u); });
    }
  };
  add('n15', 'beach', {
    update(c) { dolphins(c); W.rings.forEach((r, i) => { const k = ((c.t - at('n15@using')) * 0.8 + i * 0.25) % 1; r.visible = c.t > at('n15@using') - 0.2; const p = W.dolphins[i % 2].root.position; r.position.set(p.x, 0.35, p.z); r.rotation.set(PI / 2, 0, 0); r.scale.setScalar(0.2 + k * 3); r.material.opacity = 1 - k; }); },
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(0.5, 1.9, -1.2), V(0.1, 1.4, -2.2), k), V(-0.2, 0.1, -8.2), { fov: 42, t: c.t, amp: 2 }); },
    dof: { focus: 6.5, aperture: 0.005 } });
  add('n15@so+-0.1', 'beach', {
    update(c) { dolphins(c); const d = W.dolphins[1]; d.root.position.set(-0.6, -0.12, -4.5); d.root.rotation.set(-0.35, PI, 0); d.pose({ lids: blink(c.t, 4, 3.0), look: [0, 0.2], jaw: 0.1 }); },
    camera(cam, lt, c) { const d = world(W.dolphins[1], 'body', [0, 0.1, 0.6]); aim(cam, d.clone().add(V(0.6, 0.35, -1.6 + 0.2 * (lt / c.dur))), V(0.2, 1.0, 3.6), { fov: 40, t: c.t }); },
    dof: { focus: 8, aperture: 0.004 } });
  add('dolphin+-0.6', 'beach', { update: (c) => dolphins(c, true),
    camera(cam, lt, c) { const d = world(W.dolphins[0], 'body', [0, 0.1, 0.6]); aim(cam, V(1.2, 1.1, -3.2), d, { fov: 40, t: c.t, amp: 2 }); },
    dof: { focus: (c) => dist(c.camera.position, world(W.dolphins[0], 'body', [0, 0.1, 0.6])), aperture: 0.008 } });

  // ------------------------------------------------------------------ WORK: the parrot
  add('n16', 'office', {
    update(c) {
      W.parrotGroup.visible = true;
      W.parrotGroup.scale.setScalar(Math.max(0.001, ease.back(ramp(c.t, at('n16@more') - 0.2, at('n16@more') + 0.2))));
      cast.gary.root.visible = false;
    },
    post(c) { W.parrotGroup.lookAt(c.camera.position); },
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(-0.1, 1.5, 2.0), V(-0.2, 1.55, 1.7), k), V(-0.4, 1.6, -0.1), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(-0.45, 1.5, -0.1)), aperture: 0.01 },
  });
  add('n16@so#2+-0.1', 'office', {
    update(c) { cast.parrot.pose({ head: [0.1, 0.35 * Math.sin(c.t * 0.9), 0.3 * Math.sin(c.t * 2.4)], lids: blink(c.t, 5), look: [0.3, 0.2] }); cast.gary.root.visible = false; },
    post(c) { const h = world(cast.parrot, 'head', [0, 0.08, 0.02]); W.memory.update(c.camera, { from: h, at: h.clone().add(V(0.3, 0.3, 0.05)), open: ease.out(ramp(c.t, at('n16@repeat') - 0.15, at('n16@repeat') + 0.3)), lt: c.lt }); },
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(-0.12, 1.55, 1.95), V(-0.02, 1.62, 1.62), k), mixV(V(-0.3, 1.55, -0.1), V(-0.25, 1.65, -0.1), k), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(-0.45, 1.5, -0.1)), aperture: 0.01 },
  });
  add('n16@to+-0.05', 'office', {
    update(c) {
      const g = cast.gary; const k = ease.out(ramp(c.t, at('n16@to') - 0.25, at('parrot') - 0.05));
      g.root.visible = true; g.root.position.set(lerp(2.7, 1.0, k), 0, 0.35); g.root.rotation.set(0, -PI / 2 + 0.25, 0);
      const step = Math.sin(c.t * 9) * (1 - k);
      g.pose({ body: [0, 0, step * 0.03], nodes: { arm_l: [step * 0.35, 0, 0.05], arm_r: [-step * 0.35, 0, -0.05] }, lids: 1, look: [-0.5, 0], head: [0, -0.2, 0] });
    },
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); const f = ease.out(clamp01(lt / (c.dur * 0.55))); aim(cam, mixV(V(-0.1, 1.55, 1.6), V(0.7, 1.5, 2.5), k), mixV(V(-0.4, 1.5, -0.1), world(cast.gary, 'head', [0, -0.1, 0]), f), { fov: 42, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.gary, 'head')), aperture: 0.006 },
  });
  add('parrot+-0.12', 'office', {
    update(c) {
      const m = talk('parrot', c.t, 1.0); const spread = ease.out(ramp(c.t, at('parrot') - 0.1, at('parrot') + 0.15));
      cast.parrot.pose({ head: [-0.1 + m * 0.15, 0.45, 0.1 * Math.sin(c.t * 9)], jaw: m, jawMax: 0.5, lids: 1, look: [0.6, 0], dilate: 0.7,
        nodes: { wing_l: [0, -0.2 * spread, 1.1 * spread + 0.15 * Math.sin(c.t * 18) * spread], wing_r: [0, 0.2 * spread, -1.1 * spread - 0.15 * Math.sin(c.t * 18) * spread] } });
    },
    camera(cam, lt, c) { const e = world(cast.parrot, 'head', [0, 0.04, 0.05]); const k = ease.out(lt / c.dur); aim(cam, e.clone().add(V(lerp(0.75, 0.55, k), lerp(0.02, 0.0, k), lerp(0.55, 0.42, k))), e.clone().add(V(0.05, -0.05, 0)), { fov: 38, t: c.t, roll: -0.05 }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.parrot, 'head', [0, 0.04, 0.05])), aperture: 0.03 },
  });
  add('parrot.end+0.12', 'office', {
    update(c) {
      const g = cast.gary; const k = ease.inOut(ramp(c.t, at('parrot.end') + 0.12, at('parrot.end') + 0.55));
      const sn = Math.max(0, Math.sin((c.t - at('parrot.end')) * 9)) * k;
      g.pose({ head: [0.5 * k + 0.06 * sn, 0.3 * k, 0.05 * k], nodes: { arm_l: [-1.25 * k, 0, -0.35 * k], fore_l: [-2.05 * k, -0.3 * k, 0] }, lids: 1 - 0.35 * k, look: [0.3 * k - 0.6 * (1 - k), -0.5 * k] });
    },
    camera(cam, lt, c) { const e = world(cast.gary, 'head'); aim(cam, e.clone().add(V(-0.95, -0.02, 0.85)), e.clone().add(V(0, -0.14, 0.05)), { fov: 36, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.gary, 'head')), aperture: 0.015 },
  });

  // ------------------------------------------------------------------ HOME: the window, 8 hours, LEAF
  const atWindow = (c, bark = false) => {
    const d = dog(); d.root.position.set(1.95, 0, -0.95); d.root.rotation.set(0, PI / 2, 0);
    cat().root.position.set(2.43, 0.925, -0.38); cat().root.rotation.set(0, -PI / 2 - 0.5, 0);
    cat().pose({ head: [0.05, -0.6, 0], lids: 0.45, tail: Math.sin(c.t * 1.2) * 0.1 });
    const m = bark ? talk('dog', c.t, 1.2, ['leaf']) : 0;
    const big = bark ? ramp(c.t, at('leaf@moved') + 0.5, at('leaf@moved') + 0.7) : 0;
    const ear = bark ? 0.15 + 0.3 * big * Math.sin(c.t * 30) : 0.05;
    d.pose({ head: [-0.15 - m * 0.12, 0.05 * Math.sin(c.t * 0.7), 0], jaw: m, jawMax: 0.55, lids: blink(c.t, 1), look: [0, 0.3], ears: [ear, ear], tail: Math.sin(c.t * (bark ? 14 : 3)) * (bark ? 0.8 : 0.2), dilate: bark ? 1.25 : 1 });
  };
  add('n16b', 'bedroom', { update: (c) => atWindow(c),
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(0.4, 1.0, 0.6), V(0.75, 0.95, 0.15), k), V(2.6, 1.15, -0.9), { fov: 40, t: c.t }); },
    dof: { focus: 1.7, aperture: 0.012 }, exposure: 1.05 });
  add('n16b@for+-0.1', 'bedroom', {
    update(c) { atWindow(c); W.hours.group.visible = true; W.hours.group.scale.setScalar(Math.max(0.001, ease.back(ramp(c.t, at('n16b@8') - 0.1, at('n16b@8') + 0.25)))); },
    camera(cam, lt, c) { aim(cam, mixV(V(1.25, 1.95, 1.05), V(1.38, 2.0, 0.85), ease.inOut(lt / c.dur)), V(2.55, 2.12, 0.5), { fov: 42, t: c.t }); },
    dof: { focus: 1.3, aperture: 0.015 } });
  add('n16b@reporting+-0.1', 'bedroom', { update: (c) => atWindow(c),
    camera(cam, lt, c) { aim(cam, mixV(V(1.65, 1.05, -0.7), V(1.8, 1.08, -0.78), ease.inOut(lt / c.dur)), V(4.5, 1.6, -1.0), { fov: 40, t: c.t }); },
    dof: { focus: 1.8, aperture: 0.008 } });
  add('leaf+-0.1', 'bedroom', { update: (c) => atWindow(c, true),
    camera(cam, lt, c) { const e = dogHead(); aim(cam, e.clone().add(V(0.3, 0.02, 0.6)), e, { fov: 34, t: c.t }); },
    dof: focusOn(dogHead, 0.04) });
  add('leaf@moved+0.55', 'bedroom', { update: (c) => atWindow(c, true),
    camera(cam, lt, c) { const e = dogHead(); const k = ease.expo(lt / 0.2); aim(cam, e.clone().add(V(0.26, 0.02, 0.4).multiplyScalar(lerp(1.3, 1.0, k))), e, { fov: 32, t: c.t, roll: 0.05 }); },
    dof: focusOn(dogHead, 0.05) });

  // ------------------------------------------------------------------ EVENING: dog food review, court
  const review = (c) => {
    const d = dog(); d.root.position.set(0.35, 0, 0.95); d.root.rotation.set(0, PI, 0);
    const sniff = ramp(c.t, at('n17') + 0.3, at('n17') + 1.0) * (1 - ramp(c.t, at('food') - 0.3, at('food')));
    const m = talk('dog', c.t, 1.1, ['food']);
    const push = ease.inOut(ramp(c.t, at('food.end') - 0.1, at('food.end') + 0.35));
    d.pose({ head: [0.6 * sniff - 0.05 - m * 0.08, 0.05 * Math.sin(c.t * 9) * sniff, 0], jaw: m, jawMax: 0.45, lids: c.t > at('food') - 0.2 ? 0.55 : 1, look: [0, c.t > at('food') ? 0.4 : -0.6] });
    W.bedD.bowl.position.set(0.35, 0, 1.45 + 0.35 * push); W.bedD.bowl.rotation.y = 0.3 * push;
  };
  add('n17', 'bedroom', { update: review,
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(1.4, 0.55, 2.9), V(1.15, 0.5, 2.6), k), V(0.55, 0.35, 1.3), { fov: 40, t: c.t }); },
    dof: { focus: 1.7, aperture: 0.012 } });
  add('food+-0.1', 'bedroom', { update: review,
    camera(cam, lt, c) { const e = dogHead(); aim(cam, e.clone().add(V(0.12, -0.1, -0.55)), e, { fov: 34, t: c.t }); },
    dof: focusOn(dogHead, 0.04) });
  add('food@this+-0.1', 'bedroom', { update: review,
    camera(cam, lt, c) { const e = dogHead(); aim(cam, e.clone().add(V(-0.25, -0.12, -0.7 - 0.12 * (lt / c.dur))), e.clone().add(V(0, -0.1, 0)), { fov: 36, t: c.t }); },
    dof: focusOn(dogHead, 0.03) });
  const dogStand = (c) => {
    const d = cast.dogCourt;
    const m = talk('dog', c.t, 1.1, ['court']);
    const proud = ramp(c.t, at('court@and') - 0.05, at('court@and') + 0.2);
    const nerv = c.t < at('court') ? 1 : 0;
    d.pose({ head: [-0.1 - m * 0.1 - 0.2 * proud, 0.25 * (1 - proud) + 0.08 * nerv * Math.sin(c.t * 7), 0], jaw: m, jawMax: 0.5, lids: proud > 0 ? 1 - 0.9 * proud : 1, look: [-0.5 * (1 - proud) + 0.3 * nerv * Math.sin(c.t * 3), 0.1], ears: nerv ? [-0.3, -0.3] : [0.1, 0.1], tail: Math.sin(c.t * (proud > 0 ? 12 : 4)) * (proud > 0 ? 0.8 : 0.2) });
  };
  add('n18', 'court', { update: dogStand,
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(-0.6, 2.0, 4.9), V(-0.3, 1.85, 4.3), k), V(1.4, 1.3, -2.0), { fov: 48, t: c.t }); },
    dof: { focus: 5.5, aperture: 0.004 } });
  add('n18@problem+-0.2', 'court', { update: dogStand,
    camera(cam, lt, c) { const e = world(cast.dogCourt, 'head', [0, 0.13, 0.12]); aim(cam, e.clone().add(V(-0.55, 0.02, 0.62 - 0.08 * (lt / c.dur))), e, { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.dogCourt, 'head', [0, 0.13, 0.12])), aperture: 0.03 } });
  add('judge+-0.55', 'court', { update: dogStand,
    camera(cam, lt, c) { const e = world(cast.judge, 'head', [0, 0.14, 0.05]); aim(cam, e.clone().add(V(0.3, -0.12, 1.1 - 0.1 * (lt / c.dur))), e.clone().add(V(0, -0.06, 0)), { fov: 36, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.judge, 'head')), aperture: 0.015 } });
  add('judge@birthday+-0.1', 'court', { update: dogStand,
    camera(cam, lt, c) { aim(cam, mixV(V(-0.05, 1.25, 0.75), V(-0.1, 1.15, 0.62), ease.inOut(lt / c.dur)), V(-0.2, 0.82, 0.2), { fov: 36, t: c.t }); },
    dof: { focus: 0.6, aperture: 0.03 } });
  add('court+-0.1', 'court', { update: dogStand,
    camera(cam, lt, c) { const e = world(cast.dogCourt, 'head', [0, 0.13, 0.12]); aim(cam, e.clone().add(V(-0.45, -0.05, 0.42)), e, { fov: 32, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.dogCourt, 'head', [0, 0.13, 0.12])), aperture: 0.04 } });
  add('court@and+-0.1', 'court', { update: dogStand,
    camera(cam, lt, c) { const e = world(cast.dogCourt, 'head', [0, 0.13, 0.12]); aim(cam, e.clone().add(V(-0.7, -0.25, 0.55)), e.clone().add(V(0, 0.05, 0)), { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.dogCourt, 'head', [0, 0.13, 0.12])), aperture: 0.03 } });

  // ------------------------------------------------------------------ NIGHT: the mosquito
  const night = (c) => {
    cast.ownerBedN.pose({ head: [0, 0.35, 0], lids: c.t > at('mosq.end') + 0.1 ? 1 : 0, dilate: 1.4 });
    const mq = cast.mosqN; mq.root.visible = true;
    const ear = world(cast.ownerBedN, 'head', [0.106, 0.125, -0.017]);
    const k = ease.inOut(ramp(c.t, at('n18b'), at('n18b@so') + 1.2));
    const p = mixV(V(-0.9, 1.2, -2.2), ear.clone().add(V(0.02, 0.1, 0.07)), k);
    p.add(V(Math.sin(c.t * 7) * 0.03 * (1.2 - k), Math.sin(c.t * 9.3) * 0.02, Math.cos(c.t * 6.1) * 0.03 * (1.2 - k)));
    mq.root.position.copy(p); mq.root.rotation.set(0, 1.2 + 0.2 * Math.sin(c.t * 2), 0);
    const f = Math.sin(c.t * 110); const m = talk('mosquito', c.t, 1.2);
    mq.pose({ head: [-m * 0.25, 0, 0], lids: 1, look: [0.2, 0], nodes: { wing_l: [0, 0, 0.8 * f], wing_r: [0, 0, -0.8 * f] } });
  };
  add('n18b', 'bedroomNight', { update: night,
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(1.2, 1.6, 0.9), V(0.9, 1.45, 0.4), k), V(-0.4, 0.8, -2.3), { fov: 42, t: c.t }); },
    dof: { focus: 2.6, aperture: 0.006 } });
  add('n18b@so+-0.1', 'bedroomNight', { update: night, exposure: 1.7,
    camera(cam, lt, c) { const m = cast.mosqN.root.position; cam.near = 0.002; const k = ease.inOut(clamp01(lt / (c.dur * 0.7))); aim(cam, m.clone().add(mixV(V(0.22, 0.2, 0.18), V(0.045, 0.04, 0.03), k)), m.clone().add(V(0, 0.003, 0)), { fov: 42, t: c.t, amp: 0.05 }); },
    dof: { focus: (c) => dist(c.camera.position, cast.mosqN.root.position), aperture: 0.03, maxblur: 0.014 } });
  add('mosq+-0.1', 'bedroomNight', { update: night, exposure: 1.8,
    camera(cam, lt, c) { const m = world(cast.mosqN, 'head'); cam.near = 0.002; aim(cam, m.clone().add(V(0.012, 0.002, 0.011)), m, { fov: 36, t: c.t, amp: 0.02 }); },
    dof: { focus: (c) => dist(c.camera.position, world(cast.mosqN, 'head')), aperture: 0.05, maxblur: 0.016 } });

  // ------------------------------------------------------------------ FINALE
  const catN = () => cast.catN;
  add('n19', 'bedroomNight', {
    update(c) { catN().pose({ head: [0.05, 0.15, 0.03], lids: blink(c.t, 4, 4.4) * 0.8, look: [0.1, 0], tail: Math.sin(c.t * 1.2) * 0.08 }); },
    camera(cam, lt, c) { const k = ease.inOut(lt / c.dur); aim(cam, mixV(V(0.7, 1.35, 0.6), V(1.2, 1.25, 0.1), k), V(2.43, 1.15, -0.9), { fov: 36, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(2.43, 1.2, -0.9)), aperture: 0.012 } });
  add('n19@not+-0.1', 'bedroom', {   // flashback: blamed for the vase
    update(c) { snitchDog({ t: at('snitch') + 0.5 + (c.t - at('n19@not')) * 0.7 }, 1.15); cat().pose({ head: [0.12, 0.95, 0.1], lids: 0.5, look: [0.75, -0.3], tail: 0.1 }); },
    camera(cam, lt, c) { aim(cam, mixV(V(1.0, 1.05, 0.4), V(1.1, 1.05, 0.25), ease.inOut(lt / c.dur)), V(2.1, 0.85, -0.6), { fov: 40, t: c.t }); },
    dof: { focus: 1.4, aperture: 0.01 }, grade: memory });
  add('n19@not#2+-0.1', 'farm', {   // flashback: the strike
    update(c) { strike({ t: at('cows') + 0.3 + (c.t - at('n19@not#2')) * 0.8, S: c.S }, true); },
    camera(cam, lt, c) { const H = c.S.H; aim(cam, mixV(V(6.0, H(6, -14) + 1.3, -13.2), V(6.2, H(6, -14) + 1.2, -13.9), ease.inOut(lt / c.dur)), V(6.3, H(6, -21) + 1.5, -21.4), { fov: 44, t: c.t }); },
    dof: { focus: 6.5, aperture: 0.006 }, grade: memory });
  add('n19@not#3+-0.1', 'city', {   // flashback: the whole world talking
    update(c) { const ft = { t: at('pigeon@spot') + 0.4 + (c.t - at('n19@not#3')) * 0.8 }; W.pigeons.forEach((p, i) => { p.root.position.set((i - 2) * 0.2, 15.0, -0.1 + (i % 2) * 0.05); p.root.rotation.y = PI + (i - 2) * 0.25; }); pigeonTalk(ft); },
    camera(cam, lt, c) { aim(cam, mixV(V(0.4, 15.3, -2.0), V(0.2, 15.25, -1.7), ease.inOut(lt / c.dur)), V(0.0, 15.12, -0.05), { fov: 40, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(0, 15.13, -0.08)), aperture: 0.008 }, grade: memory });
  const catAsked = (c) => {
    const turn = ease.inOut(ramp(c.t, at('n20@why'), at('n20@word') + 0.2));
    catN().pose({ head: [0.05, 0.25 + 0.45 * turn, 0.04 - 0.05 * turn], lids: blink(c.t, 4, 4.4) * (1 - 0.2 * turn), look: [0.15 + 0.4 * turn, 0], tail: Math.sin(c.t * 2.1) * 0.12 });
  };
  add('n20', 'bedroomNight', { update: catAsked,
    camera(cam, lt, c) { aim(cam, mixV(V(0.6, 1.35, 0.9), V(0.95, 1.3, 0.55), ease.inOut(lt / c.dur)), V(2.43, 1.15, -0.88), { fov: 36, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(2.43, 1.22, -0.9)), aperture: 0.015 } });
  add('n20@cat+-0.08', 'bedroomNight', { update: catAsked,
    camera(cam, lt, c) { aim(cam, mixV(V(1.55, 1.18, -0.2), V(1.78, 1.17, -0.42), ease.inOut(lt / c.dur)), V(2.43, 1.17, -0.88), { fov: 34, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, V(2.43, 1.22, -0.9)), aperture: 0.03 } });
  const catAnswers = (c) => {
    const m = talk('cat', c.t, 1.0);
    const away = ease.inOut(ramp(c.t, at('cat.end') - 0.05, at('cat.end') + 0.6));
    const bored = ramp(c.t, at('cat@just') - 0.2, at('cat@just') + 0.2);
    catN().pose({ head: [0.0 + m * 0.05, 0.7 - 1.25 * away, 0.0 + 0.1 * away], jaw: m, jawMax: 0.9, lids: lerp(0.55, 0.4, bored) * (1 - 0.6 * away), look: [0.15 - 0.6 * away, 0.05], tail: Math.sin(c.t * 2.4) * 0.15 + away * 0.3 });
  };
  add('cat+-0.1', 'bedroomNight', { update: catAnswers,
    camera(cam, lt, c) { const e = catHead('N'); aim(cam, e.clone().add(V(-0.6 + 0.05 * ease.out(lt / c.dur), -0.03, 0.3)), e.clone().add(V(0, -0.025, 0)), { fov: 32, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, catHead('N')), aperture: 0.04 } });
  add('cat@just+-0.12', 'bedroomNight', { update: catAnswers,
    camera(cam, lt, c) { const e = catHead('N'); const k = ease.out(lt / Math.min(c.dur, 1.6)); aim(cam, e.clone().add(V(-0.5 + 0.06 * k, 0.0, 0.1 + 0.02 * k)), e.clone().add(V(0, -0.02, 0)), { fov: 30, t: c.t }); },
    dof: { focus: (c) => dist(c.camera.position, catHead('N')), aperture: 0.045 } });
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
    await Promise.all([loadCast(['dog', 'cat', 'cow_head', 'cow', 'pigeon', 'macaw', 'gary', 'owner', 'bald', 'hand',
      'chicken', 'gull', 'crow', 'bee', 'dolphin', 'mosquito', 'sci', 'judge']), loadFont()]);
    const probe = makeCharacter('cow');
    let m = null; probe.root.traverse((o) => { if (o.isMesh && !m) m = o; });
    cast.cowTemplate = { geometry: m.geometry, material: m.material };
    const S = shotList();
    episode.shots = S.map((s, i) => ({ ...s, t0: i === 0 ? 0 : at(s.start), t1: i + 1 < S.length ? at(S[i + 1].start) : TL.duration + 1 }));
    for (let i = 1; i < episode.shots.length; i++) if (episode.shots[i].t0 <= episode.shots[i - 1].t0) console.error('shot order problem at', i, episode.shots[i].start);
  },
};
export default episode;
