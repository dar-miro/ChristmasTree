// MVP-редактор прикраси: кнопка + вікно з формою (CREATE-01…03, 06, 07, 08).
import { createOrnament, friendlyError } from './supabase.js';

const COLORS = ['#d62839', '#f77f00', '#fcbf49', '#2a9d8f', '#3a86ff', '#8338ec', '#ff5fa2', '#f1f1f1'];

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
      <div id="ed-preview"></div>
      <label>Ім'я <input id="ed-first" required maxlength="50"></label>
      <label>Прізвище <input id="ed-last" required maxlength="50"></label>
      <label>Група <input id="ed-group" required maxlength="30"></label>
      <label>Коментар (необов'язково) <textarea id="ed-comment" maxlength="200" rows="2"></textarea></label>
      <div class="ed-label">Колір</div>
      <div id="ed-colors"></div>
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

  // Палітра + власний колір
  const palette = $('ed-colors');
  const custom = document.createElement('input');
  custom.type = 'color';
  custom.value = color;
  function setColor(c) {
    color = c;
    custom.value = c;
    $('ed-preview').style.background =
      `radial-gradient(circle at 35% 30%, #ffffffaa 0, transparent 35%), ${c}`;
    palette.querySelectorAll('.sw').forEach(s => s.classList.toggle('sel', s.dataset.c === c));
  }
  COLORS.forEach(c => {
    const s = document.createElement('button');
    s.type = 'button';
    s.className = 'sw';
    s.dataset.c = c;
    s.style.background = c;
    s.onclick = () => setColor(c);
    palette.appendChild(s);
  });
  custom.oninput = () => setColor(custom.value);
  palette.appendChild(custom);
  setColor(color);

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

  $('ed-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fields = {
      first_name: $('ed-first').value.trim(),
      last_name: $('ed-last').value.trim(),
      group_name: $('ed-group').value.trim(),
      comment: $('ed-comment').value.trim() || null,
      shape: 'ball',
      background_color: color,
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
      setColor(COLORS[0]);
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