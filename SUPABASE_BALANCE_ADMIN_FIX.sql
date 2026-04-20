-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR (one-time)
-- Fixes:
-- - balances not updating for users (RLS)
-- - admin panel can't see/edit other users
-- ============================================================

-- Admins table (add your user id row if needed)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins disable row level security;

-- Admin check (used by RLS policies + admin RPC)
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

  execute 'select exists(select 1 from public.admins where user_id = $1)' into ok using uid;
  return ok;
exception when undefined_column then
  -- Back-compat (if someone created admins(id) by mistake earlier)
  begin
    execute 'select exists(select 1 from public.admins where id = $1)' into ok using uid;
    return ok;
  exception when undefined_column then
    return false;
  end;
end;
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- Ensure profiles table has RLS enabled + correct policies
alter table public.profiles enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own_or_admin') then
    execute 'drop policy profiles_select_own_or_admin on public.profiles';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own_or_admin') then
    execute 'drop policy profiles_update_own_or_admin on public.profiles';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_self') then
    execute 'drop policy profiles_insert_self on public.profiles';
  end if;

  execute $p$
    create policy profiles_select_own_or_admin
    on public.profiles
    for select
    to authenticated
    using (id = auth.uid() or public.is_admin())
  $p$;

  execute $p$
    create policy profiles_update_own_or_admin
    on public.profiles
    for update
    to authenticated
    using (id = auth.uid() or public.is_admin())
    with check (id = auth.uid() or public.is_admin())
  $p$;

  execute $p$
    create policy profiles_insert_self
    on public.profiles
    for insert
    to authenticated
    with check (id = auth.uid() or public.is_admin())
  $p$;
end $$;

-- Keep grants minimal (RLS still applies)
grant select, insert, update on public.profiles to authenticated;

-- Admin RPC (lets admin panel see/edit everyone even with RLS)
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

-- ============================================================
-- After running:
-- 1) Add your user to admins:
--    insert into public.admins (user_id) values ('YOUR-UUID-HERE') on conflict do nothing;
-- 2) Refresh `admin.html`
-- ============================================================

