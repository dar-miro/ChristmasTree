// Орнаменти: список для випадного списку + малювання на canvas.
// Щоб додати новий: додайте запис у PATTERNS і функцію з таким самим id в DRAW.
// id: лише латиниця/цифри/_ , до 30 символів (зберігається в базі).

export const PATTERNS = [
  { id: 'dots',       name: 'Крапки' },
  { id: 'stripes',    name: 'Смужки' },
  { id: 'checks',     name: 'Шахи' },
  { id: 'stars',      name: 'Зірочки' },
  { id: 'hearts',     name: 'Сердечка' },
  { id: 'snowflakes', name: 'Сніжинки' },
  { id: 'diamonds',   name: 'Ромби' },
  { id: 'waves',      name: 'Хвилі' },
  { id: 'zigzag',     name: 'Зигзаг' },
  { id: 'rings',      name: 'Кільця' },
];

export const PATTERN_IDS = new Set(PATTERNS.map(p => p.id));

const TAU = Math.PI * 2;

/** Обходить клітинки сітки; з offset непарні рядки зсунуті на пів клітинки (шаховий порядок). */
function eachCell(cols, rows, cell, offset, cb) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const shift = offset && r % 2 ? 0 : 0.5;
      cb((c + shift) * cell, (r + 0.5) * cell);
    }
  }
}

function polygon(g, cx, cy, pts) {
  g.beginPath();
  pts.forEach(([dx, dy], i) => (i ? g.lineTo(cx + dx, cy + dy) : g.moveTo(cx + dx, cy + dy)));
  g.closePath();
  g.fill();
}

const DRAW = {
  dots(g, w, h, cell, cols, rows) {
    eachCell(cols, rows, cell, true, (x, y) => { g.beginPath(); g.arc(x, y, cell * 0.18, 0, TAU); g.fill(); });
  },
  stripes(g, w, h, cell, cols, rows) {
    for (let r = 0; r < rows; r++) g.fillRect(0, r * cell + cell * 0.25, w, cell * 0.5);
  },
  checks(g, w, h, cell, cols, rows) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if ((r + c) % 2 === 0) g.fillRect(c * cell, r * cell, cell, cell);
  },
  stars(g, w, h, cell, cols, rows) {
    const R = cell * 0.36, r2 = R * 0.42;
    eachCell(cols, rows, cell, true, (x, y) => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r2 : R;
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      polygon(g, x, y, pts);
    });
  },
  hearts(g, w, h, cell, cols, rows) {
    const r = cell * 0.3;
    eachCell(cols, rows, cell, true, (x, y) => {
      g.beginPath();
      g.moveTo(x, y + r * 0.9);
      g.bezierCurveTo(x + r * 1.3, y + r * 0.1, x + r * 0.6, y - r * 0.9, x, y - r * 0.3);
      g.bezierCurveTo(x - r * 0.6, y - r * 0.9, x - r * 1.3, y + r * 0.1, x, y + r * 0.9);
      g.fill();
    });
  },
  snowflakes(g, w, h, cell, cols, rows) {
    const R = cell * 0.36;
    g.lineWidth = Math.max(1, cell * 0.07);
    eachCell(cols, rows, cell, true, (x, y) => {
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        g.moveTo(x - Math.cos(a) * R, y - Math.sin(a) * R);
        g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      }
      g.stroke();
    });
  },
  diamonds(g, w, h, cell, cols, rows) {
    const r = cell * 0.3;
    eachCell(cols, rows, cell, true, (x, y) => polygon(g, x, y, [[0, -r], [r * 0.75, 0], [0, r], [-r * 0.75, 0]]));
  },
  waves(g, w, h, cell, cols, rows) {
    g.lineWidth = Math.max(1, cell * 0.14);
    for (let r = 0; r < rows; r++) {
      const y0 = (r + 0.5) * cell;
      g.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = y0 + Math.sin((x / cell) * TAU) * cell * 0.2;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  },
  zigzag(g, w, h, cell, cols, rows) {
    g.lineWidth = Math.max(1, cell * 0.14);
    for (let r = 0; r < rows; r++) {
      const y0 = (r + 0.5) * cell;
      g.beginPath();
      for (let x = 0; x <= w; x += cell / 2) {
        const y = y0 + (((x / cell) * 2) % 2 === 0 ? -1 : 1) * cell * 0.2;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  },
  rings(g, w, h, cell, cols, rows) {
    g.lineWidth = Math.max(1, cell * 0.1);
    eachCell(cols, rows, cell, true, (x, y) => { g.beginPath(); g.arc(x, y, cell * 0.28, 0, TAU); g.stroke(); });
  },
};

/**
 * Малює фон + орнамент на canvas-контексті.
 * cell — розмір однієї клітинки в пікселях; w і h мають ділитися на cell, а w/cell — бути парним
 * (тоді візерунок без шва замикається по колу кульки).
 */
export function drawPattern(g, w, h, id, bg, fg, cell) {
  g.save();
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.strokeStyle = fg;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const fn = DRAW[id];
  if (fn) fn(g, w, h, cell, Math.round(w / cell), Math.round(h / cell));
  g.restore();
}