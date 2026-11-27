// Сцена навколо ялинки: models/scene.glb (власна модель з Blender) + сніг.
// Жодної геометрії автоматично не генерується.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODELS, MODEL_SCALE, SNOW } from './scene-config.js';

function makeSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

async function loadScene(scene) {
  try {
    const { scene: obj } = await new GLTFLoader().loadAsync(MODELS.scene);
    obj.scale.setScalar(MODEL_SCALE);
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(obj);
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    console.log(`Сцена: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} м`);
    return true;
  } catch (err) {
    console.warn('Не вдалося завантажити', MODELS.scene, err);
    return false;
  }
}

function addSnow({ scene, onFrame }) {
  const { area, height } = SNOW;
  const count = window.innerWidth < 700 ? Math.floor(SNOW.count / 2) : SNOW.count;
  const pos = new Float32Array(count * 3), speed = new Float32Array(count), phase = new Float32Array(count);
  const spawn = (i, anyHeight) => {
    const r = area * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = anyHeight ? Math.random() * height : height;
    pos[i * 3 + 2] = Math.sin(a) * r;
  };
  for (let i = 0; i < count; i++) {
    spawn(i, true);
    speed[i] = 0.4 + Math.random() * 0.7;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(geo, new THREE.PointsMaterial({
    map: makeSprite(), size: 0.22, transparent: true, opacity: 0.9, depthWrite: false }));
  snow.frustumCulled = false;
  scene.add(snow);
  onFrame((dt, t) => {
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= speed[i] * dt;
      pos[i * 3] += Math.sin(t * 0.7 + phase[i]) * 0.25 * dt;
      if (pos[i * 3 + 1] < 0) spawn(i, false);
    }
    geo.attributes.position.needsUpdate = true;
  });
}

/** ctx = { scene, onFrame } з createTreeScene. Повертає true, якщо scene.glb завантажено. */
export async function addDecor(ctx) {
  const ok = await loadScene(ctx.scene);
  addSnow(ctx);
  return ok;
}
