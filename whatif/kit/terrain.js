// Height-field terrain with vertex colours, plus an animated ocean surface.
import * as THREE from 'three';

// heightFn(x, z) -> y ; colorFn(x, z, y) -> THREE.Color
export function createTerrain({ size = 800, seg = 160, heightFn = () => 0, colorFn = () => new THREE.Color('#777'), roughness = 0.9, metalness = 0, flat = true, emissiveFn = null } = {}) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const emi = emissiveFn ? new Float32Array(p.count * 3) : null;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = heightFn(x, z);
    p.setY(i, y);
    const c = colorFn(x, z, y);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  let geo = g;
  if (flat) { geo = g.toNonIndexed(); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness, flatShading: flat });
  if (emissiveFn) {
    // emissive via a second pass: copy colour attr into a custom attribute and use onBeforeCompile
    const pp = geo.attributes.position;
    const e = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) { const c = emissiveFn(pp.getX(i), pp.getZ(i), pp.getY(i)); e.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('emissiveColor', new THREE.BufferAttribute(e, 3));
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 emissiveColor; varying vec3 vEmi;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmi = emissiveColor;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEmi;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmi;');
    };
  }
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

// Animated ocean: vertex waves on a grid, recomputed in the shader from uTime
export function createOcean({ size = 1200, seg = 180, color = '#0d3a5c', deep = '#041a2c', amp = 0.8, roughness = 0.15 } = {}) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.2, flatShading: true });
  const uni = { uTime: { value: 0 }, uAmp: { value: amp } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uni.uTime; sh.uniforms.uAmp = uni.uAmp;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uAmp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = sin(position.x * 0.08 + uTime * 1.1) * 0.6 + sin(position.z * 0.11 + uTime * 0.8) * 0.5 + sin((position.x + position.z) * 0.21 + uTime * 1.7) * 0.25;
        transformed.y += w * uAmp;`);
  };
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  m.userData.update = (t) => (uni.uTime.value = t);
  return m;
}
