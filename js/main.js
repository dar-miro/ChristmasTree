// Точка входу: збирає сцену, базу даних і права доступу.
import { createTreeScene } from './tree.js';
import { addDecor } from './decor.js';
import { renderOrnaments } from './ornaments.js';
import { initEditor } from './editor.js';
import { ensureSession, checkIsAdmin, fetchOrnaments, friendlyError } from './supabase.js';
import { getPeriodState, canCreate, findMyOrnament } from './permissions.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

// Спільний стан застосунку. Наступні модулі (редактор, прикраси) читатимуть його.
export const state = {
  user: null,
  isAdmin: false,
  ornaments: [],
  periodState: getPeriodState(),
  three: null,
};

let editor = null;

function showStatus(text) {
  const el = $('status');
  el.textContent = text;
  el.classList.remove('hidden', 'fade');
}
function hideStatus(delay = 0) {
  setTimeout(() => $('status').classList.add('fade'), delay);
}
function showError(text) {
  $('error-text').textContent = text;
  $('error').classList.remove('hidden');
}
function renderPeriodBanner() {
  const b = $('banner');
  const msgs = {
    before: 'Додавання прикрас розпочнеться 1 грудня.',
    ended: 'Період додавання завершено. Ялинка в режимі перегляду.',
  };
  const msg = msgs[state.periodState];
  b.textContent = msg || '';
  b.classList.toggle('hidden', !msg);
}
function renderCounter() {
  const c = $('counter');
  c.textContent = `Прикрас на ялинці: ${state.ornaments.length}`;
  c.classList.remove('hidden');
}
function redraw() {
  renderCounter();
  renderOrnaments(state.three, state.ornaments); // TREE-02
}
/** Кнопка «Створити прикрасу»: лише в період активності й коли власної прикраси ще немає */
function updateCreateButton() {
  const available = !!state.user &&
    canCreate(state.periodState, findMyOrnament(state.ornaments, state.user));
  editor.setAvailable(available);
}

async function loadData() {
  $('error').classList.add('hidden');
  try {
    state.user = await ensureSession();
    state.isAdmin = await checkIsAdmin(state.user.id);
    state.ornaments = await fetchOrnaments();
    redraw();
    updateCreateButton();
    hideStatus();
    console.log('Користувач:', state.user.id, '| адмін:', state.isAdmin,
      '| може створити:', canCreate(state.periodState, findMyOrnament(state.ornaments, state.user)));
  } catch (e) {
    console.error(e);
    $('status').classList.add('hidden');
    showError(friendlyError(e)); // а не порожня ялинка (розділ 2.6)
  }
}

async function init() {
  state.three = createTreeScene($('scene'));
  editor = initEditor({
    onCreated: row => {
      state.ornaments.push(row);
      redraw();
      updateCreateButton();
    },
  });
  renderPeriodBanner();
  showStatus('Завантаження ялинки…');

  const [treeOk, sceneOk] = await Promise.all([state.three.loadModel(), addDecor(state.three)]);
  const missing = [];
  if (!treeOk) missing.push('models/tree.glb');
  if (!sceneOk) missing.push('models/scene.glb');

  await loadData();
  if (missing.length) showStatus('Не знайдено файли: ' + missing.join(', '));

  // Службові режими: ?edit — розмітка місць, ?light — підбір світла
  if (params.has('edit')) (await import('./slot-picker.js')).enableSlotPicker(state.three);
  if (params.has('light')) (await import('./light-panel.js')).enableLightPanel(state.three);

  // Перемикання в режим перегляду без перезавантаження сторінки
  setInterval(() => {
    const s = getPeriodState();
    if (s !== state.periodState) {
      state.periodState = s;
      renderPeriodBanner();
      updateCreateButton();
    }
  }, 30_000);
}

$('retry').addEventListener('click', loadData);
init();