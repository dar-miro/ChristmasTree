// Правила доступу на стороні інтерфейсу (кнопки, повідомлення).
// УВАГА: це лише зручність для користувача. Справжній захист — політики RLS у sql/schema.sql.
import { PERIOD_START, PERIOD_END } from './config.js';

/** 'before' — ще не почався, 'active' — триває, 'ended' — режим перегляду (ACCESS-05) */
export function getPeriodState(now = new Date()) {
  if (now < PERIOD_START) return 'before';
  if (now >= PERIOD_END) return 'ended';
  return 'active';
}

/** CREATE-09 + 2.6: створювати можна лише в період активності й лише якщо прикраси ще немає */
export function canCreate(periodState, myOrnament) {
  return periodState === 'active' && !myOrnament;
}

/** ACCESS-01…03: власну — завжди, чужу — лише адміністратор.
 *  Видалення дозволене і в режимі перегляду, якщо так вирішить команда;
 *  щоб заборонити — додайте перевірку periodState у цю функцію та в політику БД. */
export function canDelete(ornament, user, isAdmin) {
  if (!user) return false;
  return isAdmin || ornament.user_id === user.id;
}

export function findMyOrnament(ornaments, user) {
  return user ? ornaments.find(o => o.user_id === user.id) || null : null;
}
