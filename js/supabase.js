// Уся робота з Supabase: клієнт, авторизація, прикраси.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Поля, які клієнт має право надсилати. user_id і id підставляє сама база.
const ALLOWED_FIELDS = [
  'first_name', 'last_name', 'group_name', 'comment',
  'shape', 'background_color', 'pattern', 'pattern_color', 'texture_url', 'slot'
];

/** Перетворює помилку бази на зрозуміле повідомлення. */
export function friendlyError(error) {
  if (!error) return 'Невідома помилка';
  if (error.code === '23505') {
    if ((error.message || '').includes('slot')) return 'Це місце вже зайняте. Оберіть інше.';
    return 'У вас уже є прикраса на ялинці. Видаліть її, щоб створити нову.';
  }
  if (error.code === '42501') return 'Дію заборонено: вона недоступна для вашого облікового запису або поза періодом активності.';
  if (error.code === '23514') return 'Деякі поля заповнені некоректно.';
  if (error.message === 'Failed to fetch') return 'Немає зв’язку з базою даних.';
  return error.message || 'Помилка бази даних';
}

// ---------- Авторизація ----------

/** Варіант А: анонімний обліковий запис створюється при першому відкритті. */
export async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

/** Окремий вхід для адміністраторів (пошта + пароль, акаунт створюється в Supabase Auth). */
export async function signInAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** ACCESS-04: чи є користувач у таблиці admins (бачить лише власний рядок завдяки RLS). */
export async function checkIsAdmin(userId) {
  const { data, error } = await supabase
    .from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

// ---------- Прикраси ----------

export async function fetchOrnaments() {
  const { data, error } = await supabase
    .from('ornaments').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createOrnament(fields) {
  const row = {};
  for (const key of ALLOWED_FIELDS) if (fields[key] !== undefined) row[key] = fields[key];
  const { data, error } = await supabase.from('ornaments').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteOrnament(id) {
  // .select() повертає видалені рядки: якщо порожньо — RLS не дозволила видалення
  const { data, error } = await supabase.from('ornaments').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || data.length === 0) {
    const e = new Error('Немає прав на видалення цієї прикраси');
    e.code = '42501';
    throw e;
  }
}