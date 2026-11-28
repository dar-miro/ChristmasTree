// Панель підбору світла (відкривається за адресою з ?light).
const TONES = ['None', 'Linear', 'Reinhard', 'Cineon', 'ACES', 'AgX'];

export function enableLightPanel(three) {
  const cfg = three.lightCfg;

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:8px;top:48px;z-index:10;width:270px;max-height:75vh;overflow:auto;' +
    'background:rgba(0,0,0,.8);color:#fff;padding:8px;border-radius:10px;font:12px system-ui';
  document.body.appendChild(panel);

  const out = document.createElement('textarea');
  out.readOnly = true;
  out.style.cssText = 'width:100%;height:120px;box-sizing:border-box;font:11px monospace;margin-top:6px';

  function apply() {
    three.applyLights();
    out.value = 'export const LIGHTS = ' + JSON.stringify(cfg, null, 2) + ';\n';
  }

  function section(title) {
    const d = document.createElement('div');
    d.style.cssText = 'border-top:1px solid #555;margin-top:6px;padding-top:4px';
    d.innerHTML = `<b>${title}</b>`;
    panel.appendChild(d);
    return d;
  }
  function row(parent, label, input, extra) {
    const r = document.createElement('label');
    r.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0';
    const t = document.createElement('span');
    t.textContent = label;
    t.style.cssText = 'width:80px;flex:none';
    r.append(t, input);
    if (extra) r.append(extra);
    parent.appendChild(r);
  }
  function slider(parent, label, obj, key, min, max, step) {
    const i = document.createElement('input');
    i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = obj[key];
    i.style.cssText = 'flex:1;min-width:0';
    const v = document.createElement('span');
    v.style.cssText = 'width:36px;text-align:right';
    v.textContent = obj[key];
    i.oninput = () => { obj[key] = parseFloat(i.value); v.textContent = obj[key]; apply(); };
    row(parent, label, i, v);
  }
  function color(parent, label, obj, key) {
    const i = document.createElement('input');
    i.type = 'color'; i.value = obj[key];
    i.oninput = () => { obj[key] = i.value; apply(); };
    row(parent, label, i);
  }
  function check(parent, label, obj, key) {
    const i = document.createElement('input');
    i.type = 'checkbox'; i.checked = obj[key];
    i.onchange = () => { obj[key] = i.checked; apply(); };
    row(parent, label, i);
  }

  // Загальне
  const g = section('Загальне');
  slider(g, 'Експозиція', cfg, 'exposure', 0.2, 3, 0.05);
  const sel = document.createElement('select');
  TONES.forEach(n => sel.add(new Option(n, n, false, n === cfg.toneMapping)));
  sel.onchange = () => { cfg.toneMapping = sel.value; apply(); };
  row(g, 'Тон-мапінг', sel);
  color(g, 'Фон', cfg, 'background');

  // Джерела
  const names = { hemi: 'Загальне (hemi)', sun: 'Сонце (тіні)', fill: 'Заповнювальне', rim: 'Контрове ззаду', lamp: 'Лампа (тепла)' };
  for (const key of ['hemi', 'sun', 'fill', 'rim', 'lamp']) {
    const o = cfg[key];
    const s = section(names[key]);
    check(s, 'Увімкнено', o, 'on');
    slider(s, 'Яскравість', o, 'intensity', 0, key === 'lamp' ? 60 : 6, 0.05);
    color(s, key === 'hemi' ? 'Колір неба' : 'Колір', o, 'color');
    if (key === 'hemi') color(s, 'Колір низу', o, 'ground');
    if (o.x !== undefined) {
      slider(s, 'X', o, 'x', -15, 15, 0.5);
      slider(s, 'Y', o, 'y', 0, 20, 0.5);
      slider(s, 'Z', o, 'z', -15, 15, 0.5);
    }
    if (key === 'sun') check(s, 'Тіні', o, 'shadows');
  }

  const b = document.createElement('button');
  b.textContent = 'Копіювати конфіг';
  b.style.marginTop = '6px';
  b.onclick = async () => {
    try { await navigator.clipboard.writeText(out.value); }
    catch { out.select(); document.execCommand('copy'); }
  };
  panel.append(b, out);
  apply();
}