-- Выполни это в Supabase: SQL Editor -> New query

-- 1) Таблица profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  balance bigint not null default 5000,
  created_at timestamptz not null default now()
);

-- 2) Включаем RLS
alter table public.profiles enable row level security;

-- 3) Таблица админов (заполняешь вручную в SQL Editor одним insert)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Пользователь может видеть только свою запись админа (для проверки "я админ?")
drop policy if exists "admins_select_own" on public.admins;
create policy "admins_select_own"
on public.admins
for select
to authenticated
using (user_id = auth.uid());

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

-- 4) Политики profiles:
-- - обычный пользователь: видит только себя
-- - админ: видит всех
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

-- Обновлять profiles может только админ (например менять balance)
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 5) Триггер: автосоздание профиля после регистрации
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
