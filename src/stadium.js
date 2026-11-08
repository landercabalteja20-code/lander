// Hiraya Dome: LED stage, live IMAG screens, 100k fans with synchronized lightsticks,
// moving beams, parol lanterns, crystal decor, holographic butterflies, confetti, fireworks.
import * as THREE from 'three';
import { mat, canvasTexture, dotTexture, starTexture, heartTexture, starGeometry, seeded, glitterTexture } from './materials.js';
import { MEMBERS, MEMBER_BY_ID } from './members.js';
import { BEAT, LIGHTSTICKS, FIREWORKS, CONFETTI, sectionAt } from './timeline.js';
import { drawPortrait, hexA, star as star2d } from './faces.js';
import { LYRIC_LINES } from './song.js';

const TAU = Math.PI * 2;
const MODE_ID = { pink: 0, twinkle: 1, rainbow: 2, member: 3, wave: 4, strobe: 5, heart: 6 };

export class Stadium {
  constructor({ crowd = 100000, fxClock }) {
    this.group = new THREE.Group();
    this.fxClock = fxClock;
    this.crowdCount = crowd;
    this.r = seeded(5);
    this.uniforms = { uTime: { value: 0 }, uBeat: { value: 0 }, uPulse: { value: 0 } };
    this.buildArena();
    this.buildStage();
    this.buildScreens();
    this.buildCrowd();
    this.buildLights();
    this.buildDecor();
    this.buildFX();
  }

