// Взаємодія з прикрасами: наближення (VIEW-01…05), картка, видалення (ACCESS-01…03), вибір місця.
import * as THREE from 'three';
import { RADIUS, getSlots, freeSlotIndexes, makeBall, clearGroup } from './ornaments.js';
import { deleteOrnament, friendlyError } from './supabase.js';
import { canDelete, findMyOrnament } from './permissions.js';

const TAU = Math.PI * 2;
const FOCUS_DIST = RADIUS * 9;        // відстань камери до наближеної прикраси
const MIN_DIST_FOCUS = 0.3;           // мінімальна відстань камери в режимі наближення
const MARKER_SIZE = RADIUS * 3.6;

function ringTexture(stroke, fill) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = fill;
  g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.fill();
  g.lineWidth = 10;
  g.strokeStyle = stroke;
  g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * getCtx() → { user, isAdmin, ornaments }; onDeleted(id) викликається після видалення.
 * Повертає { update, focusOrnament, pickSlot, goHome }.
 */
export function createViewer(three, { getCtx, onDeleted }) {
  const { camera, controls, scene } = three;
  const dom = controls.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  const defaultMin = controls.minDistance;

  let mode = 'view';          // 'view' | 'pick'
  let focusedId = null;
  let focusedRow = null;
  let home = null;            // вигляд до наближення
  let tween = null;
  let hoverGroup = null;
  let pick = null;

  // ---------- DOM ----------
  const card = document.createElement('div');
  card.className = 'orn-card hidden';
  card.innerHTML = `
    <h3 class="oc-name"></h3>
    <div class="oc-group"></div>
    <p class="oc-comment"></p>
    <div class="oc-error hidden"></div>
    <div class="oc-actions">
      <button type="button" class="oc-back">← Повернутися</button>
      <button type="button" class="oc-del hidden"></button>
    </div>`;

  const myBtn = document.createElement('button');
  myBtn.id = 'my-btn';
  myBtn.className = 'hidden';
  myBtn.textContent = '⭐ Моя прикраса';

  const bar = document.createElement('div');
  bar.id = 'pick-bar';
  bar.className = 'hidden';
  bar.innerHTML = `
    <span id="pick-text"></span>
    <button type="button" id="pick-cancel">Скасувати</button>
    <button type="button" id="pick-ok" disabled>Підтвердити місце</button>`;
  document.body.append(card, myBtn, bar);

  const q = s => card.querySelector(s);
  const pickText = bar.querySelector('#pick-text');
  const pickOk = bar.querySelector('#pick-ok');

  // ---------- Допоміжне ----------
  const groupOf = id => three.ornamentsGroup.children.find(g => g.userData.ornament?.id === id);

  function pickRay(e) {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }

  /** Прикраса під курсором (з урахуванням того, що її може закривати ялинка) */
  function ornamentUnderPointer(e) {
    pickRay(e);
    const hit = ray.intersectObjects(three.ornamentsGroup.children, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.ornament) o = o.parent;
    if (!o) return null;
    const t = ray.intersectObject(three.tree, true)[0];
    if (t && t.distance < hit.distance - RADIUS * 1.5) return null;
    return o;
  }

  // ---------- Політ камери ----------
  function flyTo(target, position, onDone) {
    const o0 = camera.position.clone().sub(controls.target);
    const o1 = position.clone().sub(target);
    const s0 = new THREE.Spherical().setFromVector3(o0);
    const s1 = new THREE.Spherical().setFromVector3(o1);
    let dTheta = s1.theta - s0.theta;
    if (dTheta > Math.PI) dTheta -= TAU;
    if (dTheta < -Math.PI) dTheta += TAU;
    tween = { t: 0, dur: 0.85, t0: controls.target.clone(), t1: target.clone(), s0, s1, dTheta, onDone };
    controls.enabled = false;
  }

  const sph = new THREE.Spherical();
  function tweenStep(dt) {
    if (!tween) return;
    tween.t += dt;
    const k = Math.min(tween.t / tween.dur, 1);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    controls.target.lerpVectors(tween.t0, tween.t1, e);
    sph.radius = tween.s0.radius + (tween.s1.radius - tween.s0.radius) * e;
    sph.phi = tween.s0.phi + (tween.s1.phi - tween.s0.phi) * e;
    sph.theta = tween.s0.theta + tween.dTheta * e;
    camera.position.copy(controls.target).add(tmp.setFromSpherical(sph));
    if (k >= 1) {
      const done = tween.onDone;
      tween = null;
      controls.enabled = true;
      if (done) done();
    }
  }

  // ---------- Картка ----------
  function hideCard() { card.classList.add('hidden'); }

  function showCard(row) {
    const { user, isAdmin } = getCtx();
    const mine = !!user && row.user_id === user.id;
    q('.oc-name').textContent = `${row.first_name} ${row.last_name}`;
    q('.oc-group').textContent = `Група: ${row.group_name}` + (mine ? ' · ваша прикраса' : '');
    const cm = q('.oc-comment');
    cm.textContent = row.comment || '';
    cm.classList.toggle('hidden', !row.comment);
    const del = q('.oc-del');
    del.classList.toggle('hidden', !canDelete(row, user, isAdmin));
    del.textContent = mine ? 'Видалити мою прикрасу' : 'Видалити (адмін)';
    q('.oc-error').classList.add('hidden');
    card.classList.remove('hidden');
    placeCard();
  }

  /** Картка стоїть збоку від прикраси (на вузьких екранах — нижня панель через CSS) */
  function placeCard() {
    if (!focusedId || card.classList.contains('hidden')) return;
    if (window.innerWidth < 700) { card.style.left = card.style.top = ''; return; }
    const g = groupOf(focusedId);
    if (!g) return;
    const pos = g.getWorldPosition(tmp);
    const dist = camera.position.distanceTo(pos);
    const p = pos.clone().project(camera);
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    const rPx = (RADIUS / (2 * dist * Math.tan((camera.fov * Math.PI) / 360))) * window.innerHeight;
    const w = card.offsetWidth, h = card.offsetHeight;
    let left = x + rPx + 24;
    if (left + w > window.innerWidth - 12) left = x - rPx - 24 - w;
    left = Math.max(12, left);
    const top = Math.min(Math.max(12, y - h / 2), window.innerHeight - h - 12);
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  // ---------- Наближення / повернення ----------
  function focusGroup(g) {
    const row = g.userData.ornament;
    const target = g.getWorldPosition(new THREE.Vector3());
    if (!home) home = { target: controls.target.clone(), position: camera.position.clone() };

    const c = new THREE.Box3().setFromObject(three.tree).getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(target.x - c.x, 0, target.z - c.z);
    if (dir.lengthSq() < 1e-4) dir.set(camera.position.x - c.x, 0, camera.position.z - c.z);
    dir.normalize();
    const pos = target.clone().addScaledVector(dir, FOCUS_DIST);
    pos.y += FOCUS_DIST * 0.15;

    controls.minDistance = MIN_DIST_FOCUS;
    focusedId = row.id;
    focusedRow = row;
    hideCard();
    flyTo(target, pos, () => { if (focusedId === row.id) showCard(row); });
  }

  function focusOrnament(id) {
    const g = groupOf(id);
    if (g) focusGroup(g);
  }

  function goHome() {
    hideCard();
    focusedId = null;
    focusedRow = null;
    if (!home) return;
    const h = home;
    home = null;
    flyTo(h.target, h.position, () => { controls.minDistance = defaultMin; });
  }

  q('.oc-back').onclick = goHome;

  q('.oc-del').onclick = async () => {
    const row = focusedRow;
    if (!row) return;
    const mine = row.user_id === getCtx().user?.id;
    if (!confirm(mine ? 'Видалити вашу прикрасу з ялинки?' : 'Видалити цю прикрасу (як адміністратор)?')) return;
    const btn = q('.oc-del');
    btn.disabled = true;
    try {
      await deleteOrnament(row.id);
      goHome();
      onDeleted(row.id);
    } catch (err) {
      console.error(err);
      const el = q('.oc-error');
      el.textContent = friendlyError(err);
      el.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  };

  myBtn.onclick = () => {
    const mine = findMyOrnament(getCtx().ornaments, getCtx().user);
    if (mine) focusOrnament(mine.id);
  };

  /** Викликати після кожного перемальовування прикрас */
  function update() {
    hoverGroup = null;
    dom.style.cursor = '';
    const { user, ornaments } = getCtx();
    myBtn.classList.toggle('hidden', !findMyOrnament(ornaments, user));
    if (focusedId && !groupOf(focusedId)) goHome();
  }

  // ---------- Вибір місця ----------
  const texFree = ringTexture('#5ce1ff', 'rgba(92,225,255,0.18)');
  const texSel = ringTexture('#ffe14d', 'rgba(255,225,77,0.22)');

  function selectSlot(i) {
    pick.selected = i;
    clearGroup(pick.holder);
    const ball = makeBall(pick.previewRow);
    ball.position.copy(pick.slots[i].position);
    pick.holder.add(ball);
    pickText.textContent = `Місце №${i + 1}. Можна обрати інше.`;
    pickOk.disabled = false;
  }

  function frontMarkers() { return pick.markers.filter(m => m.userData.front); }

  function pickFrame(t) {
    const c = pick.c;
    for (const m of pick.markers) {
      const vx = m.position.x - c.x, vz = m.position.z - c.z;
      const dot = vx * (camera.position.x - c.x) + vz * (camera.position.z - c.z);
      m.userData.front = dot > 0 || vx * vx + vz * vz < 0.05;   // з боку камери
      const sel = m.userData.index === pick.selected;
      const map = sel ? texSel : texFree;
      if (m.material.map !== map) m.material.map = map;
      m.material.opacity = m.userData.front ? 1 : 0.22;
      const pulse = 1 + 0.1 * Math.sin(t * 4 + m.userData.index);
      m.scale.setScalar(MARKER_SIZE * pulse * (m === pick.hover ? 1.25 : 1));
    }
  }

  /** Запускає вибір місця. Повертає Promise<індекс місця з 0 | null (скасовано)>. */
  function pickSlot(previewRow) {
    return new Promise(resolve => {
      goHome();
      const slots = getSlots(three);
      const free = freeSlotIndexes(three, getCtx().ornaments);
      const group = new THREE.Group();
      const holder = new THREE.Group();
      group.add(holder);
      scene.add(group);
      const c = new THREE.Box3().setFromObject(three.tree).getCenter(new THREE.Vector3());

      const markers = free.map(i => {
        const m = new THREE.Sprite(new THREE.SpriteMaterial({
          map: texFree, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
        }));
        m.position.copy(slots[i].position);
        m.scale.setScalar(MARKER_SIZE);
        m.renderOrder = 2000;
        m.userData.index = i;
        m.userData.front = true;
        group.add(m);
        return m;
      });

      pick = { markers, selected: null, hover: null, c, slots, previewRow, holder };
      pick.finish = result => {
        markers.forEach(m => m.material.dispose());
        clearGroup(holder);
        scene.remove(group);
        pick = null;
        mode = 'view';
        document.body.classList.remove('picking');
        bar.classList.add('hidden');
        dom.style.cursor = '';
        resolve(result);
      };

      mode = 'pick';
      document.body.classList.add('picking');
      pickText.textContent = free.length
        ? 'Оберіть вільне місце: клікніть по підсвіченому кільцю'
        : 'Вільних місць не залишилось';
      pickOk.disabled = true;
      bar.classList.remove('hidden');
    });
  }

  pickOk.onclick = () => { if (pick && pick.selected !== null) pick.finish(pick.selected); };
  bar.querySelector('#pick-cancel').onclick = () => { if (pick) pick.finish(null); };

  // ---------- Події ----------
  let down = null;
  dom.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  dom.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
    down = null;
    if (moved) return;                       // це було обертання
    if (mode === 'pick') {
      pickRay(e);
      const hit = ray.intersectObjects(frontMarkers(), false)[0];
      if (hit) selectSlot(hit.object.userData.index);
      return;
    }
    const g = ornamentUnderPointer(e);
    if (g) focusGroup(g);
  });

  function setHover(g) {
    if (g === hoverGroup) return;
    if (hoverGroup) hoverGroup.scale.setScalar(1);
    hoverGroup = g;
    if (g) g.scale.setScalar(1.15);
    dom.style.cursor = g ? 'pointer' : '';
  }

  let lastMove = 0;
  dom.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const now = performance.now();
    if (now - lastMove < 80) return;
    lastMove = now;
    if (mode === 'pick') {
      pickRay(e);
      const hit = ray.intersectObjects(frontMarkers(), false)[0];
      pick.hover = hit ? hit.object : null;
      dom.style.cursor = hit ? 'pointer' : '';
      return;
    }
    setHover(ornamentUnderPointer(e));
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (pick) pick.finish(null);
    else if (focusedId) goHome();
  });

  three.onFrame((dt, t) => {
    tweenStep(dt);
    placeCard();
    for (const g of three.ornamentsGroup.children) {
      const gl = g.userData.glow;
      if (gl) gl.material.opacity = 0.75 + 0.25 * Math.sin(t * 3);
    }
    if (pick) pickFrame(t);
  });

  return { update, focusOrnament, pickSlot, goHome };
}