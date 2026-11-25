-- Виконати в Supabase → SQL Editor.
-- Дати періоду мають збігатися з js/config.js (київський час, UTC+2).

create table ornaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 50),
  last_name  text not null check (char_length(last_name)  between 1 and 50),
  group_name text not null check (char_length(group_name) between 1 and 30),
  comment text check (char_length(comment) <= 200),
  shape text not null default 'ball'
    check (shape in ('ball','star','heart','bell','gift')),
  background_color text not null check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  pattern text check (char_length(pattern) <= 30),
  pattern_color text check (pattern_color ~ '^#[0-9a-fA-F]{6}$'),
  texture_url text check (char_length(texture_url) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id)                                   -- CREATE-09
);

create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table ornaments enable row level security;
alter table admins enable row level security;

-- Перегляд: усі
create policy "ornaments read" on ornaments for select using (true);

-- Створення: лише свою, лише в період активності (ACCESS-05)
create policy "ornaments insert" on ornaments for insert to authenticated
  with check (
    user_id = auth.uid()
    and now() >= timestamptz '2026-12-01 00:00:00+02'
    and now() <  timestamptz '2026-12-07 00:00:00+02'
  );

-- Видалення: свою або будь-яку для адміністратора (ACCESS-01…03)
create policy "ornaments delete" on ornaments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from admins a where a.user_id = auth.uid())
  );

-- Оновлення не дозволене нікому (політики update немає)

-- Користувач бачить лише власний рядок у admins
create policy "admins read self" on admins for select to authenticated
  using (user_id = auth.uid());

-- Призначити адміністратора (підставте UID з Authentication → Users):
-- insert into admins (user_id) values ('UID');
