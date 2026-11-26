// Декор сцени: паркет, кімната з гірляндою, килим, подарунки, сніг.
// Кожен елемент (крім снігу) береться з models/*.glb, якщо файл є (див. DECOR у config.js),
// інакше будується запасний варіант кодом.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DECOR, SNOW } from './config.js';

const ROOM_R = 22; // радіус кімнати (має відповідати size у DECOR.floor / DECOR.room)

// ---------- Допоміжне ----------

function setShadows(obj) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

/** Масштабує власну модель, центрує по X/Z і ставить на підлогу. */
function fit(obj, { by, size, lift = 0 }) {
  const box = new THREE.Box3().setFromObject(obj);
  const s = box.getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(size / (by === 'height' ? s.y : Math.max(s.x, s.z)));
  box.setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.set(obj.position.x - c.x, obj.position.y - box.min.y + lift, obj.position.z - c.z);
  setShadows(obj);
}

async function loadOrFallback(def, build) {
  if (def.url) {
    try {
      const gltf = await new GLTFLoader().loadAsync(def.url);
      fit(gltf.scene, def);
      return { obj: gltf.scene, custom: true };
    } catch (e) { /* файлу немає або він пошкоджений — беремо запасний */ }
  }
  const obj = build();
  obj.position.y += def.lift || 0;
  return { obj, custom: false };
}

function makeSprite(hard) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(hard ? 0.5 : 0.25, hard ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------- Паркет ----------

function makeParquetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const rowH = 64, plankW = 256;
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * plankW / 2;
    const hues = [Math.random(), Math.random()]; // колір дошки; крайні частини однієї дошки збігаються
    for (let k = 0, x = -off; x < 512; k++, x += plankW) {
      g.fillStyle = `hsl(28 ${48 + hues[k % 2] * 10}% ${36 + hues[k % 2] * 10}%)`;
      g.fillRect(x, row * rowH, plankW, rowH);
      g.strokeStyle = 'rgba(60,30,10,.15)';
      g.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = row * rowH + 8 + Math.random() * (rowH - 16);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + plankW, y + (Math.random() - .5) * 4); g.stroke();
      }
      g.strokeStyle = 'rgba(30,15,5,.7)';
      g.lineWidth = 2;
      g.strokeRect(x, row * rowH, plankW, rowH);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  t.anisotropy = 8;
  return t;
}

function buildFloor() {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(ROOM_R, 64),
    new THREE.MeshStandardMaterial({ map: makeParquetTexture(), roughness: 0.55 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  return floor;
}

// ---------- Кімната: стіна + гірлянда ----------

function makeWallTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  const trimY = 512 * 0.62;
  const wall = g.createLinearGradient(0, 0, 0, trimY);
  wall.addColorStop(0, '#241530');
  wall.addColorStop(1, '#5a3040');
  g.fillStyle = wall; g.fillRect(0, 0, 256, trimY);
  g.fillStyle = '#c9a66b'; g.fillRect(0, trimY, 256, 6);             // плінтус-молдинг
  const wood = g.createLinearGradient(0, trimY + 6, 0, 512);
  wood.addColorStop(0, '#3b2219'); wood.addColorStop(1, '#2a170f');
  g.fillStyle = wood; g.fillRect(0, trimY + 6, 256, 512 - trimY - 6);
  g.strokeStyle = 'rgba(200,160,110,.35)'; g.lineWidth = 2;           // панелі
  g.strokeRect(24, trimY + 30, 208, 512 - trimY - 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = 10;
  return t;
}

function buildRoom({ onFrame }) {
  const room = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_R, ROOM_R, 16, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: makeWallTexture(), side: THREE.BackSide })
  );
  wall.position.y = 8;
  room.add(wall);

  // Гірлянда: теплі вогники з легким мерехтінням (три групи в різній фазі)
  const N = 72, colors = [0xffd27a, 0xff9d5c, 0xffc2c2];
  const pts = colors.map(() => []);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const y = 8.5 - 1.2 * Math.sin(Math.PI * (i % 12) / 12);       // провисання між «гачками»
    pts[i % 3].push(Math.cos(a) * (ROOM_R - 0.5), y, Math.sin(a) * (ROOM_R - 0.5));
  }
  const glow = makeSprite(false);
  const lights = pts.map((p, k) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ map: glow, color: colors[k], size: 1.2, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const points = new THREE.Points(geo, m);
    room.add(points);
    return m;
  });
  onFrame((dt, t) => lights.forEach((m, k) => { m.opacity = 0.55 + 0.45 * Math.sin(t * 1.6 + k * 2.1); }));
  return room;
}

