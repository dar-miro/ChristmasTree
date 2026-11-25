// Усі налаштування проєкту в одному місці.

// Supabase: Project Settings → API. Publishable (anon) ключ можна тримати в коді,
// безпеку забезпечують політики RLS (sql/schema.sql). service_role сюди НЕ вставляти.
export const SUPABASE_URL = 'https://grwyjjczjnkueujsthah.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_3ZCONcC9I0AG8lyAxj0FmA_27vpQt2G';

// 3D
export const MODEL_URL = './models/tree.glb';
export const TREE_HEIGHT = 6;

// Період активності (київський час, UTC+2 взимку): 1–6 грудня 2026 включно.
// Має збігатися з датами в sql/schema.sql.
export const PERIOD_START = new Date('2026-12-01T00:00:00+02:00');
export const PERIOD_END   = new Date('2026-12-07T00:00:00+02:00');
