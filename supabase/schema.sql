-- Trusted Tarot v17 — Supabase schema (Free plan only: Postgres + Auth + Storage, no paid add-ons).
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to re-run.
-- Private by default: every row belongs to one user and row-level security (RLS) hides it from everyone else.
-- Friends only ever see what the owner explicitly shared (table public.shares).

create extension if not exists pgcrypto;

-- ---------- profiles (one per login; username is how friends find each other) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display      text not null default '',
  birth        jsonb,             -- {y,m,d[,hour,minute,tz,lat,lon,place]}; date only for most users
  is_owner     boolean not null default false,   -- Natalie: full natal chart + bots' outbox
  invite_token text not null unique default replace(replace(rtrim(encode(gen_random_bytes(12), 'base64'), '='), '+', '-'), '/', '_'),
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid());
-- users may change display/birth but never username, owner flag or invite token
revoke update on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant update (display, birth) on public.profiles to authenticated;

-- new auth user -> profile (username/display/birth come from the sign-up form's metadata)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare b text := new.raw_user_meta_data->>'birth';
begin
  insert into public.profiles (id, username, display, birth)
  values (new.id,
          lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
          coalesce(nullif(new.raw_user_meta_data->>'display', ''), new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
          case when b ~ '^\d{4}-\d{2}-\d{2}$'
               then jsonb_build_object('y', split_part(b,'-',1)::int, 'm', split_part(b,'-',2)::int, 'd', split_part(b,'-',3)::int)
               else null end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- sign-up form: is a username free? (true/false only; reveals nothing else)
create or replace function public.username_available(p_username text) returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where username = lower(trim(p_username)));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- docs: each user's app data, one JSON document per kind (mirrors the old data files) ----------
--   entries  = journal days (old tarot-journal/entries.json)      guests   = guests + their readings
--   practice = study progress (practice.json)                     outbox   = jobs for the box bots
--   gaps     = missing-orientation questions (gaps.json)
create table if not exists public.docs (
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind       text not null check (kind in ('entries','guests','practice','outbox','gaps')),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.docs enable row level security;
drop policy if exists "own docs" on public.docs;
create policy "own docs" on public.docs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.docs to authenticated;

-- ---------- friends ----------
create table if not exists public.friendships (
  a uuid not null references public.profiles(id) on delete cascade,
  b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b), check (a < b)
);
create table if not exists public.friend_requests (
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id   uuid not null references public.profiles(id) on delete cascade,
  at      timestamptz not null default now(),
  primary key (from_id, to_id), check (from_id <> to_id)
);
create table if not exists public.shares (
  id       text primary key default encode(gen_random_bytes(6), 'hex'),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind     text not null check (kind in ('reading','guest_reading','practice')),
  ref      text not null,
  title    text not null default '',
  payload  jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 60000),
  at       timestamptz not null default now(),
  unique (owner_id, kind, ref)
);
alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;
alter table public.shares enable row level security;

create or replace function public.are_friends(x uuid, y uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.friendships where a = least(x, y) and b = greatest(x, y));
$$;

drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships for select to authenticated using (auth.uid() in (a, b));
drop policy if exists "see own requests" on public.friend_requests;
create policy "see own requests" on public.friend_requests for select to authenticated using (auth.uid() in (from_id, to_id));
drop policy if exists "see own or friends' shares" on public.shares;
create policy "see own or friends' shares" on public.shares for select to authenticated
  using (owner_id = auth.uid() or public.are_friends(owner_id, auth.uid()));
grant select on public.friendships, public.friend_requests, public.shares to authenticated;
-- all changes go through the functions below (same rules as the old accounts.py)

create or replace function public._pub(p uuid) returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object('username', username, 'display', coalesce(nullif(display, ''), username)) from public.profiles where id = p;
$$;
revoke execute on function public._pub(uuid) from public, anon, authenticated;

create or replace function public._befriend(x uuid, y uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.friend_requests where (from_id = x and to_id = y) or (from_id = y and to_id = x);
  insert into public.friendships (a, b) values (least(x, y), greatest(x, y)) on conflict do nothing;
end $$;
revoke execute on function public._befriend(uuid, uuid) from public, anon, authenticated;

create or replace function public.social_me() returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'user', public._pub(auth.uid()),
    'friends', coalesce((select jsonb_agg(public._pub(case when a = auth.uid() then b else a end) order by 1)
                         from public.friendships where auth.uid() in (a, b)), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(public._pub(from_id)) from public.friend_requests where to_id = auth.uid()), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(public._pub(to_id)) from public.friend_requests where from_id = auth.uid()), '[]'::jsonb),
    'invite', (select invite_token from public.profiles where id = auth.uid()),
    'mine', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'ref', ref)) from public.shares where owner_id = auth.uid()), '[]'::jsonb));
