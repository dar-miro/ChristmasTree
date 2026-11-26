// Усі налаштування проєкту в одному місці.

// Supabase: Project Settings → API. Publishable (anon) ключ можна тримати в коді,
// безпеку забезпечують політики RLS (sql/schema.sql). service_role сюди НЕ вставляти.
export const SUPABASE_URL = 'https://grwyjjczjnkueujsthah.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_3ZCONcC9I0AG8lyAxj0FmA_27vpQt2G';

// 3D
export const MODEL_URL = './models/tree.glb';
export const TREE_HEIGHT = 6;
export const SNOW_COUNT = 1200; // кількість сніжинок (на телефонах зменшується вдвічі)

// Період активності (київський час, UTC+2 взимку): 1–6 грудня 2026 включно.
// Має збігатися з датами в sql/schema.sql.
export const PERIOD_START = new Date('2026-12-01T00:00:00+02:00');
export const PERIOD_END   = new Date('2026-12-07T00:00:00+02:00');

// ---------- Декор сцени ----------
// Кожен елемент можна замінити власною моделлю: покладіть .glb за вказаним шляхом.
// Якщо файлу немає — малюється вбудований варіант. Щоб не бачити 404 у консолі, поставте url: null.
// by: 'width' — масштабувати за шириною, 'height' — за висотою; size — у одиницях сцени
// (ялинка = 6 одиниць заввишки). lift — підняти над підлогою.
export const DECOR = {
  floor: { url: './models/floor.glb', by: 'width', size: 44, lift: 0 },     // паркет
  room:  { url: './models/room.glb',  by: 'width', size: 44, lift: 0 },     // стіни/фон кімнати
  rug:   { url: './models/rug.glb',   by: 'width', size: 8,  lift: 0.01 },  // килим під ялинкою
  gifts: { url: './models/gifts.glb', by: 'width', size: 1,  lift: 0.04 },  // подарунки
};

// Сніг: count — кількість сніжинок (на малих екранах вдвічі менше)
export const SNOW = { count: 900, area: 11, height: 12 };
