// Turntable for checking characters:  node engine/render.cjs _lab --stills 0,1,2,3 --q "char=dog&jaw=0.6"
// t = 0 front 3/4, 1 side, 2 face close-up, 3 back 3/4.
import * as THREE from 'three';
import { loadCast, makeCharacter } from '../../kit/character.js';

const q = new URLSearchParams(location.search);
const NAME = q.get('char') || 'dog';
const JAW = parseFloat(q.get('jaw') || '0');
const LIDS = parseFloat(q.get('lids') || '1');
let C;

export default {
  fps: 30,
  duration: 4,
  async setup() { await loadCast([NAME]); },
  scenes: {
    studio() {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#9fb7c9');
      const key = new THREE.DirectionalLight('#fff3e0', 2.6);
      key.position.set(1.5, 3, 2.5); key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -1.5; key.shadow.camera.right = 1.5;
      key.shadow.camera.top = 1.5; key.shadow.camera.bottom = -1.5; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
      scene.add(key, new THREE.HemisphereLight('#dfefff', '#8a7a68', 0.6));
      const rim = new THREE.DirectionalLight('#cfe4ff', 1.2); rim.position.set(-2, 2, -2.5); scene.add(rim);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9c2b5', roughness: 0.9 }));
      floor.receiveShadow = true; scene.add(floor);
      C = makeCharacter(NAME); scene.add(C.root);
      const box = new THREE.Box3().setFromObject(C.root);
      scene.environmentIntensity = 0.5;
      return { scene, box, update() { C.pose({ jaw: JAW, lids: LIDS }); } };
    },
  },
  shots: [0, 1, 2, 3].map((i) => ({
    t0: i, t1: i + 1, scene: 'studio',
    camera(cam, lt, ctx) {
      const b = ctx.S.box; const c = b.getCenter(new THREE.Vector3()); const s = b.getSize(new THREE.Vector3());
      const r = Math.max(s.x, s.y, s.z);
      const ang = [0.6, 1.57, 0.25, 2.6][i];
      if (i === 2) { // face close-up: look at the top of the model
        const head = C.nodes.head ? C.nodes.head.getWorldPosition(new THREE.Vector3()) : c;
        cam.position.set(head.x + Math.sin(ang) * r * 0.55, head.y + r * 0.08, head.z + Math.cos(ang) * r * 0.55 + 0.15);
        cam.lookAt(head.x, head.y + 0.06, head.z + 0.1);
      } else {
        cam.position.set(c.x + Math.sin(ang) * r * 2.1, c.y + r * 0.35, c.z + Math.cos(ang) * r * 2.1);
        cam.lookAt(c);
      }
    },
  })),
};