  buildArena() {
    const g = this.group;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(140, 64), new THREE.MeshStandardMaterial({ color: '#1a0e2c', roughness: 0.35, metalness: 0.4 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.92; g.add(floor);
    // seating bowl (stepped lathe)
    const pts = [];
    let r = 34, y = -0.9;
    pts.push(new THREE.Vector2(r, y));
    for (let i = 0; i < 26; i++) { y += 1.25; pts.push(new THREE.Vector2(r, y)); r += 2.4; pts.push(new THREE.Vector2(r, y)); }
    pts.push(new THREE.Vector2(r + 4, y + 6));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), new THREE.MeshStandardMaterial({ color: '#241238', roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }));
    g.add(bowl);
    this.bowlTop = { r, y };
    // LED ribbon boards
    const ribbonTex = canvasTexture(2048, 64, (c, w, h) => {
      c.fillStyle = '#12061e'; c.fillRect(0, 0, w, h);
      c.font = '700 40px "Bagel Fat One", "Arial Black", sans-serif'; c.textBaseline = 'middle';
      const items = ['HIRAYA', '✦', 'KILIG WORLDWIDE', '✦', 'MABUHAY', '✦', 'P-POP FOREVER', '✦'];
      let x = 20; let k = 0;
      while (x < w) { const s = items[k % items.length]; c.fillStyle = ['#ff8fbf', '#ffd25a', '#7fd4ff', '#a66bff'][k % 4]; c.fillText(s, x, h / 2 + 2); x += c.measureText(s).width + 36; k++; }
    }, { repeat: [6, 1] });
    this.ribbonTex = ribbonTex;
    for (const [rad, yy] of [[34.2, 0.6], [53, 9.6], [72, 18.4]]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 1.0, 96, 1, true), new THREE.MeshBasicMaterial({ map: ribbonTex, side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
      ring.position.y = yy; g.add(ring);
    }
    // roof ring truss with lights
    const roof = new THREE.Mesh(new THREE.TorusGeometry(r - 6, 0.8, 8, 96), mat('chrome', '#3a2a55'));
    roof.rotation.x = Math.PI / 2; roof.position.y = y + 14; g.add(roof);
    const bulbGeo = new THREE.SphereGeometry(0.6, 8, 6);
    const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 3.2), toneMapped: false }), 120);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 120; i++) { const a = (i / 120) * TAU; m4.makeTranslation(Math.cos(a) * (r - 6), y + 13.2, Math.sin(a) * (r - 6)); bulbs.setMatrixAt(i, m4); }
    g.add(bulbs);
    // stars sky
    const sp = []; const rr = seeded(2);
    for (let i = 0; i < 1800; i++) { const a = rr() * TAU, el = 0.15 + rr() * 1.3, d = 420; sp.push(Math.cos(a) * Math.cos(el) * d, Math.sin(el) * d, Math.sin(a) * Math.cos(el) * d); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, map: dotTexture(), transparent: true, depthWrite: false, color: '#ffe8ff', sizeAttenuation: true, fog: false })));
  }

  buildStage() {
    const g = this.group;
    const U = this.uniforms;
    const top = new THREE.ShaderMaterial({
      uniforms: { ...U, uDim: { value: 1 }, uColA: { value: new THREE.Color('#b8287f') }, uColB: { value: new THREE.Color('#240a4d') }, uColC: { value: new THREE.Color('#ffffff') } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime,uBeat,uPulse,uDim; uniform vec3 uColA,uColB,uColC; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        void main(){
          vec2 p=vW.xz; float r=length(p); float a=atan(p.y,p.x);
          vec3 col=mix(uColA*0.85,uColB,smoothstep(0.,8.,r));
          float ring=smoothstep(0.43,0.5,abs(fract(r*0.55-uBeat*0.5)-0.5));
          col+=mix(uColA,uColC,0.5)*ring*(0.25+0.9*uPulse);
          float rays=pow(abs(cos(a*4.)),60.)*smoothstep(1.2,7.5,r);
          col+=vec3(1.,.82,.45)*rays*.35;
          vec2 gq=floor(p*36.); float hh=h(gq); float tw=step(.982,hh)*(.5+.5*sin(uTime*5.+hh*80.));
          col+=vec3(1.)*tw*1.4;
          float edge=smoothstep(7.2,7.45,r); col=mix(col,vec3(1.,.6,.9)*1.3,edge);
          col*=(0.75+0.25*sin(r*1.5-uTime*.6))*uDim;
          gl_FragColor=vec4(col,1.);
          #include <colorspace_fragment>
        }`,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(7.5, 96), top);
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.0; g.add(disc);
    this.stageTop = top;
    const sideTex = canvasTexture(1024, 32, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0);
      ['#ff8fbf', '#a66bff', '#7fd4ff', '#ffd25a', '#ff3b55', '#ff8fbf'].forEach((col, i, a) => gr.addColorStop(i / (a.length - 1), col));
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, 0, 2, h); }
    }, { repeat: [4, 1] });
    this.stageSideTex = sideTex;
    const side = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.9, 0.9, 96, 1, true), new THREE.MeshBasicMaterial({ map: sideTex, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
    side.position.y = -0.45; g.add(side);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(7.52, 0.08, 10, 128), mat('chrome', '#f1e6ff'));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.02; g.add(rim);
    // runway
    const run = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 10), new THREE.MeshPhysicalMaterial({ color: '#2a1244', roughness: 0.15, clearcoat: 1, metalness: 0.3 }));
    run.position.set(0, -0.45, 11.5); g.add(run);
    for (const s of [-1, 1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 10), mat('emissive', '#ff8fbf', { intensity: 3 })); strip.position.set(s * 1.5, 0.0, 11.5); g.add(strip); }
    // lifts
    this.lifts = [];
    for (const [x, z] of [[0, 1.0], [-1.45, 0.35], [1.45, 0.35], [-2.8, -0.35], [2.8, -0.35]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 48), mat('emissive', '#ffffff', { intensity: 2.5, opacity: 0.0, side: THREE.DoubleSide, unique: true }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.015, z); g.add(ring); this.lifts.push(ring);
    }
  }

  buildScreens() {
    const g = this.group;
    // live IMAG feed
    this.imagRT = new THREE.WebGLRenderTarget(1024, 444, { samples: 2, colorSpace: THREE.SRGBColorSpace });
    this.imagCam = new THREE.PerspectiveCamera(22, 1024 / 444, 0.1, 400);
    this.overlay = document.createElement('canvas'); this.overlay.width = 1024; this.overlay.height = 444;
    this.overlayTex = new THREE.CanvasTexture(this.overlay); this.overlayTex.colorSpace = THREE.SRGBColorSpace;
    const screenMat = new THREE.ShaderMaterial({
      uniforms: { uFeed: { value: this.imagRT.texture }, uOver: { value: this.overlayTex }, uTime: this.uniforms.uTime, uBright: { value: 1.25 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform sampler2D uFeed,uOver; uniform float uTime,uBright; varying vec2 vUv;
        void main(){
          vec3 c=texture2D(uFeed,vUv).rgb;
          vec4 o=texture2D(uOver,vUv);
          c=mix(c,o.rgb,o.a);
          vec2 px=fract(vUv*vec2(420.,182.));
          float grid=smoothstep(0.,.15,px.x)*smoothstep(0.,.15,px.y)*smoothstep(1.,.85,px.x)*smoothstep(1.,.85,px.y);
          c*=0.72+0.28*grid; c*=uBright;
          gl_FragColor=vec4(c,1.);
        }`,
      toneMapped: false,
    });
    const main = new THREE.Mesh(new THREE.PlaneGeometry(30, 13), screenMat);
    main.position.set(0, 7.6, -12.5); g.add(main);
    this.mainScreen = main;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(31, 14, 0.6), mat('chrome', '#d9c8ff'));
    frame.position.set(0, 7.6, -12.85); g.add(frame);
    // side graphic screens
    this.gfx = document.createElement('canvas'); this.gfx.width = 768; this.gfx.height = 448;
    this.gfxTex = new THREE.CanvasTexture(this.gfx); this.gfxTex.colorSpace = THREE.SRGBColorSpace;
    this.sideScreens = [];
    for (const s of [-1, 1]) {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), new THREE.MeshBasicMaterial({ map: this.gfxTex, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) }));
      scr.position.set(s * 22, 7.0, -7); scr.rotation.y = -s * 0.75; g.add(scr);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(12.6, 7.6, 0.4), mat('chrome', '#d9c8ff'));
      fr.position.copy(scr.position).add(new THREE.Vector3(s * 0.15, 0, -0.25)); fr.rotation.y = scr.rotation.y; g.add(fr);
      this.sideScreens.push(scr);
    }
  }

  buildCrowd() {
    const N = this.crowdCount;
    const r = seeded(77);
    const off = new Float32Array(N * 3), ph = new Float32Array(N), tint = new Float32Array(N * 3), ang = new Float32Array(N);
    const palette = ['#2b1b4a', '#3a1f5c', '#1f2a55', '#4a1d4a', '#2d2040', '#35264f'].map((c) => new THREE.Color(c));
    let i = 0;
    const pitN = Math.floor(N * 0.22);
    while (i < pitN) {
      const a = (r() - 0.5) * 2.4 + Math.PI / 2; // front half
      const rad = 9.6 + Math.sqrt(r()) * 22;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (Math.abs(x) < 2.2 && z > 6 && z < 17) continue; // runway
      off[i * 3] = x; off[i * 3 + 1] = -0.9; off[i * 3 + 2] = z;
      ang[i] = Math.atan2(z, x); i++;
    }
    while (i < N) {
      const a = r() * TAU;
      // leave the area behind the stage empty
      const rel = Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2));
      if (Math.abs(rel) < 0.55) continue;
      const tier = Math.floor(r() * 26);
      const rad = 34 + tier * 2.4 + 0.6 + r() * 1.4;
      off[i * 3] = Math.cos(a) * rad; off[i * 3 + 1] = -0.9 + (tier + 1) * 1.25; off[i * 3 + 2] = Math.sin(a) * rad;
      ang[i] = a; i++;
    }
    for (let k = 0; k < N; k++) { ph[k] = r(); const c = palette[Math.floor(r() * palette.length)]; tint[k * 3] = c.r; tint[k * 3 + 1] = c.g; tint[k * 3 + 2] = c.b; }
    // fan body: torso + head + raised arm
    const body = new THREE.BoxGeometry(0.5, 1.1, 0.32); body.translate(0, 0.55, 0);
    const head = new THREE.BoxGeometry(0.3, 0.32, 0.3); head.translate(0, 1.3, 0);
    const arm = new THREE.BoxGeometry(0.12, 0.6, 0.12); arm.translate(0.22, 1.5, 0.05);
    const merged = mergeBoxes([body, head, arm]);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = merged.index; ig.setAttribute('position', merged.attributes.position);
    ig.setAttribute('offset', new THREE.InstancedBufferAttribute(off, 3));
    ig.setAttribute('phase', new THREE.InstancedBufferAttribute(ph, 1));
    ig.setAttribute('tint', new THREE.InstancedBufferAttribute(tint, 3));
    ig.setAttribute('ang', new THREE.InstancedBufferAttribute(ang, 1));
    ig.instanceCount = N;
    const U = this.uniforms;
    this.crowdU = { uEnergy: { value: 0.5 }, uGlow: { value: new THREE.Color('#ff7ac8') } };
    const cm = new THREE.ShaderMaterial({
      uniforms: { ...U, ...this.crowdU, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
      vertexShader: `attribute vec3 offset; attribute float phase; attribute vec3 tint; attribute float ang;
        uniform float uTime,uBeat,uEnergy; varying vec3 vC; varying float vY;
        void main(){
          vec3 p=position;
          float face=ang+3.14159265;
          float cs=cos(-face+1.5708), sn=sin(-face+1.5708);
          p.xz=mat2(cs,-sn,sn,cs)*p.xz;
          float b=uBeat+phase*0.35;
          float hop=pow(max(0.,sin(b*3.14159265)),2.)*uEnergy*0.35*step(0.35,phase);
          p.y+=hop;
          vec3 w=p+offset; vY=position.y; vC=tint;
          gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);
        }`,
      fragmentShader: `uniform vec3 uGlow; varying vec3 vC; varying float vY;
        void main(){ vec3 c=vC*(0.55+0.35*smoothstep(0.,1.5,vY)); c+=uGlow*0.06*smoothstep(0.9,1.6,vY); gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
        }`,
    });
    const crowd = new THREE.Mesh(ig, cm); crowd.frustumCulled = false; crowd.layers.set(1);
    this.group.add(crowd); this.crowd = crowd;

    // lightsticks
    const lg = new THREE.BufferGeometry();
    const lp = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) { lp[k * 3] = off[k * 3]; lp[k * 3 + 1] = off[k * 3 + 1] + 2.05; lp[k * 3 + 2] = off[k * 3 + 2]; }
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lg.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    lg.setAttribute('ang', new THREE.BufferAttribute(ang, 1));
    this.stickU = { uMode: { value: 0 }, uPrev: { value: 0 }, uMix: { value: 1 }, uCol: { value: new THREE.Color('#ff8fbf') }, uPrevCol: { value: new THREE.Color('#ff8fbf') }, uScale: { value: 300 }, uMembers: { value: MEMBERS.map((m) => new THREE.Color(m.color)) } };
    const sm = new THREE.ShaderMaterial({
      uniforms: { ...U, ...this.stickU, uTex: { value: dotTexture() } },
      vertexShader: `attribute float phase; attribute float ang; uniform float uTime,uBeat,uScale; uniform int uMode,uPrev; uniform float uMix; uniform vec3 uCol,uPrevCol; uniform vec3 uMembers[5];
        varying vec3 vC; varying float vA;
        vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
        vec3 prog(int m, vec3 col){
          float b=uBeat; float tw=0.5+0.5*sin(uTime*7.+phase*90.);
          if(m==0) return vec3(1.,.45,.75)*(0.85+0.3*tw);
          if(m==1) return mix(vec3(1.,.55,.85),vec3(1.),step(.92,tw))*(0.35+0.9*pow(tw,4.));
          if(m==2) return hue(fract(ang/6.2831+uTime*0.08))*1.2+0.15;
          if(m==3){ float w=0.5+0.5*sin(ang*3.-b*1.5707); return col*(0.55+0.8*w); }
          if(m==4){ float w=sin(ang*2.+uTime*2.2); return mix(vec3(1.,.42,.78),vec3(.62,.45,1.),step(0.,w))*(0.7+0.6*smoothstep(.7,1.,abs(w))); }
          if(m==5){ int s=int(mod(floor((ang+3.14159)/6.2831*10.),5.)); vec3 c=uMembers[0]; if(s==1)c=uMembers[1]; if(s==2)c=uMembers[2]; if(s==3)c=uMembers[3]; if(s==4)c=uMembers[4]; float f=exp(-fract(b)*5.); return c*(0.3+1.6*f); }
          return vec3(1.,.3,.55)*(0.8+0.5*pow(0.5+0.5*sin(b*3.14159),3.))+vec3(step(.97,tw));
        }
        void main(){
          vec3 p=position;
          float sway=sin(uBeat*3.14159265*0.5+phase*0.8);
          p.x+=sway*0.25*cos(ang+1.57); p.z+=sway*0.25*sin(ang+1.57);
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(uScale*0.55/-mv.z,1.2,24.);
          vC=mix(prog(uPrev,uPrevCol),prog(uMode,uCol),uMix); vA=1.;
        }`,
      fragmentShader: `uniform sampler2D uTex; varying vec3 vC; void main(){ float a=texture2D(uTex,gl_PointCoord).a; gl_FragColor=vec4(vC*a*1.6,a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const sticks = new THREE.Points(lg, sm); sticks.frustumCulled = false; sticks.layers.set(1);
    this.group.add(sticks); this.sticks = sticks;
  }

  buildLights() {
    const g = this.group;
    this.hemi = new THREE.HemisphereLight('#c8b0ff', '#3a1050', 0.55); g.add(this.hemi);
    const key = new THREE.SpotLight('#ffe6f2', 2.2, 0, 0.42, 0.55, 0); this.key = key;
    key.position.set(0, 16, 24); key.target.position.set(0, 1.6, 0); g.add(key, key.target);
    const key2 = new THREE.DirectionalLight('#ffd9ec', 0.5); this.key2 = key2; key2.position.set(-6, 10, 14); g.add(key2);
    this.rims = [];
    for (const [x, col] of [[-7, '#ffc96b'], [7, '#b07bff']]) {
      const s = new THREE.SpotLight(col, 3.2, 0, 0.5, 0.6, 0);
      s.position.set(x, 13, -11); s.target.position.set(x * 0.15, 1.5, 1); g.add(s, s.target); this.rims.push(s);
    }
    this.washes = [];
    for (const col of ['#ff4fb0', '#4fb6ff', '#9b5cff']) {
      const s = new THREE.SpotLight(col, 2.4, 0, 0.32, 0.7, 0);
      s.position.set(0, 18, 4); g.add(s, s.target); this.washes.push(s);
    }
    // truss + beams
    const truss = new THREE.Mesh(new THREE.TorusGeometry(11, 0.25, 6, 64), mat('chrome', '#4a3a66'));
    truss.rotation.x = Math.PI / 2; truss.position.y = 17; g.add(truss);
    const beamGeo = new THREE.CylinderGeometry(0.12, 2.8, 34, 28, 1, true); beamGeo.translate(0, -17, 0);
    this.beams = [];
    const mkBeam = (pos, col) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uCol: { value: new THREE.Color(col) }, uI: { value: 1 } },
        vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY=-position.y/34.; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 uCol; uniform float uI; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(vN,vV)),1.6); float a=f*f*pow(1.-vY,1.6)*0.16*uI; gl_FragColor=vec4(uCol*a,a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      });
      const b = new THREE.Mesh(beamGeo, m);
      const holder = new THREE.Group(); holder.position.copy(pos); holder.add(b); g.add(holder);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), mat('emissive', col, { intensity: 4 }));
      holder.add(head);
      this.beams.push({ holder, m, col: new THREE.Color(col), pos: pos.clone() });
    };
    const cols = ['#ff7ac8', '#a66bff', '#7fd4ff', '#ffd25a', '#ffffff', '#ff3b55'];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; mkBeam(new THREE.Vector3(Math.cos(a) * 11, 17, Math.sin(a) * 11), cols[i % cols.length]); }
    for (let i = 0; i < 6; i++) mkBeam(new THREE.Vector3(-12.5 + i * 5, 14.6, -12.4), cols[(i + 2) % cols.length]);
    // floor pillars of light at the stage edge
    this.pillars = [];
    const pg = new THREE.CylinderGeometry(0.18, 0.45, 30, 16, 1, true); pg.translate(0, 15, 0);
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * (0.05 + 0.9 * (i / 9));
      const m = new THREE.ShaderMaterial({
        uniforms: { uCol: { value: new THREE.Color(cols[i % cols.length]) }, uI: { value: 0 } },
        vertexShader: `varying float vY; void main(){ vY=position.y/30.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform vec3 uCol; uniform float uI; varying float vY; void main(){ float a=pow(1.-vY,2.5)*0.28*uI; gl_FragColor=vec4(uCol*a,a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      });
      const p = new THREE.Mesh(pg, m); p.position.set(Math.cos(a) * 7.9, -0.6, Math.sin(a) * 7.9 - 0.5); g.add(p); this.pillars.push(p);
    }
  }

  buildDecor() {
    const g = this.group;
    // crystal clusters
    const cg = new THREE.OctahedronGeometry(1, 0);
    const holo = mat('holo', '#e8d4ff');
    const core = mat('emissive', '#ff9ad8', { intensity: 1.5 });
    const r = seeded(9);
    this.crystals = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const c = new THREE.Mesh(cg, holo);
        const h = 1.2 + r() * 3.2;
        c.scale.set(0.45 + r() * 0.3, h, 0.45 + r() * 0.3);
        c.position.set(s * (8.6 + r() * 3.5), h * 0.6 - 0.9, -6 + r() * 7);
        c.rotation.set((r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.6);
        g.add(c);
        const k = new THREE.Mesh(cg, core); k.scale.setScalar(0.35); c.add(k);
        this.crystals.push(c);
      }
    }
    // Philippine sun emblem above the screen
    const sun = new THREE.Group();
    sun.add(new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), mat('emissive', '#ffd35a', { intensity: 2.6 })));
    const ray = new THREE.Shape(); ray.moveTo(-0.35, 0); ray.lineTo(0, 2.4); ray.lineTo(0.35, 0); ray.closePath();
    const rg = new THREE.ShapeGeometry(ray);
    for (let i = 0; i < 8; i++) {
      for (const k of [-1, 0, 1]) {
        const m = new THREE.Mesh(rg, mat('emissive', '#ffd35a', { intensity: k === 0 ? 2.6 : 1.8 }));
        m.rotation.z = (i / 8) * TAU + k * 0.17; m.position.set(0, 0, -0.01);
        const sc = k === 0 ? 1.0 : 0.7; m.scale.set(sc, sc, 1);
        m.translateY(1.7);
        sun.add(m);
      }
    }
    sun.position.set(0, 16.2, -12.2); sun.scale.setScalar(1.25); g.add(sun); this.sun = sun;
    // parol lanterns
    this.parols = [];
    const pgeo = starGeometry(1.1, 0.35, 5, 0.45);
    const tailGeo = new THREE.PlaneGeometry(0.18, 2.2); tailGeo.translate(0, -1.1, 0);
    MEMBERS.concat(MEMBERS).forEach((m, i) => {
      const a = (i / 10) * TAU + 0.3;
      const p = new THREE.Group();
      const body = new THREE.Mesh(pgeo, mat('emissive', m.color, { intensity: 2.2 })); p.add(body);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 6, 40), mat('emissive', '#ffffff', { intensity: 2 })); p.add(ring);
      for (const s of [-1, 1]) { const t = new THREE.Mesh(tailGeo, mat('emissive', m.glow, { intensity: 1.6, side: THREE.DoubleSide })); t.position.set(s * 0.3, -0.8, 0); t.rotation.z = s * 0.15; p.add(t); }
      p.position.set(Math.cos(a) * 20, 21 + (i % 3), Math.sin(a) * 20);
      p.lookAt(0, p.position.y, 0);
      g.add(p); this.parols.push(p);
    });
  }

  buildFX() {
    const g = this.group;
    // confetti
    const N = 2600;
    const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.17), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, metalness: 0.75, roughness: 0.3, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.18 }), N);
    const r = seeded(31);
    const cols = ['#ff8fbf', '#ffd25a', '#7fd4ff', '#a66bff', '#ff3b55', '#ffffff', '#f5d0ff'].map((c) => new THREE.Color(c));
    this.confData = [];
    for (let i = 0; i < N; i++) {
      conf.setColorAt(i, cols[i % cols.length]);
      const cannon = i % 4;
      const cx = [-6, -2.5, 2.5, 6][cannon];
      this.confData.push({ x: cx, z: 3 + r() * 2, vx: (r() - 0.5) * 9 + cx * 0.4, vy: 10 + r() * 9, vz: 2 + r() * 9, w: r() * 6 + 2, ph: r() * TAU, ax: r(), az: r() });
    }
    conf.frustumCulled = false; conf.count = 0;
    g.add(conf); this.confetti = conf;
    // fireworks pool
    this.fw = [];
    const P = 260;
    const dir = new Float32Array(P * 3), rnd = new Float32Array(P);
    for (let i = 0; i < P; i++) {
      const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u);
      const sp = 0.75 + r() * 0.25;
      dir[i * 3] = s * Math.cos(a) * sp; dir[i * 3 + 1] = u * sp; dir[i * 3 + 2] = s * Math.sin(a) * sp; rnd[i] = r();
    }
    for (let k = 0; k < 10; k++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P * 3), 3));
      geo.setAttribute('dir', new THREE.BufferAttribute(dir, 3));
      geo.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
      const u = { uAge: { value: -1 }, uCenter: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color() }, uCol2: { value: new THREE.Color() }, uR: { value: 18 }, uTex: { value: starTexture() }, uScale: { value: 300 } };
      const m = new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: `attribute vec3 dir; attribute float rnd; uniform float uAge,uR,uScale; uniform vec3 uCenter; varying float vA; varying float vR;
          void main(){
            float t=max(uAge,0.); float rr=uR*(1.-exp(-3.2*t));
            vec3 p=uCenter+dir*rr; p.y-=1.6*t*t;
            vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
            float life=1.-smoothstep(1.4+rnd*1.2,2.8+rnd,t);
            float tw=t>1.6?step(0.4,fract(t*9.+rnd*7.)):1.;
            vA=life*tw*step(0.,uAge); vR=rnd;
            gl_PointSize=clamp(uScale*(1.4+rnd)/-mv.z,1.,40.)*vA;
          }`,
        fragmentShader: `uniform sampler2D uTex; uniform vec3 uCol,uCol2; varying float vA; varying float vR; void main(){ vec4 tx=texture2D(uTex,gl_PointCoord); vec3 c=mix(uCol,uCol2,step(.7,vR)); gl_FragColor=vec4(c*tx.a*vA*2.2,tx.a*vA); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      });
      const pts = new THREE.Points(geo, m); pts.frustumCulled = false; g.add(pts);
      this.fw.push({ pts, u });
    }
    const fr = seeded(8);
    const fcols = ['#ff8fbf', '#ffd25a', '#7fd4ff', '#a66bff', '#ff3b55', '#ffffff'];
    this.fwList = FIREWORKS.map((t, i) => {
      const a = fr() * TAU, rad = 22 + fr() * 40;
      const stage = i % 5 === 0;
      return { t, c: stage ? new THREE.Vector3((fr() - 0.5) * 10, 9 + fr() * 4, -4 + fr() * 4) : new THREE.Vector3(Math.cos(a) * rad, 32 + fr() * 26, Math.sin(a) * rad - 10), col: fcols[i % fcols.length], col2: fcols[(i + 2) % fcols.length], R: stage ? 6 : 14 + fr() * 10 };
    });
    // sparkles
    const S = 900, sp = new Float32Array(S * 3), sph = new Float32Array(S);
    for (let i = 0; i < S; i++) { const a = r() * TAU, rad = 2 + r() * 26; sp[i * 3] = Math.cos(a) * rad; sp[i * 3 + 1] = r() * 20; sp[i * 3 + 2] = Math.sin(a) * rad - 3; sph[i] = r(); }
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sgeo.setAttribute('phase', new THREE.BufferAttribute(sph, 1));
    this.sparkU = { uT: { value: 0 }, uTex: { value: starTexture() }, uScale: { value: 300 }, uI: { value: 1 } };
    const sm = new THREE.ShaderMaterial({
      uniforms: this.sparkU,
      vertexShader: `attribute float phase; uniform float uT,uScale; varying float vA; void main(){ vec3 p=position; p.y=mod(p.y+uT*0.4*(0.5+phase),20.); p.x+=sin(uT*0.5+phase*20.)*0.6; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; vA=pow(0.5+0.5*sin(uT*3.+phase*60.),6.); gl_PointSize=clamp(uScale*0.5/-mv.z,1.,22.)*(0.4+vA); }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uI; varying float vA; void main(){ float a=texture2D(uTex,gl_PointCoord).a*vA*uI; gl_FragColor=vec4(vec3(1.,.9,1.)*a*1.6,a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const spk = new THREE.Points(sgeo, sm); spk.frustumCulled = false; g.add(spk);
    // hearts rising from the crowd
    const Hn = 500, hp = new Float32Array(Hn * 3), hph = new Float32Array(Hn);
    for (let i = 0; i < Hn; i++) { const a = Math.PI / 2 + (r() - 0.5) * 2.2, rad = 10 + r() * 20; hp[i * 3] = Math.cos(a) * rad; hp[i * 3 + 1] = 0; hp[i * 3 + 2] = Math.sin(a) * rad; hph[i] = r(); }
    const hgeo = new THREE.BufferGeometry(); hgeo.setAttribute('position', new THREE.BufferAttribute(hp, 3)); hgeo.setAttribute('phase', new THREE.BufferAttribute(hph, 1));
    this.heartU = { uT: { value: 0 }, uI: { value: 0 }, uTex: { value: heartTexture() }, uScale: { value: 300 } };
    const hm = new THREE.ShaderMaterial({
      uniforms: this.heartU,
      vertexShader: `attribute float phase; uniform float uT,uScale,uI; varying float vA; varying float vP; void main(){ float k=fract(uT*0.22+phase); vec3 p=position; p.y=1.5+k*14.; p.x+=sin(uT*1.3+phase*30.)*0.8; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; vA=sin(k*3.14159)*uI; vP=phase; gl_PointSize=clamp(uScale*0.9/-mv.z,1.,40.)*vA; }`,
      fragmentShader: `uniform sampler2D uTex; varying float vA; varying float vP; void main(){ float a=texture2D(uTex,gl_PointCoord).a*vA; vec3 c=mix(vec3(1.,.35,.65),vec3(1.,.7,.9),step(.5,vP)); gl_FragColor=vec4(c*a*1.8,a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const hearts = new THREE.Points(hgeo, hm); hearts.frustumCulled = false; g.add(hearts);
    // holographic butterflies
    this.butterflies = [];
    const wingTex = butterflyTexture();
    const wingGeo = new THREE.PlaneGeometry(1, 1.25); wingGeo.translate(0.5, 0.1, 0);
    for (let i = 0; i < 9; i++) {
      const bf = new THREE.Group();
      const m = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: wingTex }, uH: { value: i / 9 }, uT: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform sampler2D uTex; uniform float uH,uT; varying vec2 vUv;
          vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
          void main(){ vec4 t=texture2D(uTex,vUv); vec3 c=mix(hue(fract(uH+vUv.x*0.4+vUv.y*0.3+uT*0.1)),vec3(1.),t.g*0.45); float a=t.a*0.85; gl_FragColor=vec4(c*a*1.7,a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      });
      const L = new THREE.Mesh(wingGeo, m), R = new THREE.Mesh(wingGeo, m);
      R.scale.x = -1;
      const lw = new THREE.Group(), rw = new THREE.Group(); lw.add(L); rw.add(R);
      bf.add(lw, rw);
      const sc = 2.2 + (i % 3) * 1.3; bf.scale.setScalar(sc);
      g.add(bf);
      this.butterflies.push({ g: bf, lw, rw, m, ph: i * 1.7, rad: 12 + (i % 4) * 5, h: 7 + (i % 5) * 2.6, sp: 0.18 + (i % 3) * 0.05 });
    }
  }

  // ------------- per frame -------------
  update(t, dt, ctx) {
    const beat = t / BEAT;
    const U = this.uniforms;
    U.uTime.value = t; U.uBeat.value = beat;
    const sec = sectionAt(t).id;
    const hot = ['drop', 'chorus1', 'chorus2', 'final', 'dance', 'ending'].includes(sec);
    const kick = Math.exp(-((beat % 1 + 1) % 1) * 5);
    U.uPulse.value = hot ? kick : 0.25 * kick;
    const fx = this.fxClock(t);

    // lightsticks
    let cur = LIGHTSTICKS[0], prev = LIGHTSTICKS[0];
    for (let i = 0; i < LIGHTSTICKS.length; i++) if (LIGHTSTICKS[i].t <= t) { cur = LIGHTSTICKS[i]; prev = LIGHTSTICKS[Math.max(0, i - 1)]; }
    const S = this.stickU;
    S.uMode.value = MODE_ID[cur.mode]; S.uPrev.value = MODE_ID[prev.mode];
    S.uMix.value = Math.min(1, (t - cur.t) / 1.0);
    S.uCol.value.set(cur.who ? MEMBER_BY_ID[cur.who].color : '#ff8fbf');
    S.uPrevCol.value.set(prev.who ? MEMBER_BY_ID[prev.who].color : '#ff8fbf');
    S.uScale.value = ctx.pointScale;
    this.crowdU.uEnergy.value = t < 52 ? 0.25 : hot ? 1 : sec === 'bridge' ? 0.15 : 0.55;
    if (t >= 172) this.crowdU.uEnergy.value = 1.2;

    this.ribbonTex.offset.x = -t * 0.02;
    this.stageSideTex.offset.x = t * 0.08;

    // lifts glow during the rise
    const liftK = t > 48.5 && t < 52.4 ? Math.min(1, (t - 48.5) / 0.6) * (1 - Math.max(0, (t - 51.8) / 0.6)) : 0;
    for (const l of this.lifts) l.material.opacity = liftK;

    // dark until the drop
    const dark = t < 51.95;
    const intro = dark ? 0.15 : 1;
    for (const w of this.washes) w.visible = !dark || t > 50;
    const up = Math.min(1, Math.max(0, (t - 50.2) / 1.6));
    this.hemi.intensity = dark ? 0.12 + 0.12 * up : 0.55;
    this.key.intensity = dark ? 1.4 * up : 2.2;
    this.key2.intensity = dark ? 0.1 : 0.5;
    this.stageTop.uniforms.uDim.value = dark ? 0.3 + 0.25 * up : 1;
    this.mainScreen.material.uniforms.uBright.value = dark ? 0.35 : 1.25;
    this.washes.forEach((w, i) => {
      const a = beat * 0.25 * (i % 2 ? 1 : -1) + i * 2.1;
      w.target.position.set(Math.sin(a) * 4, 0, Math.cos(a * 1.3) * 3);
      w.intensity = (hot ? 2.0 : 1.2) * intro;
    });
    // moving beams
    this.beams.forEach((b, i) => {
      let k = (hot ? 1 : sec === 'bridge' ? 0.4 : 0.6) * (dark ? (t > 48 ? 0.25 : 0) : 1);
      if (sec === 'dance') k *= 0.5 + 0.8 * Math.exp(-((beat + i * 0.25) % 1) * 4);
      const sweep = sec === 'bridge' ? beat * 0.05 : beat * 0.25;
      const tx = Math.sin(sweep + i * 0.9) * 7, tz = Math.cos(sweep * 0.8 + i * 1.3) * 4 + 0.5;
      const ty = hot && i % 3 === 0 ? 60 : -1;
      b.holder.lookAt(b.pos.x + (tx - b.pos.x) * 0.9, ty, tz);
      b.holder.rotateX(-Math.PI / 2);
      b.m.uniforms.uI.value = k;
    });
    this.pillars.forEach((p, i) => { const on = hot ? Math.exp(-((beat + (i % 2) * 0.5) % 2) * 2.2) : 0; p.material.uniforms.uI.value = on; });
    this.rims.forEach((r) => (r.intensity = 3.2 * (dark ? (t > 50 ? 0.6 : 0.15) : 1)));

    // decor
    this.sun.rotation.z = -t * 0.08;
    this.crystals.forEach((c, i) => { c.children[0].material.color.setScalar(1.2 + 0.9 * kick); });
    this.parols.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.8 + i) * 0.08; });
    this.sparkU.uT.value = fx; this.sparkU.uScale.value = ctx.pointScale; this.sparkU.uI.value = dark ? 0.4 : 1;
    this.heartU.uT.value = fx; this.heartU.uScale.value = ctx.pointScale;
    this.heartU.uI.value = ['chorus1', 'chorus2', 'final', 'ending', 'outro'].includes(sec) ? 1 : sec === 'bridge' ? 0.6 : 0;

    // butterflies
    const bfOn = t > 52 ? (sec === 'bridge' || sec === 'final' || sec === 'ending' || sec === 'outro' || sec === 'drop' ? 1 : 0.55) : 0;
    this.butterflies.forEach((b, i) => {
      b.g.visible = bfOn > 0;
      const a = fx * b.sp + b.ph;
      b.g.position.set(Math.cos(a) * b.rad, b.h + Math.sin(a * 2.3) * 2, Math.sin(a) * b.rad * 0.7 - 2);
      b.g.rotation.set(-0.3, -a - Math.PI / 2, Math.sin(a * 3) * 0.2);
      const flap = Math.sin(fx * 7 + i) * 0.9;
      b.lw.rotation.y = flap; b.rw.rotation.y = -flap;
      b.m.uniforms.uT.value = t;
    });

    // confetti
    this.updateConfetti(t, fx);
    // fireworks
    this.fw.forEach((s) => (s.u.uAge.value = -1));
    let slot = 0;
    for (const f of this.fwList) {
      const age = this.fxClock(t) - this.fxClock(f.t);
      if (t >= f.t && age < 3.6) {
        const s = this.fw[slot++ % this.fw.length];
        s.u.uAge.value = age; s.u.uCenter.value.copy(f.c); s.u.uCol.value.set(f.col); s.u.uCol2.value.set(f.col2); s.u.uR.value = f.R; s.u.uScale.value = ctx.pointScale;
      }
    }
  }

  updateConfetti(t, fx) {
    let tb = null;
    for (const c of CONFETTI) if (t >= c && t - c < 10) tb = c;
    const conf = this.confetti;
    if (tb === null) { conf.count = 0; return; }
    const tau = fx - this.fxClock(tb);
    const N = this.confData.length;
    conf.count = N;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const k = 1.6, g = 2.2;
    const E = (1 - Math.exp(-k * tau)) / k;
    for (let i = 0; i < N; i++) {
      const d = this.confData[i];
      const y = 0.6 + (d.vy + g / k) * E - (g / k) * tau;
      p.set(d.x + d.vx * E + Math.sin(tau * 2 + d.ph) * 0.4 * Math.min(1, tau), Math.max(-0.85, y), d.z + d.vz * E + Math.cos(tau * 1.7 + d.ph) * 0.4 * Math.min(1, tau));
      e.set(tau * d.w * d.ax + d.ph, tau * d.w * 0.6, tau * d.w * d.az);
      q.setFromEuler(e);
      m4.compose(p, q, s);
      conf.setMatrixAt(i, m4);
    }
    conf.instanceMatrix.needsUpdate = true;
  }

  // Screens: live camera feed of the current singer + overlay graphics
  renderScreens(renderer, scene, chars, t, focus) {
    const cam = this.imagCam;
    const target = new THREE.Vector3();
    if (focus.length === 1) {
      chars[focus[0]].headWorld(target);
      target.y -= 0.12;
      const c = chars[focus[0]].root;
      const fwd = new THREE.Vector3(Math.sin(c.rotation.y), 0, Math.cos(c.rotation.y));
      cam.position.copy(target).addScaledVector(fwd, 3.1).add(new THREE.Vector3(Math.sin(t * 0.3) * 0.4, 0.15, 0));
      cam.fov = 18;
    } else {
      target.set(0, 1.4, 0.4);
      cam.position.set(Math.sin(t * 0.2) * 2, 2.2, 10.5);
      cam.fov = 30;
    }
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    this.mainScreen.visible = false;
    const prevRT = renderer.getRenderTarget();
    const bg = scene.background;
    renderer.setRenderTarget(this.imagRT);
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevRT);
    scene.background = bg;
    this.mainScreen.visible = true;
  }

  drawOverlay(t, focus) {
    const c = this.overlay.getContext('2d');
    const W = this.overlay.width, H = this.overlay.height;
    c.clearRect(0, 0, W, H);
    // vignette frame
    const g = c.createLinearGradient(0, H * 0.7, 0, H);
    g.addColorStop(0, 'rgba(40,0,60,0)'); g.addColorStop(1, 'rgba(40,0,60,0.65)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.font = '700 30px "Bagel Fat One", "Arial Black", sans-serif';
    c.fillStyle = '#ffffff';
    const names = focus.length === 1 ? MEMBER_BY_ID[focus[0]].name : 'HIRAYA';
    const col = focus.length === 1 ? MEMBER_BY_ID[focus[0]].color : '#ff8fbf';
    c.fillStyle = col; c.fillRect(28, H - 66, 8, 40);
    c.fillStyle = '#fff'; c.fillText(names, 48, H - 34);
    c.font = '600 18px "DM Sans", sans-serif'; c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillText('LIVE · HIRAYA DOME', 48, H - 14);
    for (let i = 0; i < 6; i++) star2d(c, W - 40 - i * 26, 36, 8 + 4 * Math.abs(Math.sin(t * 2 + i)), 'rgba(255,240,255,0.9)');
    this.overlayTex.needsUpdate = true;
  }

  drawGfx(t, focus, sec) {
    const c = this.gfx.getContext('2d');
    const W = this.gfx.width, H = this.gfx.height;
    const beat = t / BEAT;
    const bg = c.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#2a0b4a'); bg.addColorStop(1, '#5a1458');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    // banig weave pattern
    const sz = 32;
    for (let y = 0; y < H / sz + 1; y++) for (let x = 0; x < W / sz + 1; x++) {
      const k = ((x + y + Math.floor(beat)) % 4);
      c.fillStyle = ['rgba(255,143,191,0.22)', 'rgba(166,107,255,0.2)', 'rgba(255,210,90,0.16)', 'rgba(127,212,255,0.18)'][k];
      c.save(); c.translate(x * sz, y * sz); c.rotate(Math.PI / 4); c.fillRect(-sz * 0.3, -sz * 0.3, sz * 0.6, sz * 0.6); c.restore();
    }
    if (focus.length === 1) {
      const m = MEMBER_BY_ID[focus[0]];
      const glow = c.createRadialGradient(W / 2, H * 0.48, 10, W / 2, H * 0.48, 230);
      glow.addColorStop(0, hexA(m.color, 0.85)); glow.addColorStop(1, hexA(m.color, 0));
      c.fillStyle = glow; c.fillRect(0, 0, W, H);
      drawPortrait(c, m, W / 2, H * 0.47, 330, { blinkL: 0, blinkR: 0, happy: 0, lookX: 0, lookY: 0, brow: 0.1, browTilt: 0, open: 0, wide: 1, round: 0, smile: 0.7, sparkle: 1, time: t });
      c.font = '400 64px "Bagel Fat One", "Arial Black", sans-serif'; c.textAlign = 'center';
      c.fillStyle = '#fff'; c.shadowColor = m.color; c.shadowBlur = 24;
      c.fillText(m.name, W / 2, H - 26); c.shadowBlur = 0; c.textAlign = 'left';
    } else {
      c.textAlign = 'center';
      c.font = '400 120px "Bagel Fat One", "Arial Black", sans-serif';
      const pulse = 1 + 0.05 * Math.exp(-(beat % 1) * 4);
      c.save(); c.translate(W / 2, H / 2 + 30); c.scale(pulse, pulse);
      const tg = c.createLinearGradient(-300, -60, 300, 60);
      tg.addColorStop(0, '#ff8fbf'); tg.addColorStop(0.35, '#ffd25a'); tg.addColorStop(0.7, '#7fd4ff'); tg.addColorStop(1, '#a66bff');
      c.fillStyle = tg; c.shadowColor = '#ff8fbf'; c.shadowBlur = 30;
      c.fillText('HIRAYA', 0, 0); c.restore(); c.shadowBlur = 0;
      c.font = '600 30px "DM Sans", sans-serif'; c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillText(sec === 'dance' ? 'DANCE BREAK' : 'KILIG (WORLDWIDE)', W / 2, H / 2 + 90);
      c.textAlign = 'left';
    }
    this.gfxTex.needsUpdate = true;
  }
}

function mergeBoxes(geos) {
  const pos = [], idx = [];
  let base = 0;
  for (const g of geos) {
    const p = g.attributes.position, ix = g.index;
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  return out;
}

function butterflyTexture() {
  return canvasTexture(256, 320, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const wing = (path, a) => { c.globalAlpha = a; c.fill(path); };
    const up = new Path2D(); up.moveTo(4, 150); up.bezierCurveTo(40, 10, 220, -10, 250, 70); up.bezierCurveTo(240, 140, 120, 165, 4, 160); up.closePath();
    const lo = new Path2D(); lo.moveTo(4, 165); lo.bezierCurveTo(120, 170, 210, 220, 180, 300); lo.bezierCurveTo(120, 320, 30, 260, 4, 175); lo.closePath();
    c.fillStyle = '#ffffff'; c.globalAlpha = 1;
    const gr = c.createRadialGradient(20, 160, 10, 60, 150, 240);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0.35)');
    c.fillStyle = gr; wing(up, 1); wing(lo, 1);
    c.globalAlpha = 1; c.strokeStyle = 'rgba(255,0,0,1)'; c.lineWidth = 3;
    c.stroke(up); c.stroke(lo);
    c.fillStyle = 'rgba(255,0,0,0.9)';
    for (const [x, y, r] of [[190, 70, 18], [140, 50, 10], [130, 230, 14], [80, 110, 8]]) { c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
  });
}
