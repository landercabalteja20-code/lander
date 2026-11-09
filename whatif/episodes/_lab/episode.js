// Model lab: turntable views of the pop star presets (not an episode; for checking the kit).
import * as THREE from 'three';
import { createPopStar } from '../../kit/popstar.js';
import { cameraPath } from '../../kit/util.js';

let sunny, emerald;
const ep = {
  fps: 30, duration: 20,
  async setup() { sunny = createPopStar('SUNNY'); emerald = createPopStar('EMERALD'); },
  scenes: {
    lab: () => {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#8fa3b8');
      scene.add(new THREE.HemisphereLight('#dfe9ff', '#5a4a3a', 0.8));
      const key = new THREE.DirectionalLight('#fff3e0', 1.8); key.position.set(2, 4, 3); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 3; key.shadow.camera.bottom = -1;
      scene.add(key);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: '#6b6f78' }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      scene.add(sunny.group); scene.add(emerald.group);
      sunny.group.position.x = -0.45; emerald.group.position.x = 0.45;
      return { scene, update(ctx) {
        const t = ctx.t;
        const mouth = 0.5 + 0.5 * Math.sin(t * 6);
        const poses = ['mic', 'hip', 'up', 'reach', 'wave'];
        const pL = poses[Math.floor(t / 2) % poses.length];
        sunny.update(t, { beat: t * 1.6, mouth, vowel: 'a', armL: pL === 'mic' ? 'hip' : pL, armR: 'mic', look: ctx.camera.position });
        emerald.update(t, { beat: t * 1.6 + 0.5, mouth: 1 - mouth, vowel: 'o', armL: 'hip', armR: 'mic', look: ctx.camera.position });
      } };
    },
  },
  shots: [
    { t0: 0, t1: 5, scene: 'lab', camera: cameraPath([{ t: 0, pos: [0, 1.1, 4.2], look: [0, 0.95, 0], fov: 40 }, { t: 5, pos: [2.5, 1.3, 3.3], look: [0, 0.95, 0] }]) },
    { t0: 5, t1: 10, scene: 'lab', camera: cameraPath([{ t: 0, pos: [-0.45, 1.6, 0.75], look: [-0.45, 1.6, 0], fov: 35 }, { t: 5, pos: [-0.2, 1.62, 0.7], look: [-0.45, 1.6, 0] }]) },
    { t0: 10, t1: 15, scene: 'lab', camera: cameraPath([{ t: 0, pos: [0.45, 1.6, 0.75], look: [0.45, 1.6, 0], fov: 35 }, { t: 5, pos: [0.8, 1.6, 0.6], look: [0.45, 1.6, 0] }]) },
    { t0: 15, t1: 20, scene: 'lab', camera: cameraPath([{ t: 0, pos: [-0.45, 1.3, -2.5], look: [-0.45, 1.0, 0], fov: 40 }, { t: 5, pos: [-2.4, 1.2, -1.0], look: [-0.45, 1.0, 0] }]) },
  ],
  drawOverlay(ctx, ov) { ov.caption('Model lab · t=' + ctx.t.toFixed(1), 0.8, { y: 0.9, size: 34 }); },
};
export default ep;