// ---------- Килим ----------

function buildRug() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0x9b2d30, roughness: 1 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf0e2c8, roughness: 1 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.04, 48), red);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.5, 3.75, 48), cream);
  disc.position.y = 0.02;
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.045;
  g.add(disc, ring);
  setShadows(g);
  return g;
}

// ---------- Подарунки ----------

// [кут°, відстань від центру, [ширина, висота, глибина], колір коробки, колір стрічки]
const GIFTS = [
  [20, 3.0, [1.0, 0.8, 1.0], 0xc0392b, 0xf4d03f],
  [60, 3.5, [0.7, 0.6, 0.7], 0x2e86c1, 0xffffff],
  [105, 3.1, [1.2, 0.7, 0.9], 0x27ae60, 0xf1c40f],
  [150, 3.6, [0.8, 1.0, 0.8], 0x8e44ad, 0xfadbd8],
  [200, 3.0, [1.1, 0.6, 1.1], 0xf39c12, 0xc0392b],
  [250, 3.5, [0.6, 0.6, 0.6], 0xe91e63, 0xffffff],
  [300, 3.2, [1.0, 0.9, 0.8], 0x16a085, 0xf7dc6f],
  [340, 3.7, [0.7, 0.5, 0.9], 0xd35400, 0xffffff],
];

function buildGift(w, h, d, color, ribbonColor) {
  const g = new THREE.Group();
  const box = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const rib = new THREE.MeshStandardMaterial({ color: ribbonColor, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), box);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.1), rib);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, h + 0.02, d + 0.02), rib);
  const bow1 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 8, 16), rib);
  const bow2 = bow1.clone();
  bow1.rotation.y = Math.PI / 4; bow2.rotation.y = -Math.PI / 4;
  bow1.position.y = bow2.position.y = h + 0.1;
  [body, r1, r2].forEach(m => { m.position.y = h / 2; });
  g.add(body, r1, r2, bow1, bow2);
  return g;
}

function buildGifts() {
  const g = new THREE.Group();
  for (const [deg, r, [w, h, d], color, rib] of GIFTS) {
    const gift = buildGift(w, h, d, color, rib);
    const a = deg * Math.PI / 180;
    gift.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    gift.rotation.y = a * 1.7;
    g.add(gift);
  }
  setShadows(g);
  return g;
}

// ---------- Сніг ----------

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
    map: makeSprite(true), size: 0.22, transparent: true, opacity: 0.9, depthWrite: false }));
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

// ---------- Публічна функція ----------

/** Додає весь декор у сцену. ctx = { scene, onFrame } з createTreeScene.
 *  Повертає список елементів, які завантажено з власних моделей (інші — запасні). */
export async function addDecor(ctx) {
  const builders = { floor: buildFloor, room: buildRoom, rug: buildRug, gifts: buildGifts };
  const custom = await Promise.all(Object.entries(builders).map(async ([key, build]) => {
    const { obj, custom } = await loadOrFallback(DECOR[key], () => build(ctx));
    ctx.scene.add(obj);
    return custom ? key : null;
  }));
  addSnow(ctx);
  return custom.filter(Boolean);
}
