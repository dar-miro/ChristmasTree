// Точка входу: збирає сцену, базу даних і права доступу.
import { createTreeScene } from './tree.js';
import { addDecor } from './decor.js';
import { ensureSession, checkIsAdmin, fetchOrnaments, friendlyError } from './supabase.js';
import { getPeriodState, canCreate, findMyOrnament } from './permissions.js';

const $ = id => document.getElementById(id);

// Спільний стан застосунку. Наступні модулі (редактор, прикраси) читатимуть його.
export const state = {
  user: null,
  isAdmin: false,
  ornaments: [],
  periodState: getPeriodState(),
  three: null,
};

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

async function loadData() {
  $('error').classList.add('hidden');
  try {
    state.user = await ensureSession();
    state.isAdmin = await checkIsAdmin(state.user.id);
    state.ornaments = await fetchOrnaments();
    renderCounter();
    hideStatus();
    // Тут з'явиться: відображення state.ornaments на ялинці (TREE-02)
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
  renderPeriodBanner();
  showStatus('Завантаження ялинки…');

  const [modelOk] = await Promise.all([state.three.loadModel(), addDecor(state.three)]);
  if (!modelOk) showStatus('Модель не знайдено — показано тимчасову ялинку');

  await loadData();

  // Перемикання в режим перегляду без перезавантаження сторінки
  setInterval(() => {
    const s = getPeriodState();
    if (s !== state.periodState) { state.periodState = s; renderPeriodBanner(); }
  }, 30_000);
}

$('retry').addEventListener('click', loadData);
init();
