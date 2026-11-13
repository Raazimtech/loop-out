-- BLACKOUT Stage 1 database foundation.
-- This migration uses unique blackout_ table/function names inside the already-authorized
-- Supabase project. It does not alter other applications' tables or auth records.
-- The auth trigger only creates a profile for users explicitly tagged app='blackout'.

create table if not exists public.blackout_player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  character_id text not null default 'recon'
    check (character_id in ('recon','assault','support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blackout_username_format check (username ~ '^[A-Za-z0-9_]{3,16}$')
);
alter table public.blackout_player_profiles enable row level security;
drop policy if exists "Blackout profiles readable by authenticated players" on public.blackout_player_profiles;
create policy "Blackout profiles readable by authenticated players"
on public.blackout_player_profiles for select to authenticated using (true);
drop policy if exists "Blackout players update own profile" on public.blackout_player_profiles;
create policy "Blackout players update own profile"
on public.blackout_player_profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);
create or replace function public.blackout_create_player_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare requested_username text;
begin
  if new.raw_user_meta_data ->> 'app' is distinct from 'blackout' then
    return new;
  end if;
  requested_username := new.raw_user_meta_data ->> 'username';
  if requested_username is null or requested_username !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'A valid BLACKOUT callsign is required';
  end if;
  insert into public.blackout_player_profiles (id, username)
  values (new.id, requested_username);
  return new;
end;
$$;
drop trigger if exists blackout_on_auth_user_created on auth.users;
create trigger blackout_on_auth_user_created
after insert on auth.users
for each row execute procedure public.blackout_create_player_profile();
create or replace function public.blackout_set_profile_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists blackout_profile_updated_at on public.blackout_player_profiles;
create trigger blackout_profile_updated_at
before update on public.blackout_player_profiles
for each row execute procedure public.blackout_set_profile_updated_at();
grant select, update on public.blackout_player_profiles to authenticated;
