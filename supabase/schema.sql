-- BLACKOUT dedicated Supabase schema
-- Run ONLY in the separate BLACKOUT Supabase project.
create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  character_id text not null default 'recon'
    check (character_id in ('recon','assault','support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,16}$')
);

alter table public.player_profiles enable row level security;

-- Authenticated users can read public operator identities.
drop policy if exists "Profiles are readable by authenticated players" on public.player_profiles;
create policy "Profiles are readable by authenticated players"
on public.player_profiles for select to authenticated using (true);

-- Players may update only their own operator profile.
drop policy if exists "Players update their own profile" on public.player_profiles;
create policy "Players update their own profile"
on public.player_profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.create_player_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := new.raw_user_meta_data ->> 'username';
  if requested_username is null or requested_username !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'A valid player username is required';
  end if;

  insert into public.player_profiles (id, username)
  values (new.id, requested_username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_blackout on auth.users;
create trigger on_auth_user_created_blackout
after insert on auth.users
for each row execute procedure public.create_player_profile();

-- Updated timestamp maintained by Postgres.
create or replace function public.set_player_profile_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_profiles_updated_at on public.player_profiles;
create trigger player_profiles_updated_at
before update on public.player_profiles
for each row execute procedure public.set_player_profile_updated_at();

-- Multiplayer presence/rooms will be added in Stage 3.
