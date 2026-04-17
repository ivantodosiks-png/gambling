-- Выполни это в Supabase: SQL Editor -> New query

-- 1) Таблица profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text,
  balance bigint not null default 5000,
  created_at timestamptz not null default now()
);

-- If table already exists from earlier runs
alter table public.profiles add column if not exists username text;

-- 2) Отключаем RLS для простоты (как в других таблицах)
alter table public.profiles disable row level security;

-- 3) Таблица админов (заполняешь вручную в SQL Editor одним insert)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins disable row level security;

-- Функция-проверка: админ ли текущий пользователь
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;

-- 4) Триггер: автосоздание профиля после регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 6) Maintenance mode (admin toggle)
-- Public can READ only the 'maintenance' row (so even logged-out users can see the banner).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Ensure the row exists
insert into public.app_settings (key, value)
values ('maintenance', jsonb_build_object('enabled', false, 'message', ''))
on conflict (key) do nothing;

-- Anyone (anon + authenticated) can read only maintenance row
drop policy if exists "app_settings_select_maintenance" on public.app_settings;
create policy "app_settings_select_maintenance"
on public.app_settings
for select
to anon, authenticated
using (key = 'maintenance');

-- Only admins can insert/update settings
drop policy if exists "app_settings_admin_write" on public.app_settings;
create policy "app_settings_admin_write"
on public.app_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 7) Leaderboard (public read) via SECURITY DEFINER RPC (does not expose emails)
create or replace function public.get_leaderboard(p_limit integer default 50)
returns table (
  id uuid,
  username text,
  balance bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.balance, p.created_at
  from public.profiles p
  where p.username is not null and length(trim(p.username)) > 0
  order by p.balance desc, p.created_at asc
  limit least(greatest(p_limit, 1), 200);
$$;

grant execute on function public.get_leaderboard(integer) to anon, authenticated;
