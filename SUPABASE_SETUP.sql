-- ============================================================
-- ВЫПОЛНИТЕ ВСЕ СТРОКИ НИЖЕ В SUPABASE SQL EDITOR!
-- ============================================================

-- ВАЖНО: НЕ запускайте DROP-ы повторно на проде — так вы удалите все данные.
-- Если нужно полностью сбросить таблицы, используйте отдельный файл `SUPABASE_RESET.sql`.

-- ============ PROFILES TABLE ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  balance bigint not null default 5000,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists balance bigint not null default 5000;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles disable row level security;

-- ============ BLACKJACK ROOMS ============
create table if not exists public.blackjack_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting',
  min_bet bigint not null default 10,
  max_players int not null default 5,
  current_players int not null default 1,
  deck text,
  dealer_hand text,
  dealer_score int,
  round_number int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blackjack_rooms add column if not exists status text not null default 'waiting';
alter table public.blackjack_rooms add column if not exists min_bet bigint not null default 10;
alter table public.blackjack_rooms add column if not exists max_players int not null default 5;
alter table public.blackjack_rooms add column if not exists current_players int not null default 1;
alter table public.blackjack_rooms add column if not exists deck text;
alter table public.blackjack_rooms add column if not exists dealer_hand text;
alter table public.blackjack_rooms add column if not exists dealer_score int;
alter table public.blackjack_rooms add column if not exists round_number int not null default 0;
alter table public.blackjack_rooms add column if not exists created_at timestamptz not null default now();
alter table public.blackjack_rooms add column if not exists updated_at timestamptz not null default now();
alter table public.blackjack_rooms disable row level security;

-- ============ BLACKJACK PLAYERS ============
create table if not exists public.blackjack_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.blackjack_rooms(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  bet bigint not null default 0,
  hand text not null default '[]',
  score int not null default 0,
  status text not null default 'waiting',
  result text,
  winnings bigint not null default 0,
  seat_position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional: enable direct relation blackjack_players -> profiles for PostgREST embedded selects.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'blackjack_players_player_profile_fkey'
  ) then
    alter table public.blackjack_players
      add constraint blackjack_players_player_profile_fkey
      foreign key (player_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

alter table public.blackjack_players add column if not exists bet bigint not null default 0;
alter table public.blackjack_players add column if not exists hand text not null default '[]';
alter table public.blackjack_players add column if not exists score int not null default 0;
alter table public.blackjack_players add column if not exists status text not null default 'waiting';
alter table public.blackjack_players add column if not exists result text;
alter table public.blackjack_players add column if not exists winnings bigint not null default 0;
alter table public.blackjack_players add column if not exists seat_position int not null default 0;
alter table public.blackjack_players add column if not exists created_at timestamptz not null default now();
alter table public.blackjack_players add column if not exists updated_at timestamptz not null default now();
alter table public.blackjack_players disable row level security;

-- Keep blackjack_rooms.current_players in sync and auto-delete empty rooms.
create or replace function public.bj_sync_room_player_count()
returns trigger
language plpgsql
as $$
declare
  rid uuid;
  cnt int;
begin
  rid := coalesce(new.room_id, old.room_id);
  if rid is null then
    return null;
  end if;

  select count(*)::int into cnt
  from public.blackjack_players
  where room_id = rid;

  if cnt <= 0 then
    delete from public.blackjack_rooms where id = rid;
  else
    update public.blackjack_rooms
    set current_players = cnt,
        updated_at = now()
    where id = rid;
  end if;

  return null;
end;
$$;

drop trigger if exists bj_players_after_insert on public.blackjack_players;
create trigger bj_players_after_insert
after insert on public.blackjack_players
for each row execute procedure public.bj_sync_room_player_count();

drop trigger if exists bj_players_after_delete on public.blackjack_players;
create trigger bj_players_after_delete
after delete on public.blackjack_players
for each row execute procedure public.bj_sync_room_player_count();

-- ============ BLACKJACK HISTORY ============
create table if not exists public.blackjack_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid references public.blackjack_rooms(id) on delete set null,
  bet bigint not null,
  winnings bigint not null,
  result text not null,
  profit bigint not null,
  created_at timestamptz not null default now()
);

