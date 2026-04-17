-- Profiles table - БЕЗ RLS (отключена для простоты)

-- 1) Таблица profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text,
  balance bigint not null default 5000,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;

-- ОТКЛЮЧАЕМ RLS полностью
alter table public.profiles disable row level security;

-- 2) Таблица админов
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

-- 3) Таблица настроек приложения
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings disable row level security;

-- Ensure the row exists
insert into public.app_settings (key, value)
values ('maintenance', jsonb_build_object('enabled', false, 'message', ''))
on conflict (key) do nothing;

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

-- 5) RPC функция для лидерборда
create or replace function public.get_leaderboard(p_limit int default 200)
returns table (
  id uuid,
  username text,
  balance bigint,
  created_at timestamptz
) language plpgsql stable as $$
begin
  return query
  select
    p.id,
    p.username,
    p.balance,
    p.created_at
  from public.profiles p
  where p.username is not null and p.username != ''
  order by p.balance desc
  limit p_limit;
end;
$$;

-- 6) Даём права
grant all on public.profiles to authenticated, anon;
grant all on public.admins to authenticated;
grant all on public.app_settings to authenticated, anon;
grant execute on function public.get_leaderboard to authenticated, anon;
grant execute on function public.is_admin to authenticated, anon;
