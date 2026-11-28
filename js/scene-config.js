// Налаштування 3D-сцени. Ключі Supabase та дати лишаються в config.js.

// Два файли, зібрані в Blender в одному масштабі та в одних координатах (ялинка в центрі, підлога на y = 0).
export const MODELS = {
  tree:  './models/tree.glb',   // ялинка (+ порожні об'єкти slot_01, slot_02… для прикрас)
  scene: './models/scene.glb',  // підлога, стіни, килим, подарунки, меблі
};

export const MODEL_SCALE = 1;   // множник для ОБОХ файлів (1 = як у Blender, 1 одиниця = 1 м)

export const CAMERA = { min: 3, max: 14 };  // найближча й найдальша відстань камери (м)

export const LIGHT_SCALE = 1;   // яскравість світла з коду. 0 — вимкнути (якщо світло запечене в текстури)
export const TONE_MAPPING = true; // наближає кольори до Blender (Filmic)

// Сніг: count — кількість сніжинок (на малих екранах вдвічі менше), area — радіус, height — висота падіння
export const SNOW = { count: 900, area: 11, height: 12 };

export const ORNAMENT_RADIUS = 0.12;  // радіус кульки в метрах (було 0.2). Міняйте тут
