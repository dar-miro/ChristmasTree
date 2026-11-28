// Налаштування світла. Підберіть значення на сайті з ?light, потім вставте сюди результат.
export const LIGHTS = {
  exposure: 1.25,
  toneMapping: 'ACES',        // None | Linear | Reinhard | Cineon | ACES | AgX
  background: '#1b1020',
  hemi: { on: true, intensity: 1.1, color: '#ffffff', ground: '#8f86a3' },
  sun:  { on: true, intensity: 2.4, color: '#fff4e5', x: 5,  y: 10, z: 6,  shadows: true },
  fill: { on: true, intensity: 1.0, color: '#cfe0ff', x: -6, y: 4,  z: 5 },
  rim:  { on: true, intensity: 1.2, color: '#ffffff', x: -3, y: 6,  z: -8 },
  lamp: { on: true, intensity: 12,  color: '#ffb36b', x: -4, y: 3,  z: 4 },
};