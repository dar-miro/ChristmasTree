// Відображення прикрас на ялинці (TREE-02).
// Поки що всі форми малюються як куля; інші форми додамо пізніше.
import * as THREE from 'three';

const RADIUS = 0.2;
const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });

/** Резервні місця: спіраль по конусу, якщо в моделі немає slot_* */
function fallbackSlots(treeGroup, count = 12) {
  treeGroup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(treeGroup);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxR = Math.max(size.x, size.z) / 2;
  const slots = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;                       // 0..1 знизу догори
    const y = box.min.y + size.y * (0.12 + 0.68 * t);
    const k = 1 - (y - box.min.y) / size.y;            // конус звужується догори
    const r = maxR * k * 0.95 + 0.1;
    const a = i * 2.399963;                            // золотий кут
    slots.push({
      name: 'auto_' + String(i + 1).padStart(2, '0'),
      position: new THREE.Vector3(center.x + Math.cos(a) * r, y, center.z + Math.sin(a) * r),
    });
  }
  return slots;
}

function makeBall(row) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 32, 24),
    new THREE.MeshStandardMaterial({ color: row.background_color, metalness: 0.3, roughness: 0.25 })
  );
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 16), gold);
  cap.position.y = RADIUS + 0.02;
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 8, 16), gold);
  loop.position.y = RADIUS + 0.09;
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
        if (o.material !== gold) o.material.dispose();
      }
    });
  }
}

/** Малює всі прикраси з бази. Викликається після кожної зміни списку. */
export function renderOrnaments(three, ornaments) {
  clearGroup(three.ornamentsGroup);
  const slots = three.slots.length ? three.slots : fallbackSlots(three.tree);
  ornaments.forEach((row, i) => {
    const slot = slots[i % slots.length];
    const mesh = makeBall(row);
    mesh.position.copy(slot.position);
    three.ornamentsGroup.add(mesh);
  });
}