// Відображення прикрас на ялинці (TREE-02).
// Поки що всі форми малюються як куля; інші форми додамо пізніше.
import * as THREE from 'three';
import { SLOTS } from './slots-config.js';
import { PATTERN_IDS, drawPattern } from './patterns.js';
import { ORNAMENT_RADIUS } from './scene-config.js';

const RADIUS = ORNAMENT_RADIUS;
const K = RADIUS / 0.2;   // множник для кришечки й петельки

const TEX_W = 512, TEX_H = 256, TEX_CELL = 32;   // 16 клітинок по колу кульки
const HEX = /^#[0-9a-f]{6}$/i;
const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });

/** Резервні місця: спіраль по конусу, якщо слотів немає ніде */
function fallbackSlots(treeGroup, count = 12) {
  treeGroup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(treeGroup);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxR = Math.max(size.x, size.z) / 2;
  const slots = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const y = box.min.y + size.y * (0.12 + 0.68 * t);
    const k = 1 - (y - box.min.y) / size.y;
    const r = maxR * k * 0.95 + 0.1;
    const a = i * 2.399963;
    slots.push({
      name: 'auto_' + String(i + 1).padStart(2, '0'),
      position: new THREE.Vector3(center.x + Math.cos(a) * r, y, center.z + Math.sin(a) * r),
    });
  }
  return slots;
}

/** Пріоритет: slots-config.js → slot_* з моделі → автоматичні */
function getSlots(three) {
  if (SLOTS.length) {
    return SLOTS.map((p, i) => ({
      name: 'slot_' + String(i + 1).padStart(2, '0'),
      position: new THREE.Vector3(p[0], p[1], p[2]),
    }));
  }
  if (three.slots.length) return three.slots;
  return fallbackSlots(three.tree);
}

/** Текстура кульки: фон + орнамент. Повертає null, якщо орнаменту немає або дані некоректні. */
function makePatternTexture(row) {
  if (!row.pattern || !PATTERN_IDS.has(row.pattern)) return null;
  if (!HEX.test(row.background_color) || !HEX.test(row.pattern_color || '')) return null;
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  drawPattern(c.getContext('2d'), TEX_W, TEX_H, row.pattern, row.background_color, row.pattern_color, TEX_CELL);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeBall(row) {
  const g = new THREE.Group();
  const map = makePatternTexture(row);
  const material = new THREE.MeshStandardMaterial(
    map
      ? { map, color: 0xffffff, metalness: 0.3, roughness: 0.25 }
      : { color: row.background_color, metalness: 0.3, roughness: 0.25 }
  );
  const ball = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 32, 24), material);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * K, 0.06 * K, 0.07 * K, 16), gold);
  cap.position.y = RADIUS + 0.02 * K;
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.04 * K, 0.01 * K, 8, 16), gold);
  loop.position.y = RADIUS + 0.09 * K;
  g.add(ball, cap, loop);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.ornament = row;   // знадобиться для кліку (VIEW-01…04)
  return g;
}

function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse(o => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (o.material !== gold) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      }
    });
  }
}

/** Малює всі прикраси з бази. Викликається після кожної зміни списку. */
export function renderOrnaments(three, ornaments) {
  clearGroup(three.ornamentsGroup);
  const slots = getSlots(three);
  if (ornaments.length > slots.length) {
    console.warn(`Прикрас (${ornaments.length}) більше, ніж місць (${slots.length}). Зайві не показано.`);
  }
  ornaments.slice(0, slots.length).forEach((row, i) => {
    const mesh = makeBall(row);
    mesh.position.copy(slots[i].position);
    three.ornamentsGroup.add(mesh);
  });
}
/** Каркасний «привид» прикраси (кулька + кришечка + петелька) для редактора слотів. */
export function makeGhost(color = 0xffe14d) {
  const mat = new THREE.MeshBasicMaterial({
    color, wireframe: true, depthTest: false, transparent: true, opacity: 0.8,
  });
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 20, 14), mat);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * K, 0.06 * K, 0.07 * K, 12), mat);
  cap.position.y = RADIUS + 0.02 * K;
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.04 * K, 0.01 * K, 6, 12), mat);
  loop.position.y = RADIUS + 0.09 * K;
  g.add(ball, cap, loop);
  g.traverse(o => { o.renderOrder = 1000; });
  return g;
}