alter table public.blackjack_history disable row level security;

-- ============ ADMIN / SETTINGS (admin.html + maintenance.js) ============
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings disable row level security;
grant all on public.app_settings to authenticated, anon;

-- Admins table (add your user id here via SQL Editor if needed).
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins disable row level security;

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ok boolean := false;
begin
  if uid is null then
    return false;
  end if;

  if to_regclass('public.admins') is null then
    return false;
  end if;

  begin
    execute 'select exists(select 1 from public.admins where user_id = $1)' into ok using uid;
    return ok;
  exception when undefined_column then
    begin
      execute 'select exists(select 1 from public.admins where id = $1)' into ok using uid;
      return ok;
    exception when undefined_column then
      return false;
    end;
  end;
end;
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- Backfill profiles from existing auth.users (admin-only).
create or replace function public.admin_backfill_profiles()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inserted_count int := 0;
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;

  insert into public.profiles (id, email, balance, created_at)
  select u.id, u.email, 5000, coalesce(u.created_at, now())
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
grant execute on function public.admin_backfill_profiles() to authenticated;

-- ============ PERMISSIONS ============
grant all on public.profiles to authenticated, anon;
grant all on public.blackjack_rooms to authenticated, anon;
grant all on public.blackjack_players to authenticated, anon;
grant all on public.blackjack_history to authenticated, anon;

-- ============ RPC FUNCTION - Get Available Rooms ============
create or replace function get_available_blackjack_rooms(p_limit int default 50)
returns table(
  id uuid,
  host_id uuid,
  status text,
  min_bet bigint,
  max_players int,
  current_players int,
  created_at timestamptz
) language plpgsql stable as $$
begin
  return query
  select
    br.id,
    br.host_id,
    br.status,
    br.min_bet,
    br.max_players,
    br.current_players,
    br.created_at
  from public.blackjack_rooms br
  where br.status = 'waiting'
  order by br.created_at desc
  limit p_limit;
end;
$$;

-- ============ RPC FUNCTION - Get Leaderboard ============
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

-- ============ ADMIN RPC - List users / Set balance (works even if RLS is enabled) ============
create or replace function public.admin_list_profiles(p_limit int default 500)
returns table (
  id uuid,
  email text,
  balance bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;

  return query
  select p.id, p.email, p.balance, p.created_at
  from public.profiles p
  order by p.created_at desc
  limit p_limit;
end;
$$;
grant execute on function public.admin_list_profiles(int) to authenticated;

create or replace function public.admin_set_balance(p_user_id uuid, p_balance bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;
  if p_user_id is null then
    raise exception 'missing user id';
  end if;
  if p_balance is null or p_balance < 0 then
    raise exception 'balance must be >= 0';
  end if;

  update public.profiles
  set balance = p_balance
  where id = p_user_id;
end;
$$;
grant execute on function public.admin_set_balance(uuid, bigint) to authenticated;

-- ============ AUTO CREATE PROFILE ON NEW USER ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, balance)
  values (new.id, new.email, 5000)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ============ BACKFILL EXISTING USERS (SAFE) ============
-- Если таблица profiles пустая, но в auth.users уже есть аккаунты:
insert into public.profiles (id, email, balance, created_at)
select u.id, u.email, 5000, coalesce(u.created_at, now())
from auth.users u
on conflict (id) do nothing;

-- ============ ВСЁ ГОТОВО! ============
-- Теперь:
-- 1. Перезагрузите браузер (Ctrl+R)
-- 2. Откройте вкладку "Multiplayer Blackjack"
-- 3. Создавайте комнаты и играйте!
