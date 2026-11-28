// MVP-редактор прикраси: кнопка + вікно з формою (CREATE-01…03, 06, 07, 08, ORN-02…06).
import { createOrnament, friendlyError } from './supabase.js';
import { PATTERNS, drawPattern } from './patterns.js';

const COLORS = ['#d62839', '#f77f00', '#fcbf49', '#2a9d8f', '#3a86ff', '#8338ec', '#ff5fa2', '#f1f1f1'];
const PATTERN_COLORS = ['#ffffff', '#fcbf49', '#1d3557', '#d62839', '#2a9d8f', '#111111'];
const PREVIEW = 192, PREVIEW_CELL = 24;   // 8 клітинок

export function initEditor({ onCreated }) {
  const btn = document.createElement('button');
  btn.id = 'create-btn';
  btn.className = 'hidden';
  btn.textContent = '🎄 Створити прикрасу';

  const modal = document.createElement('div');
  modal.id = 'editor';
  modal.className = 'hidden';
  modal.innerHTML = `
    <form id="ed-form" autocomplete="off">
      <h2>Нова прикраса</h2>
      <canvas id="ed-preview" width="${PREVIEW}" height="${PREVIEW}"></canvas>
      <label>Ім'я <input id="ed-first" required maxlength="50"></label>
      <label>Прізвище <input id="ed-last" required maxlength="50"></label>
      <label>Група <input id="ed-group" required maxlength="30"></label>
      <label>Коментар (необов'язково) <textarea id="ed-comment" maxlength="200" rows="2"></textarea></label>
      <div class="ed-label">Колір кульки</div>
      <div id="ed-colors" class="palette"></div>
      <div class="ed-label">Орнамент</div>
      <div id="ed-pat" class="dd">
        <button type="button" id="ed-pat-btn" class="dd-item"></button>
        <div id="ed-pat-list" class="hidden"></div>
      </div>
      <div id="ed-pcolor-wrap" class="hidden">
        <div class="ed-label">Колір орнаменту</div>
        <div id="ed-pcolors" class="palette"></div>
      </div>
      <label class="ed-check">
        <input type="checkbox" id="ed-agree" required>
        <span>Розумію, що ім'я, прізвище, група й коментар будуть видимі всім відвідувачам сайту.</span>
      </label>
      <div id="ed-error" class="hidden"></div>
      <div class="ed-buttons">
        <button type="button" id="ed-cancel">Скасувати</button>
        <button type="submit" id="ed-submit">Опублікувати</button>
      </div>
    </form>`;
  document.body.append(btn, modal);

  const $ = id => modal.querySelector('#' + id);
  let color = COLORS[0];
  let patternId = null;            // null = без орнаменту
  let pcolor = PATTERN_COLORS[0];

  // ---------- Малювання ----------
  function paintSwatch(g, size, cell, id) {
    if (id) drawPattern(g, size, size, id, color, pcolor, cell);
    else { g.fillStyle = color; g.fillRect(0, 0, size, size); }
  }

  function paintPreview() {
    const g = $('ed-preview').getContext('2d');
    paintSwatch(g, PREVIEW, PREVIEW_CELL, patternId);
    const grad = g.createRadialGradient(67, 58, 0, 67, 58, 75);
    grad.addColorStop(0, 'rgba(255,255,255,.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, PREVIEW, PREVIEW);
  }

  // ---------- Палітри ----------
  function makePalette(container, colors, get, set) {
    const custom = document.createElement('input');
    custom.type = 'color';
    colors.forEach(c => {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'sw';
      s.dataset.c = c;
      s.style.background = c;
      s.onclick = () => set(c);
      container.appendChild(s);
    });
    custom.oninput = () => set(custom.value);
    container.appendChild(custom);
    return () => {
      custom.value = get();
      container.querySelectorAll('.sw').forEach(s => s.classList.toggle('sel', s.dataset.c === get()));
    };
  }
  const syncColor = makePalette($('ed-colors'), COLORS, () => color, c => { color = c; refresh(); });
  const syncPColor = makePalette($('ed-pcolors'), PATTERN_COLORS, () => pcolor, c => { pcolor = c; refresh(); });

  // ---------- Випадний список орнаментів (з іконками) ----------
  const ddBtn = $('ed-pat-btn');
  const ddList = $('ed-pat-list');

  function makeItem(id, name) {
    const icon = document.createElement('canvas');
    icon.width = icon.height = 32;
    icon.className = 'dd-icon';
    paintSwatch(icon.getContext('2d'), 32, 8, id);
    const label = document.createElement('span');
    label.textContent = name;
    return [icon, label];
  }

  function renderDropdown() {
    // поточний вибір
    const [ci, cl] = makeItem(patternId, patternId ? PATTERNS.find(p => p.id === patternId).name : 'Без орнаменту');
    const arrow = document.createElement('span');
    arrow.textContent = '▾';
    arrow.className = 'dd-arrow';
    ddBtn.replaceChildren(ci, cl, arrow);

    // варіанти
    ddList.replaceChildren();
    [{ id: null, name: 'Без орнаменту' }, ...PATTERNS].forEach(p => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'dd-item' + (p.id === patternId ? ' sel' : '');
      item.append(...makeItem(p.id, p.name));
      item.onclick = () => {
        patternId = p.id;
        ddList.classList.add('hidden');
        refresh();
      };
      ddList.appendChild(item);
    });
  }

  ddBtn.onclick = () => ddList.classList.toggle('hidden');
  modal.addEventListener('pointerdown', e => {
    if (!e.target.closest('#ed-pat')) ddList.classList.add('hidden');
  });

  function refresh() {
    syncColor();
    syncPColor();
    $('ed-pcolor-wrap').classList.toggle('hidden', !patternId);
    paintPreview();
    renderDropdown();
  }
  refresh();

  // ---------- Відкриття / закриття ----------
  function open() {
    $('ed-error').classList.add('hidden');
    modal.classList.remove('hidden');
    $('ed-first').focus();
  }
  function close() { modal.classList.add('hidden'); }

  btn.onclick = open;
  $('ed-cancel').onclick = close;
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  // ---------- Відправка ----------
  $('ed-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fields = {
      first_name: $('ed-first').value.trim(),
      last_name: $('ed-last').value.trim(),
      group_name: $('ed-group').value.trim(),
      comment: $('ed-comment').value.trim() || null,
      shape: 'ball',
      background_color: color,
      pattern: patternId,
      pattern_color: patternId ? pcolor : null,
    };
    if (!fields.first_name || !fields.last_name || !fields.group_name) {
      return showErr('Заповніть ім\'я, прізвище та групу.');
    }
    const submit = $('ed-submit');
    submit.disabled = true;
    submit.textContent = 'Збереження…';
    try {
      const row = await createOrnament(fields);
      close();
      $('ed-form').reset();
      color = COLORS[0];
      patternId = null;
      pcolor = PATTERN_COLORS[0];
      refresh();
      onCreated(row);
    } catch (err) {
      console.error(err);
      showErr(friendlyError(err));
    } finally {
      submit.disabled = false;
      submit.textContent = 'Опублікувати';
    }
  });

  function showErr(text) {
    const el = $('ed-error');
    el.textContent = text;
    el.classList.remove('hidden');
  }

  /** Показує або ховає кнопку «Створити прикрасу» */
  return { setAvailable: on => btn.classList.toggle('hidden', !on) };
}