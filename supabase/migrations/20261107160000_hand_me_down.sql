-- Hand Me Down, one shared book, server-only.
-- The browser never connects as anon or authenticated.
-- Do not apply this file to the remote project until that target is approved.
-- Safe to re-run: tables use IF NOT EXISTS, seed rows use ON CONFLICT DO NOTHING.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------
-- Tables. No membership, invites, or session checks.
-- ---------------------------------------------------------------------------

create table if not exists public.books (
  id uuid primary key,
  title text not null check (char_length(title) between 1 and 40),
  is_example boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.kitchens (
  id uuid primary key,
  book_id uuid not null references public.books (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (book_id, id)
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null,
  kitchen_id uuid not null,
  title text not null check (char_length(title) between 1 and 140),
  handed_down_by text not null default '' check (char_length(handed_down_by) <= 140),
  recipe_by text not null default '' check (char_length(recipe_by) <= 80),
  course text not null check (course in ('mains', 'sweets', 'bakes', 'sides')),
  minutes integer not null default 0 check (minutes >= 0 and minutes <= 1440),
  servings integer not null check (servings > 0 and servings <= 100),
  margin_note text not null default '' check (char_length(margin_note) <= 600),
  steps_json jsonb not null default '[]'::jsonb,
  ingredients_json jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  deleted_at timestamptz,
  cooked_count integer not null default 0 check (cooked_count >= 0),
  hero_media_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, id),
  foreign key (book_id, kitchen_id) references public.kitchens (book_id, id)
);

create table if not exists public.recipe_favourites (
  book_id uuid not null,
  recipe_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id),
  foreign key (book_id, recipe_id) references public.recipes (book_id, id) on delete cascade
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (book_id, id)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  kitchen_id uuid,
  storage_path text not null default '',
  mime text not null,
  width integer,
  height integer,
  status text not null default 'quarantine' check (status in ('quarantine', 'ready', 'rejected')),
  created_at timestamptz not null default now(),
  unique (book_id, id),
  foreign key (book_id, kitchen_id) references public.kitchens (book_id, id)
);

alter table public.recipes drop constraint if exists recipes_hero_same_book_fk;
alter table public.recipes
  add constraint recipes_hero_same_book_fk
  foreign key (book_id, hero_media_id) references public.media_assets (book_id, id);

create table if not exists public.album_photos (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null,
  album_id uuid not null,
  media_id uuid not null,
  kitchen_id uuid,
  caption text not null default '' check (char_length(caption) <= 240),
  taken_on text not null default '',
  created_at timestamptz not null default now(),
  foreign key (book_id, album_id) references public.albums (book_id, id) on delete cascade,
  foreign key (book_id, media_id) references public.media_assets (book_id, id),
  foreign key (book_id, kitchen_id) references public.kitchens (book_id, id)
);

create table if not exists public.cooking_events (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null,
  recipe_id uuid not null,
  user_id uuid not null,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (recipe_id, user_id, idempotency_key),
  foreign key (book_id, recipe_id) references public.recipes (book_id, id)
);

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'ready', 'failed')),
  snapshot jsonb not null,
  pdf_path text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists recipes_book_live_idx on public.recipes (book_id) where deleted_at is null;
create index if not exists album_photos_book_idx on public.album_photos (book_id);
create index if not exists export_jobs_book_idx on public.export_jobs (book_id);

-- ---------------------------------------------------------------------------
-- RLS on, and no policies. anon and authenticated are denied.
-- service_role is the only granted role. On Supabase it bypasses RLS.
-- ---------------------------------------------------------------------------

alter table public.books enable row level security;
alter table public.books force row level security;
alter table public.kitchens enable row level security;
alter table public.kitchens force row level security;
alter table public.recipes enable row level security;
alter table public.recipes force row level security;
alter table public.recipe_favourites enable row level security;
alter table public.recipe_favourites force row level security;
alter table public.albums enable row level security;
alter table public.albums force row level security;
alter table public.media_assets enable row level security;
alter table public.media_assets force row level security;
alter table public.album_photos enable row level security;
alter table public.album_photos force row level security;
alter table public.cooking_events enable row level security;
alter table public.cooking_events force row level security;
alter table public.export_jobs enable row level security;
alter table public.export_jobs force row level security;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- The one shared book. Fixed id, looked up by the server as HMD_BOOK_ID or this default.
insert into public.books (id, title, is_example)
values ('10000000-0000-4000-8000-000000000001', 'The Fam', true)
on conflict (id) do nothing;

insert into public.kitchens (id, book_id, name)
values ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'Our Kitchen')
on conflict (id) do nothing;

-- Private bucket. Skipped when this file is applied to plain Postgres without Storage.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'media',
      'media',
      false,
      10485760,
      array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