$$;

create or replace function public.social_feed() returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) from (
    select jsonb_build_object('id', s.id, 'kind', s.kind, 'ref', s.ref, 'title', s.title, 'payload', s.payload,
                              'at', to_char(s.at at time zone 'America/Los_Angeles', 'YYYY-MM-DD"T"HH24:MI:SS'),
                              'owner', public._pub(s.owner_id)) as x
    from public.shares s where public.are_friends(s.owner_id, auth.uid())
    order by s.at desc limit 100) q;
$$;

create or replace function public.social_request(p_username text) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); other uuid;
begin
  select id into other from public.profiles where username = lower(ltrim(trim(coalesce(p_username, '')), '@'));
  if other is null or other = me then raise exception 'No one with that username.'; end if;
  if public.are_friends(me, other) then return 'already friends'; end if;
  if exists (select 1 from public.friend_requests where from_id = other and to_id = me) then
    perform public._befriend(me, other); return 'friends';
  end if;
  insert into public.friend_requests (from_id, to_id) values (me, other) on conflict do nothing;
  return 'requested';
end $$;

create or replace function public.social_respond(p_username text, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); other uuid;
begin
  select id into other from public.profiles where username = lower(trim(coalesce(p_username, '')));
  if other is null or not exists (select 1 from public.friend_requests where from_id = other and to_id = me) then
    raise exception 'No request from that person.'; end if;
  if p_accept then perform public._befriend(me, other);
  else delete from public.friend_requests where from_id = other and to_id = me; end if;
end $$;

create or replace function public.social_unfriend(p_username text) returns void language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  select id into other from public.profiles where username = lower(trim(coalesce(p_username, '')));
  delete from public.friendships where a = least(auth.uid(), other) and b = greatest(auth.uid(), other);
end $$;

create or replace function public.social_invite_accept(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select id into owner from public.profiles where invite_token = p_token;
  if owner is null or owner = auth.uid() then raise exception 'That invite link isn’t valid.'; end if;
  perform public._befriend(auth.uid(), owner);
  return public._pub(owner);
end $$;

create or replace function public.social_share(p_kind text, p_ref text, p_title text, p_payload jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('reading','guest_reading','practice') or coalesce(p_ref, '') = '' then raise exception 'bad share'; end if;
  if octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 60000 then raise exception 'That item is too large to share.'; end if;
  insert into public.shares (owner_id, kind, ref, title, payload) values (auth.uid(), p_kind, p_ref, left(coalesce(p_title, ''), 120), coalesce(p_payload, '{}'::jsonb))
  on conflict (owner_id, kind, ref) do update set title = excluded.title, payload = excluded.payload, at = now();
end $$;

create or replace function public.social_unshare(p_kind text, p_ref text) returns void language sql security definer set search_path = public as $$
  delete from public.shares where owner_id = auth.uid() and kind = p_kind and ref = p_ref;
$$;

do $$ declare f text; begin
  foreach f in array array['social_me()','social_feed()','social_request(text)','social_respond(text,boolean)','social_unfriend(text)',
                           'social_invite_accept(text)','social_share(text,text,text,jsonb)','social_unshare(text,text)','are_friends(uuid,uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- storage: private photos + personal journal PDF (files live under <user id>/...) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 26214400,
        array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own files read" on storage.objects;
create policy "own files read" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own files write" on storage.objects;
create policy "own files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own files delete" on storage.objects;
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
