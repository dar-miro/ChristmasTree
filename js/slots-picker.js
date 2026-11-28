// Режим розмітки місць для прикрас (відкривається за адресою з ?edit).
import * as THREE from 'three';
import { SLOTS } from './slots-config.js';

const OFFSET = 0.12; // наскільки відсунути центр кульки від поверхні гілки

export function enableSlotPicker(three) {
  const dom = three.controls.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const points = SLOTS.map(p => [...p]);   // продовжуємо з уже збережених
  const markers = new THREE.Group();
  three.scene.add(markers);

  const markerGeo = new THREE.SphereGeometry(0.1, 16, 12);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xff3fa4 });

  // Панель з результатом
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:10;background:rgba(0,0,0,.8);' +
    'color:#fff;padding:8px;border-radius:10px;font:13px system-ui;max-width:520px';
  panel.innerHTML = `
    <div id="sp-count" style="margin-bottom:6px"></div>
    <textarea id="sp-out" readonly style="width:100%;height:110px;box-sizing:border-box;font:12px monospace"></textarea>
    <div style="margin-top:6px;display:flex;gap:8px">
      <button id="sp-copy">Копіювати</button>
      <button id="sp-undo">Скасувати останнє</button>
      <button id="sp-clear">Очистити все</button>
    </div>`;
  document.body.appendChild(panel);
  const out = panel.querySelector('#sp-out');
  const count = panel.querySelector('#sp-count');

  function refresh() {
    markers.clear();
    points.forEach(p => {
      const m = new THREE.Mesh(markerGeo, markerMat);
      m.position.set(...p);
      markers.add(m);
    });
    count.textContent = `Місць: ${points.length}. Клікніть по ялинці, щоб додати.`;
    out.value = 'export const SLOTS = [\n' +
      points.map(p => `  [${p.map(v => v.toFixed(2)).join(', ')}],`).join('\n') + '\n];\n';
  }

  // Відрізняємо клік від перетягування (обертання)
  let down = null;
  dom.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  dom.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, three.camera);
    const hit = ray.intersectObject(three.tree, true)[0];
    if (!hit) return;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (n.dot(ray.ray.direction) > 0) n.negate();   // нормаль має дивитись до камери
    const p = hit.point.clone().addScaledVector(n, OFFSET);
    points.push([p.x, p.y, p.z]);
    refresh();
  });

  panel.querySelector('#sp-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(out.value); }
    catch { out.select(); document.execCommand('copy'); }
  };
  panel.querySelector('#sp-undo').onclick = () => { points.pop(); refresh(); };
  panel.querySelector('#sp-clear').onclick = () => { points.length = 0; refresh(); };

  refresh();
}