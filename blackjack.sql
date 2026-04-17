-- Blackjack Tables for Supabase

-- 1) Blackjack Rooms
create table if not exists public.blackjack_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting', -- 'waiting', 'playing', 'finished'
  min_bet bigint not null default 10,
  max_players int not null default 5,
  current_players int not null default 1,
  deck text, -- JSON array of shuffled deck
  dealer_hand text, -- JSON array of cards
  dealer_score int,
  round_number int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blackjack_rooms enable row level security;

-- RLS: Anyone authenticated can read rooms (except finished ones older than 1 hour)
drop policy if exists "rooms_select" on public.blackjack_rooms;
create policy "rooms_select"
on public.blackjack_rooms
for select
to authenticated
using (true);

-- RLS: Host can delete/update
drop policy if exists "rooms_update" on public.blackjack_rooms;
create policy "rooms_update"
on public.blackjack_rooms
for update
to authenticated
using (host_id = auth.uid());

drop policy if exists "rooms_delete" on public.blackjack_rooms;
create policy "rooms_delete"
on public.blackjack_rooms
for delete
to authenticated
using (host_id = auth.uid());

-- 2) Blackjack Players (each user in a room)
create table if not exists public.blackjack_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.blackjack_rooms(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  bet bigint not null default 0,
  hand text not null default '[]', -- JSON array of cards
  score int not null default 0,
  status text not null default 'active', -- 'active', 'stand', 'bust', 'blackjack', 'waiting'
  result text, -- 'win', 'lose', 'push', null
  winnings bigint not null default 0,
  seat_position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blackjack_players enable row level security;

-- RLS: Players can see their own games and room games they're in
drop policy if exists "players_select" on public.blackjack_players;
create policy "players_select"
on public.blackjack_players
for select
to authenticated
using (player_id = auth.uid() or exists (
  select 1 from public.blackjack_players bp2
  where bp2.room_id = blackjack_players.room_id and bp2.player_id = auth.uid()
));

-- RLS: Players can update their own rows
drop policy if exists "players_update" on public.blackjack_players;
create policy "players_update"
on public.blackjack_players
for update
to authenticated
using (player_id = auth.uid());

-- 3) Blackjack History (for analytics)
create table if not exists public.blackjack_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid references public.blackjack_rooms(id) on delete set null,
  bet bigint not null,
  winnings bigint not null,
  result text not null, -- 'win', 'lose', 'push'
  profit bigint not null,
  created_at timestamptz not null default now()
);

alter table public.blackjack_history enable row level security;

-- RLS: Players see only their own history
drop policy if exists "history_select" on public.blackjack_history;
create policy "history_select"
on public.blackjack_history
for select
to authenticated
using (player_id = auth.uid());

grant all on public.blackjack_rooms to authenticated;
grant all on public.blackjack_players to authenticated;
grant all on public.blackjack_history to authenticated;

-- RPC Function: Get available blackjack rooms
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
