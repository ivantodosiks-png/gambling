-- ВАЖНО! Выполните ЭТО в Supabase SQL Editor

-- ================================================
-- ШАГИ:
-- 1. Откройте Supabase Dashboard → SQL Editor
-- 2. Создайте NEW QUERY
-- 3. Скопируйте ВСЕ содержимое этого файла
-- 4. Нажмите RUN (зелёная кнопка)
-- 5. Перезагрузите браузер
-- ================================================

-- ============ PROFILES TABLE ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text,
  balance bigint not null default 5000,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
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

alter table public.blackjack_players disable row level security;

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

-- ============ PERMISSIONS ============
grant all on public.profiles to authenticated, anon;
grant all on public.blackjack_rooms to authenticated, anon;
grant all on public.blackjack_players to authenticated, anon;
grant all on public.blackjack_history to authenticated, anon;

-- ============ RPC FUNCTIONS ============
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

-- ============ AUTO CREATE PROFILE ON REGISTRATION ============
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

-- ============ ГОТОВО! ============
-- Теперь перезагрузите браузер и попробуйте создать комнату
