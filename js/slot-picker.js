// Режим розмітки місць для прикрас (відкривається за адресою з ?edit).
import * as THREE from 'three';
import { SLOTS } from './slots-config.js';
import { makeGhost } from './ornaments.js';

const OFFSET = 0.12;          // наскільки відсунути точку від поверхні при кліку
const DRAFT_KEY = 'slots-draft-v1';
const AXES = [
  { key: 0, name: 'X', color: '#ff6b6b' },
  { key: 1, name: 'Y', color: '#6bff8a' },
  { key: 2, name: 'Z', color: '#6b9bff' },
];

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (Array.isArray(d) && d.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))) return d;
  } catch { /* немає чернетки */ }
  return null;
}
function saveDraft(points) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(points)); } catch { /* ігноруємо */ }
}

export function enableSlotPicker(three) {
  const dom = three.controls.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const homeTarget = three.controls.target.clone();

  let points = loadDraft() ?? SLOTS.map(p => [...p]);
  let sel = points.length ? 0 : -1;
  let step = 0.05;
  let mode = 'add'; // 'add' — клік додає нову точку, 'move' — переміщує вибрану

  // Межі повзунків — за розмірами ялинки
  const box = new THREE.Box3().setFromObject(three.tree);
  const hasBox = !box.isEmpty();
  const lim = hasBox
    ? [[box.min.x - 1, box.max.x + 1], [Math.max(0, box.min.y - 0.5), box.max.y + 0.5], [box.min.z - 1, box.max.z + 1]]
    : [[-4, 4], [0, 8], [-4, 4]];

  // ---------- 3D: маркери, контур кульки, осі ----------
  const markers = new THREE.Group();
  const overlay = new THREE.Group();   // контур + осі вибраної точки
  three.scene.add(markers, overlay);

  const markerGeo = new THREE.SphereGeometry(0.1, 16, 12);
  const matNormal = new THREE.MeshBasicMaterial({ color: 0xff3fa4, depthTest: false, transparent: true, opacity: 0.9 });
  const matSel = new THREE.MeshBasicMaterial({ color: 0xffe14d, depthTest: false });

  overlay.add(makeGhost());   // кулька + кришечка + петелька, як у справжньої прикраси
  [[0xff4d4d, [1, 0, 0]], [0x4dff4d, [0, 1, 0]], [0x4d8dff, [0, 0, 1]]].forEach(([c, d]) => {
    const v = new THREE.Vector3(...d).multiplyScalar(0.6);
    const g = new THREE.BufferGeometry().setFromPoints([v.clone().negate(), v]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, depthTest: false }));
    overlay.add(l);
  });

  function drawMarkers() {
    markers.clear();
    points.forEach((p, i) => {
      const m = new THREE.Mesh(markerGeo, i === sel ? matSel : matNormal);
      m.position.set(p[0], p[1], p[2]);
      m.scale.setScalar(i === sel ? 1.3 : 1);
      m.renderOrder = 999;
      m.userData.i = i;
      markers.add(m);
    });
    overlay.visible = sel >= 0;
    if (sel >= 0) overlay.position.set(...points[sel]);
  }

  // ---------- Панель ----------
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:8px;top:90px;z-index:10;width:300px;max-width:calc(100vw - 16px);' +
    'max-height:calc(100vh - 150px);overflow:auto;box-sizing:border-box;background:rgba(0,0,0,.82);color:#fff;' +
    'padding:8px;border-radius:10px;font:12px system-ui';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <b id="sp-count"></b>
      <button id="sp-fold" type="button">Згорнути</button>
    </div>
    <div id="sp-body">
      <div style="margin:6px 0 2px">Клік по ялинці:</div>
      <label><input type="radio" name="sp-mode" value="add" checked> додає нову точку</label><br>
      <label><input type="radio" name="sp-mode" value="move"> переміщує вибрану</label>
      <div style="margin:8px 0 2px">Точки (порядок = порядок прикрас):</div>
      <div id="sp-list" style="display:flex;flex-wrap:wrap;gap:4px"></div>
      <div id="sp-edit" style="margin-top:8px;border-top:1px solid #555;padding-top:6px">
        <div style="margin-bottom:4px">Крок: <select id="sp-step">
          <option value="0.01">0,01</option><option value="0.05" selected>0,05</option><option value="0.2">0,2</option>
        </select></div>
        <div id="sp-axes"></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
          <button id="sp-focus" type="button">Камера на точці</button>
          <button id="sp-home" type="button">Камера на ялинку</button>
          <button id="sp-del" type="button">Видалити вибрану</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
        <button id="sp-add" type="button">+ Додати в центр кадру</button>
        <button id="sp-clear" type="button">Очистити все</button>
        <button id="sp-reset" type="button">Скинути чернетку</button>
      </div>
      <textarea id="sp-out" readonly style="width:100%;height:100px;box-sizing:border-box;font:11px monospace;margin-top:8px"></textarea>
      <button id="sp-copy" type="button" style="margin-top:4px">Копіювати</button>
    </div>`;
  document.body.appendChild(panel);
  const $ = id => panel.querySelector('#' + id);

  // Рядки X / Y / Z
  const rows = AXES.map(a => {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;align-items:center;gap:4px;margin:3px 0';
    r.innerHTML = `
      <b style="width:14px;color:${a.color}">${a.name}</b>
      <button type="button" data-d="-1">−</button>
      <input type="range" style="flex:1;min-width:0" min="${lim[a.key][0].toFixed(2)}" max="${lim[a.key][1].toFixed(2)}" step="0.01">
      <button type="button" data-d="1">+</button>
      <input type="number" step="0.01" style="width:62px">`;
    $('sp-axes').appendChild(r);
    const slider = r.querySelector('input[type=range]');
    const num = r.querySelector('input[type=number]');
    slider.oninput = () => setCoord(a.key, parseFloat(slider.value));
    num.oninput = () => { const v = parseFloat(num.value); if (Number.isFinite(v)) setCoord(a.key, v, num); };
    r.querySelectorAll('button').forEach(b => {
      b.onclick = () => { if (sel >= 0) setCoord(a.key, points[sel][a.key] + parseFloat(b.dataset.d) * step); };
    });
    return { slider, num };
  });

  function setCoord(axis, value, from) {
    if (sel < 0) return;
    points[sel][axis] = Math.round(value * 100) / 100;
    drawMarkers();
    syncControls(from);
    updateOutput();
    saveDraft(points);
  }

  function syncControls(skip) {
    const has = sel >= 0;
    $('sp-edit').style.opacity = has ? 1 : 0.4;
    $('sp-edit').style.pointerEvents = has ? '' : 'none';
    rows.forEach((r, i) => {
      const v = has ? points[sel][i] : 0;
      r.slider.value = v;
      if (r.num !== skip) r.num.value = has ? v.toFixed(2) : '';
    });
  }

  function renderList() {
    const list = $('sp-list');
    list.innerHTML = '';
    points.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = i + 1;
      b.style.cssText = i === sel ? 'background:#ffe14d;font-weight:700' : '';
      b.onclick = () => select(i);
      list.appendChild(b);
    });
  }

  function updateOutput() {
    $('sp-count').textContent = `Місць: ${points.length}`;
    $('sp-out').value = 'export const SLOTS = [\n' +
      points.map(p => `  [${p.map(v => v.toFixed(2)).join(', ')}],`).join('\n') + '\n];\n';
  }

  function select(i) {
    sel = i;
    drawMarkers();
    renderList();
    syncControls();
  }

  function refreshAll() {
    if (sel >= points.length) sel = points.length - 1;
    drawMarkers();
    renderList();
    syncControls();
    updateOutput();
    saveDraft(points);
  }

  // ---------- Кнопки ----------
  $('sp-fold').onclick = () => {
    const body = $('sp-body');
    const hide = body.style.display !== 'none';
    body.style.display = hide ? 'none' : '';
    $('sp-fold').textContent = hide ? 'Розгорнути' : 'Згорнути';
  };
  panel.querySelectorAll('input[name=sp-mode]').forEach(r => { r.onchange = () => { mode = r.value; }; });
  $('sp-step').onchange = e => { step = parseFloat(e.target.value); };
  $('sp-add').onclick = () => {
    const t = three.controls.target;
    points.push([+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2)]);
    sel = points.length - 1;
    refreshAll();
  };
  $('sp-del').onclick = () => {
    if (sel < 0) return;
    points.splice(sel, 1);
    refreshAll();
  };
  $('sp-clear').onclick = () => {
    if (!points.length || !confirm('Видалити всі точки?')) return;
    points = [];
    sel = -1;
    refreshAll();
  };
  $('sp-reset').onclick = () => {
    if (!confirm('Замінити чернетку точками з slots-config.js?')) return;
    points = SLOTS.map(p => [...p]);
    sel = points.length ? 0 : -1;
    refreshAll();
  };
  $('sp-focus').onclick = () => {
    if (sel < 0) return;
    three.controls.target.set(...points[sel]);
    three.controls.update();
  };
  $('sp-home').onclick = () => {
    three.controls.target.copy(homeTarget);
    three.controls.update();
  };
  $('sp-copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('sp-out').value); }
    catch { $('sp-out').select(); document.execCommand('copy'); }
  };

  // ---------- Клік по сцені (відрізняємо від перетягування) ----------
  let down = null;
  dom.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  dom.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, three.camera);

    const treeHit = ray.intersectObject(three.tree, true)[0];
    const markerHit = ray.intersectObjects(markers.children, false)[0];

    // Маркер вибираємо, якщо він не прихований за поверхнею ялинки
    if (markerHit && (!treeHit || markerHit.distance <= treeHit.distance + 0.3)) {
      select(markerHit.object.userData.i);
      return;
    }
    if (!treeHit) return;

    const n = treeHit.face.normal.clone().transformDirection(treeHit.object.matrixWorld);
    if (n.dot(ray.ray.direction) > 0) n.negate();   // нормаль має дивитись до камери
    const p = treeHit.point.clone().addScaledVector(n, OFFSET);
    const pt = [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];

    if (mode === 'move' && sel >= 0) {
      points[sel] = pt;
    } else {
      points.push(pt);
      sel = points.length - 1;
    }
    refreshAll();
  });

  refreshAll();
}