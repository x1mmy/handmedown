-- Hand Me Down schema, RLS, and privileged functions.
-- Do not apply this migration to the remote project until that target is approved.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_id uuid not null,
  draft_key text unique,
  is_example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.book_members (
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'reader')),
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create table public.kitchens (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (book_id, id)
);

create table public.kitchen_members (
  book_id uuid not null,
  kitchen_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('lead', 'cook')),
  created_at timestamptz not null default now(),
  primary key (book_id, kitchen_id, user_id),
  foreign key (book_id, kitchen_id) references public.kitchens (book_id, id),
  foreign key (book_id, user_id) references public.book_members (book_id, user_id)
);

create table public.kitchen_join_requests (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null,
  kitchen_id uuid not null,
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  foreign key (book_id, kitchen_id) references public.kitchens (book_id, id),
  foreign key (book_id, user_id) references public.book_members (book_id, user_id)
);

create unique index kitchen_join_one_pending
  on public.kitchen_join_requests (kitchen_id, user_id)
  where status = 'pending';

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null,
  kitchen_id uuid not null,
  title text not null,
  handed_down_by text not null default '',
  recipe_by text not null default '',
  course text not null check (course in ('mains', 'sweets', 'bakes', 'sides')),
  minutes integer not null default 0 check (minutes >= 0),
  servings integer not null check (servings > 0),
  margin_note text not null default '',
  steps_json jsonb not null default '[]'::jsonb,
  ingredients_json jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  deleted_at timestamptz,
  cooked_count integer not null default 0 check (cooked_count >= 0),
  hero_media_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, id),
  -- Same-book link. No cascade: a kitchen cannot be deleted out from under its recipes.
  foreign key (book_id, kitchen_id) references public.kitchens (book_id, id)
);

create table public.recipe_favourites (
  book_id uuid not null,
  recipe_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id),
  foreign key (book_id, recipe_id) references public.recipes (book_id, id) on delete cascade
);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (book_id, id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  kitchen_id uuid,
  owner_id uuid not null,
  storage_path text not null default '',
  mime text not null,
  width integer,
  height integer,
  status text not null default 'quarantine' check (status in ('quarantine', 'ready', 'rejected')),
  created_at timestamptz not null default now(),
  unique (book_id, id),
  foreign key (book_id, kitchen_id) references public.kitchens (book_id, id)
);

alter table public.recipes
  add constraint recipes_hero_same_book_fk
  foreign key (book_id, hero_media_id) references public.media_assets (book_id, id);

create table public.album_photos (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null,
  album_id uuid not null,
  media_id uuid not null,
  kitchen_id uuid,
  caption text not null default '',
  taken_on text not null default '',
  created_at timestamptz not null default now(),
  foreign key (book_id, album_id) references public.albums (book_id, id) on delete cascade,
  foreign key (book_id, media_id) references public.media_assets (book_id, id),
  foreign key (book_id, kitchen_id) references public.kitchens (book_id, id)
);

create table public.book_invites (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null,
  revoked_at timestamptz,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cooking_events (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null,
  recipe_id uuid not null,
  user_id uuid not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (recipe_id, user_id, idempotency_key),
  foreign key (book_id, recipe_id) references public.recipes (book_id, id)
);

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  requested_by uuid not null,
  status text not null default 'queued' check (status in ('queued', 'ready', 'failed')),
  snapshot jsonb not null,
  pdf_path text,
  error text,
  created_at timestamptz not null default now()
);

create index recipes_book_live_idx on public.recipes (book_id) where deleted_at is null;
create index book_members_user_idx on public.book_members (user_id);
create index kitchen_members_user_idx on public.kitchen_members (user_id);

-- ---------------------------------------------------------------------------
-- Helpers. Security definer, fixed search_path, private schema only.
-- ---------------------------------------------------------------------------

create or replace function private.is_book_member(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.role() = 'service_role' or exists (
    select 1 from public.book_members m
    where m.book_id = p_book_id and m.user_id = auth.uid()
  );
$$;

create or replace function private.is_book_owner(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.role() = 'service_role' or exists (
    select 1 from public.book_members m
    where m.book_id = p_book_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function private.is_kitchen_member(p_book_id uuid, p_kitchen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.role() = 'service_role' or exists (
    select 1 from public.kitchen_members m
    where m.book_id = p_book_id and m.kitchen_id = p_kitchen_id and m.user_id = auth.uid()
  );
$$;

create or replace function private.is_kitchen_lead(p_book_id uuid, p_kitchen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.role() = 'service_role' or exists (
    select 1 from public.kitchen_members m
    where m.book_id = p_book_id and m.kitchen_id = p_kitchen_id and m.user_id = auth.uid() and m.role = 'lead'
  );
$$;

create or replace function private.ingredients_ok(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  el jsonb;
begin
  if jsonb_typeof(p) is distinct from 'array' then return false; end if;
  for el in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(el -> 'numerator') is distinct from 'number' then return false; end if;
    if jsonb_typeof(el -> 'denominator') is distinct from 'number' then return false; end if;
    if (el ->> 'denominator')::numeric <= 0 then return false; end if;
    if (el ->> 'numerator')::numeric < 0 then return false; end if;
    if (el ->> 'numerator')::numeric <> trunc((el ->> 'numerator')::numeric) then return false; end if;
    if (el ->> 'denominator')::numeric <> trunc((el ->> 'denominator')::numeric) then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.recipes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.ingredients_ok(new.ingredients_json) then
    raise exception 'invalid ingredients' using errcode = '23514';
  end if;
  if jsonb_typeof(new.steps_json) is distinct from 'array' then
    raise exception 'invalid steps' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if current_user not in ('postgres', 'supabase_admin') and new.created_by is distinct from auth.uid() then
      raise exception 'created_by must be the caller' using errcode = '42501';
    end if;
    if new.version <> 1 or new.cooked_count <> 0 then
      raise exception 'invalid counters' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' and new.cooked_count is distinct from old.cooked_count then
    if current_setting('hmd.allow_cooked', true) is distinct from 'on' then
      raise exception 'cooked counter is managed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger recipes_guard before insert or update on public.recipes
for each row execute function private.recipes_guard();

create or replace function private.export_snapshot_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.snapshot is distinct from old.snapshot then
    raise exception 'export snapshot is immutable' using errcode = 'H4090';
  end if;
  return new;
end;
$$;

create trigger export_snapshot_immutable before update on public.export_jobs
for each row execute function private.export_snapshot_immutable();

-- ---------------------------------------------------------------------------
-- RLS. Every table has select/insert/update/delete policies.
-- Update policies carry both USING and WITH CHECK.
-- ---------------------------------------------------------------------------

alter table public.books enable row level security;
alter table public.books force row level security;
alter table public.book_members enable row level security;
alter table public.book_members force row level security;
alter table public.kitchens enable row level security;
alter table public.kitchens force row level security;
alter table public.kitchen_members enable row level security;
alter table public.kitchen_members force row level security;
alter table public.kitchen_join_requests enable row level security;
alter table public.kitchen_join_requests force row level security;
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
alter table public.book_invites enable row level security;
alter table public.book_invites force row level security;
alter table public.cooking_events enable row level security;
alter table public.cooking_events force row level security;
alter table public.export_jobs enable row level security;
alter table public.export_jobs force row level security;

create policy books_select on public.books for select to authenticated
  using (private.is_book_member(id));
create policy books_insert on public.books for insert to authenticated
  with check (false);
create policy books_update on public.books for update to authenticated
  using (private.is_book_owner(id))
  with check (private.is_book_owner(id));
create policy books_delete on public.books for delete to authenticated
  using (false);

create policy book_members_select on public.book_members for select to authenticated
  using (private.is_book_member(book_id));
create policy book_members_insert on public.book_members for insert to authenticated
  with check (false);
create policy book_members_update on public.book_members for update to authenticated
  using (false)
  with check (false);
create policy book_members_delete on public.book_members for delete to authenticated
  using (private.is_book_owner(book_id) and user_id <> auth.uid());

create policy kitchens_select on public.kitchens for select to authenticated
  using (private.is_book_member(book_id));
create policy kitchens_insert on public.kitchens for insert to authenticated
  with check (private.is_book_owner(book_id));
create policy kitchens_update on public.kitchens for update to authenticated
  using (private.is_book_owner(book_id))
  with check (private.is_book_owner(book_id));
create policy kitchens_delete on public.kitchens for delete to authenticated
  using (false);

create policy kitchen_members_select on public.kitchen_members for select to authenticated
  using (private.is_book_member(book_id));
create policy kitchen_members_insert on public.kitchen_members for insert to authenticated
  with check (
    user_id <> auth.uid()
    and (private.is_book_owner(book_id) or private.is_kitchen_lead(book_id, kitchen_id))
    and exists (
      select 1 from public.book_members bm
      where bm.book_id = kitchen_members.book_id and bm.user_id = kitchen_members.user_id
    )
  );
create policy kitchen_members_update on public.kitchen_members for update to authenticated
  using (
    user_id <> auth.uid()
    and (private.is_book_owner(book_id) or private.is_kitchen_lead(book_id, kitchen_id))
  )
  with check (
    user_id <> auth.uid()
    and (private.is_book_owner(book_id) or private.is_kitchen_lead(book_id, kitchen_id))
  );
create policy kitchen_members_delete on public.kitchen_members for delete to authenticated
  using (
    user_id <> auth.uid()
    and (private.is_book_owner(book_id) or private.is_kitchen_lead(book_id, kitchen_id))
  );

create policy kitchen_join_requests_select on public.kitchen_join_requests for select to authenticated
  using (
    user_id = auth.uid()
    or private.is_book_owner(book_id)
    or private.is_kitchen_lead(book_id, kitchen_id)
  );
create policy kitchen_join_requests_insert on public.kitchen_join_requests for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and private.is_book_member(book_id)
    and not private.is_kitchen_member(book_id, kitchen_id)
  );
create policy kitchen_join_requests_update on public.kitchen_join_requests for update to authenticated
  using (
    user_id <> auth.uid()
    and (private.is_book_owner(book_id) or private.is_kitchen_lead(book_id, kitchen_id))
  )
  with check (
    user_id <> auth.uid()
    and (private.is_book_owner(book_id) or private.is_kitchen_lead(book_id, kitchen_id))
    and status in ('approved', 'rejected')
  );
create policy kitchen_join_requests_delete on public.kitchen_join_requests for delete to authenticated
  using (false);

create policy recipes_select on public.recipes for select to authenticated
  using (private.is_book_member(book_id));
create policy recipes_insert on public.recipes for insert to authenticated
  with check (
    created_by = auth.uid()
    and private.is_kitchen_member(book_id, kitchen_id)
  );
create policy recipes_update on public.recipes for update to authenticated
  using (private.is_kitchen_member(book_id, kitchen_id))
  with check (private.is_kitchen_member(book_id, kitchen_id));
create policy recipes_delete on public.recipes for delete to authenticated
  using (false);

create policy recipe_favourites_select on public.recipe_favourites for select to authenticated
  using (user_id = auth.uid() and private.is_book_member(book_id));
create policy recipe_favourites_insert on public.recipe_favourites for insert to authenticated
  with check (user_id = auth.uid() and private.is_book_member(book_id));
create policy recipe_favourites_update on public.recipe_favourites for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy recipe_favourites_delete on public.recipe_favourites for delete to authenticated
  using (user_id = auth.uid());

create policy albums_select on public.albums for select to authenticated
  using (private.is_book_member(book_id));
create policy albums_insert on public.albums for insert to authenticated
  with check (private.is_book_member(book_id));
create policy albums_update on public.albums for update to authenticated
  using (private.is_book_owner(book_id))
  with check (private.is_book_owner(book_id));
create policy albums_delete on public.albums for delete to authenticated
  using (private.is_book_owner(book_id));

create policy media_assets_select on public.media_assets for select to authenticated
  using (private.is_book_member(book_id) and status = 'ready');
create policy media_assets_insert on public.media_assets for insert to authenticated
  with check (false);
create policy media_assets_update on public.media_assets for update to authenticated
  using (false)
  with check (false);
create policy media_assets_delete on public.media_assets for delete to authenticated
  using (false);

create policy album_photos_select on public.album_photos for select to authenticated
  using (private.is_book_member(book_id));
create policy album_photos_insert on public.album_photos for insert to authenticated
  with check (false);
create policy album_photos_update on public.album_photos for update to authenticated
  using (private.is_book_member(book_id))
  with check (private.is_book_member(book_id));
create policy album_photos_delete on public.album_photos for delete to authenticated
  using (private.is_book_owner(book_id) or (kitchen_id is not null and private.is_kitchen_member(book_id, kitchen_id)));

create policy book_invites_select on public.book_invites for select to authenticated
  using (private.is_book_owner(book_id));
create policy book_invites_insert on public.book_invites for insert to authenticated
  with check (false);
create policy book_invites_update on public.book_invites for update to authenticated
  using (false)
  with check (false);
create policy book_invites_delete on public.book_invites for delete to authenticated
  using (false);

create policy cooking_events_select on public.cooking_events for select to authenticated
  using (user_id = auth.uid());
create policy cooking_events_insert on public.cooking_events for insert to authenticated
  with check (false);
create policy cooking_events_update on public.cooking_events for update to authenticated
  using (false)
  with check (false);
create policy cooking_events_delete on public.cooking_events for delete to authenticated
  using (false);

create policy export_jobs_select on public.export_jobs for select to authenticated
  using (requested_by = auth.uid() and private.is_book_member(book_id));
create policy export_jobs_insert on public.export_jobs for insert to authenticated
  with check (false);
create policy export_jobs_update on public.export_jobs for update to authenticated
  using (false)
  with check (false);
create policy export_jobs_delete on public.export_jobs for delete to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- Privileged mutations
-- ---------------------------------------------------------------------------

create or replace function private.actor()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.uid(), '00000000-0000-4000-8000-0000000000aa'::uuid);
$$;

create or replace function private.require_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return '00000000-0000-4000-8000-0000000000aa'::uuid;
  end if;
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  return auth.uid();
end;
$$;

create or replace function private.create_book_from_draft(p_draft_key text, p_title text, p_kitchen_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book uuid;
  v_owner uuid;
  v_kitchen uuid;
begin
  perform private.require_user();
  if p_draft_key is null or length(trim(p_draft_key)) < 8 then
    raise exception 'draft key required' using errcode = '22023';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title required' using errcode = '22023';
  end if;
  select id, owner_id into v_book, v_owner from public.books where draft_key = p_draft_key;
  if v_book is not null then
    if v_owner <> private.actor() then
      raise exception 'draft key conflict' using errcode = 'H4090';
    end if;
    return v_book;
  end if;
  insert into public.books (title, owner_id, draft_key)
  values (trim(p_title), private.actor(), p_draft_key)
  returning id into v_book;
  insert into public.book_members (book_id, user_id, role)
  values (v_book, private.actor(), 'owner');
  insert into public.kitchens (book_id, name)
  values (v_book, coalesce(nullif(trim(p_kitchen_name), ''), 'Our Kitchen'))
  returning id into v_kitchen;
  insert into public.kitchen_members (book_id, kitchen_id, user_id, role)
  values (v_book, v_kitchen, private.actor(), 'lead');
  return v_book;
exception
  when unique_violation then
    select id, owner_id into v_book, v_owner from public.books where draft_key = p_draft_key;
    if v_owner = private.actor() then return v_book; end if;
    raise exception 'draft key conflict' using errcode = 'H4090';
end;
$$;

create or replace function private.update_book_title(p_book_id uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if not private.is_book_owner(p_book_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.books set title = trim(p_title), updated_at = now() where id = p_book_id;
end;
$$;

create or replace function private.create_recipe(p_book_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_kitchen uuid;
begin
  perform private.require_user();
  v_kitchen := (p_payload ->> 'kitchen_id')::uuid;
  if not exists (
    select 1 from public.kitchens k where k.id = v_kitchen and k.book_id = p_book_id
  ) then
    raise exception 'cross-book link rejected' using errcode = 'H4090';
  end if;
  if not private.is_book_member(p_book_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if not private.is_kitchen_member(p_book_id, v_kitchen) then
    raise exception 'not a member of this kitchen' using errcode = '42501';
  end if;
  insert into public.recipes (
    book_id, kitchen_id, title, handed_down_by, recipe_by, course, minutes, servings,
    margin_note, ingredients_json, steps_json, created_by
  ) values (
    p_book_id,
    v_kitchen,
    p_payload ->> 'title',
    coalesce(p_payload ->> 'handed_down_by', ''),
    coalesce(p_payload ->> 'recipe_by', ''),
    p_payload ->> 'course',
    coalesce((p_payload ->> 'minutes')::int, 0),
    (p_payload ->> 'servings')::int,
    coalesce(p_payload ->> 'margin_note', ''),
    coalesce(p_payload -> 'ingredients_json', '[]'::jsonb),
    coalesce(p_payload -> 'steps_json', '[]'::jsonb),
    private.actor()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.update_recipe(p_recipe_id uuid, p_version integer, p_patch jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recipes%rowtype;
  v_kitchen uuid;
  v_version integer;
begin
  perform private.require_user();
  select * into r from public.recipes where id = p_recipe_id for update;
  if not found or not private.is_book_member(r.book_id) then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;
  if not private.is_kitchen_member(r.book_id, r.kitchen_id) then
    raise exception 'not a member of this kitchen' using errcode = '42501';
  end if;
  if r.deleted_at is not null then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;
  if r.version <> p_version then
    raise exception 'stale edit' using errcode = 'H4090';
  end if;
  v_kitchen := coalesce((p_patch ->> 'kitchen_id')::uuid, r.kitchen_id);
  if not exists (select 1 from public.kitchens k where k.id = v_kitchen and k.book_id = r.book_id) then
    raise exception 'cross-book link rejected' using errcode = 'H4090';
  end if;
  if not private.is_kitchen_member(r.book_id, v_kitchen) then
    raise exception 'not a member of this kitchen' using errcode = '42501';
  end if;
  update public.recipes set
    kitchen_id = v_kitchen,
    title = coalesce(p_patch ->> 'title', title),
    handed_down_by = coalesce(p_patch ->> 'handed_down_by', handed_down_by),
    recipe_by = coalesce(p_patch ->> 'recipe_by', recipe_by),
    course = coalesce(p_patch ->> 'course', course),
    minutes = coalesce((p_patch ->> 'minutes')::int, minutes),
    servings = coalesce((p_patch ->> 'servings')::int, servings),
    margin_note = coalesce(p_patch ->> 'margin_note', margin_note),
    ingredients_json = coalesce(p_patch -> 'ingredients_json', ingredients_json),
    steps_json = coalesce(p_patch -> 'steps_json', steps_json),
    version = version + 1,
    updated_at = now()
  where id = p_recipe_id
  returning version into v_version;
  return v_version;
end;
$$;

create or replace function private.soft_delete_recipe(p_recipe_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recipes%rowtype;
  v_deleted timestamptz;
begin
  perform private.require_user();
  select * into r from public.recipes where id = p_recipe_id for update;
  if not found or r.deleted_at is not null or not private.is_book_member(r.book_id) then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;
  if not private.is_kitchen_member(r.book_id, r.kitchen_id) then
    raise exception 'not a member of this kitchen' using errcode = '42501';
  end if;
  update public.recipes
    set deleted_at = now(), version = version + 1, updated_at = now()
    where id = p_recipe_id
    returning deleted_at into v_deleted;
  return v_deleted;
end;
$$;

create or replace function private.undo_delete_recipe(p_recipe_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recipes%rowtype;
begin
  perform private.require_user();
  select * into r from public.recipes where id = p_recipe_id for update;
  if not found or r.deleted_at is null or not private.is_book_member(r.book_id) then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;
  if not private.is_kitchen_member(r.book_id, r.kitchen_id) then
    raise exception 'not a member of this kitchen' using errcode = '42501';
  end if;
  if r.deleted_at < now() - interval '6 seconds' then
    raise exception 'undo window has closed' using errcode = 'H4090';
  end if;
  update public.recipes
    set deleted_at = null, version = version + 1, updated_at = now()
    where id = p_recipe_id;
end;
$$;

create or replace function private.set_favourite(p_recipe_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book uuid;
begin
  perform private.require_user();
  select book_id into v_book from public.recipes where id = p_recipe_id and deleted_at is null;
  if v_book is null or not private.is_book_member(v_book) then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.recipe_favourites (book_id, recipe_id, user_id)
    values (v_book, p_recipe_id, private.actor())
    on conflict (recipe_id, user_id) do nothing;
  else
    delete from public.recipe_favourites where recipe_id = p_recipe_id and user_id = private.actor();
  end if;
end;
$$;

create or replace function private.increment_cooked(p_recipe_id uuid, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recipes%rowtype;
  v_inserted integer;
begin
  perform private.require_user();
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;
  select * into r from public.recipes where id = p_recipe_id for update;
  if not found or r.deleted_at is not null or not private.is_book_member(r.book_id) then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;
  insert into public.cooking_events (book_id, recipe_id, user_id, idempotency_key)
  values (r.book_id, r.id, private.actor(), trim(p_key))
  on conflict (recipe_id, user_id, idempotency_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('cooked_count', r.cooked_count, 'applied', false);
  end if;
  perform set_config('hmd.allow_cooked', 'on', true);
  update public.recipes
    set cooked_count = cooked_count + 1
    where id = r.id
    returning cooked_count into r.cooked_count;
  return jsonb_build_object('cooked_count', r.cooked_count, 'applied', true);
end;
$$;

create or replace function private.create_kitchen(p_book_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_user();
  if not private.is_book_owner(p_book_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.kitchens (book_id, name) values (p_book_id, trim(p_name)) returning id into v_id;
  insert into public.kitchen_members (book_id, kitchen_id, user_id, role)
  values (p_book_id, v_id, private.actor(), 'lead');
  return v_id;
end;
$$;

create or replace function private.delete_kitchen(p_kitchen_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book uuid;
begin
  perform private.require_user();
  select book_id into v_book from public.kitchens where id = p_kitchen_id;
  if v_book is null then
    raise exception 'kitchen not found' using errcode = 'P0002';
  end if;
  if not private.is_book_owner(v_book) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.recipes r where r.kitchen_id = p_kitchen_id)
     or exists (select 1 from public.album_photos p where p.kitchen_id = p_kitchen_id)
     or exists (select 1 from public.media_assets m where m.kitchen_id = p_kitchen_id and m.status <> 'rejected')
  then
    raise exception 'kitchen has content attached' using errcode = 'H4090';
  end if;
  delete from public.kitchen_join_requests where kitchen_id = p_kitchen_id;
  delete from public.kitchen_members where kitchen_id = p_kitchen_id;
  delete from public.kitchens where id = p_kitchen_id;
end;
$$;

create or replace function private.grant_kitchen_member(p_kitchen_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book uuid;
begin
  perform private.require_user();
  if p_user_id = auth.uid() then
    raise exception 'you cannot grant membership to yourself' using errcode = '42501';
  end if;
  select book_id into v_book from public.kitchens where id = p_kitchen_id;
  if v_book is null then
    raise exception 'cross-book link rejected' using errcode = 'H4090';
  end if;
  if not (private.is_book_owner(v_book) or private.is_kitchen_lead(v_book, p_kitchen_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.book_members bm where bm.book_id = v_book and bm.user_id = p_user_id) then
    raise exception 'person has not joined the book' using errcode = 'H4090';
  end if;
  insert into public.kitchen_members (book_id, kitchen_id, user_id, role)
  values (v_book, p_kitchen_id, p_user_id, 'cook')
  on conflict (book_id, kitchen_id, user_id) do nothing;
end;
$$;

create or replace function private.request_kitchen_join(p_kitchen_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book uuid;
  v_id uuid;
begin
  perform private.require_user();
  select book_id into v_book from public.kitchens where id = p_kitchen_id;
  if v_book is null or not private.is_book_member(v_book) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if private.is_kitchen_member(v_book, p_kitchen_id) then
    raise exception 'already in this kitchen' using errcode = 'H4090';
  end if;
  select id into v_id from public.kitchen_join_requests
  where kitchen_id = p_kitchen_id and user_id = auth.uid() and status = 'pending';
  if v_id is not null then return v_id; end if;
  insert into public.kitchen_join_requests (book_id, kitchen_id, user_id, status)
  values (v_book, p_kitchen_id, auth.uid(), 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.decide_kitchen_join(p_request_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.kitchen_join_requests%rowtype;
begin
  perform private.require_user();
  select * into r from public.kitchen_join_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if r.user_id = auth.uid() then
    raise exception 'you cannot grant membership to yourself' using errcode = '42501';
  end if;
  if not (private.is_book_owner(r.book_id) or private.is_kitchen_lead(r.book_id, r.kitchen_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if r.status = p_status then return; end if;
  if r.status <> 'pending' then
    raise exception 'request already decided' using errcode = 'H4090';
  end if;
  update public.kitchen_join_requests set status = p_status where id = r.id;
  if p_status = 'approved' then
    insert into public.kitchen_members (book_id, kitchen_id, user_id, role)
    values (r.book_id, r.kitchen_id, r.user_id, 'cook')
    on conflict (book_id, kitchen_id, user_id) do nothing;
  end if;
end;
$$;

create or replace function private.approve_kitchen_join(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.decide_kitchen_join(p_request_id, 'approved');
end;
$$;

create or replace function private.reject_kitchen_join(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.decide_kitchen_join(p_request_id, 'rejected');
end;
$$;

create or replace function private.create_book_invite(p_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_id uuid;
begin
  perform private.require_user();
  if not private.is_book_owner(p_book_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  insert into public.book_invites (book_id, token_hash, created_by)
  values (p_book_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$$;

create or replace function private.revoke_book_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book uuid;
begin
  perform private.require_user();
  select book_id into v_book from public.book_invites where id = p_invite_id;
  if v_book is null then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  if not private.is_book_owner(v_book) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.book_invites set revoked_at = now() where id = p_invite_id;
end;
$$;

create or replace function private.redeem_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  inv public.book_invites%rowtype;
begin
  perform private.require_user();
  v_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');
  select * into inv from public.book_invites where token_hash = v_hash for update;
  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  if inv.revoked_at is not null then
    raise exception 'invite revoked' using errcode = '42501';
  end if;
  if inv.redeemed_by is not null and inv.redeemed_by <> auth.uid() then
    raise exception 'invite already used' using errcode = '42501';
  end if;
  if inv.redeemed_by = auth.uid() then
    return inv.book_id;
  end if;
  insert into public.book_members (book_id, user_id, role)
  values (inv.book_id, auth.uid(), 'reader')
  on conflict (book_id, user_id) do nothing;
  update public.book_invites
    set redeemed_by = auth.uid(), redeemed_at = now()
    where id = inv.id;
  return inv.book_id;
end;
$$;

create or replace function private.create_album(p_book_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_user();
  if not private.is_book_member(p_book_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.albums (book_id, name) values (p_book_id, trim(p_name)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.create_media_asset(p_book_id uuid, p_kitchen_id uuid, p_mime text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_user();
  if not private.is_book_member(p_book_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_kitchen_id is not null and not exists (
    select 1 from public.kitchens k where k.id = p_kitchen_id and k.book_id = p_book_id
  ) then
    raise exception 'cross-book link rejected' using errcode = 'H4090';
  end if;
  if p_kitchen_id is not null and not private.is_kitchen_member(p_book_id, p_kitchen_id) then
    raise exception 'not a member of this kitchen' using errcode = '42501';
  end if;
  insert into public.media_assets (book_id, kitchen_id, owner_id, mime, status)
  values (p_book_id, p_kitchen_id, private.actor(), p_mime, 'quarantine')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.mark_media_ready(p_media_id uuid, p_width integer, p_height integer, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.media_assets%rowtype;
begin
  perform private.require_user();
  select * into r from public.media_assets where id = p_media_id;
  if not found or r.owner_id <> private.actor() then
    raise exception 'photo not found' using errcode = 'P0002';
  end if;
  if r.status <> 'quarantine' then
    raise exception 'photo is not awaiting review' using errcode = 'H4090';
  end if;
  if p_path is distinct from ('book/' || r.book_id::text || '/' || r.id::text || '.jpg')
     or p_path like '%..%' or p_path like '%/%/%/%' then
    raise exception 'invalid storage path' using errcode = '42501';
  end if;
  update public.media_assets
    set status = 'ready', width = p_width, height = p_height, storage_path = 'book/' || r.book_id::text || '/' || r.id::text || '.jpg'
    where id = p_media_id;
end;
$$;

create or replace function private.reject_media(p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  update public.media_assets
    set status = 'rejected'
    where id = p_media_id and owner_id = private.actor() and status = 'quarantine';
end;
$$;

create or replace function private.attach_album_photo(
  p_album_id uuid,
  p_media_id uuid,
  p_caption text,
  p_kitchen_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book uuid;
  v_media_book uuid;
  v_id uuid;
begin
  perform private.require_user();
  select book_id into v_book from public.albums where id = p_album_id;
  select book_id into v_media_book from public.media_assets where id = p_media_id and status = 'ready';
  if v_book is null or v_media_book is null or v_book <> v_media_book then
    raise exception 'cross-book link rejected' using errcode = 'H4090';
  end if;
  if not private.is_book_member(v_book) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.album_photos (book_id, album_id, media_id, kitchen_id, caption, taken_on)
  values (v_book, p_album_id, p_media_id, p_kitchen_id, coalesce(p_caption, ''), to_char(now(), 'Mon YYYY'))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.create_export_job(p_book_id uuid, p_snapshot jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_user();
  if not private.is_book_member(p_book_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.export_jobs (book_id, requested_by, status, snapshot)
  values (p_book_id, private.actor(), 'queued', p_snapshot)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.finish_export_job(p_job_id uuid, p_status text, p_pdf_path text, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book uuid;
  v_expected text;
begin
  perform private.require_user();
  select book_id into v_book from public.export_jobs where id = p_job_id;
  if v_book is null then
    raise exception 'export not found' using errcode = 'P0002';
  end if;
  if p_status not in ('ready', 'failed') then
    raise exception 'invalid export status' using errcode = '22023';
  end if;
  v_expected := 'exports/' || p_job_id::text || '.pdf';
  if p_status = 'ready' and (p_pdf_path is distinct from v_expected or p_pdf_path like '%..%') then
    raise exception 'invalid storage path' using errcode = '42501';
  end if;
  if p_status = 'failed' and p_pdf_path is not null then
    raise exception 'invalid storage path' using errcode = '42501';
  end if;
  update public.export_jobs
    set status = p_status,
        pdf_path = case when p_status = 'ready' then v_expected else null end,
        error = p_error
    where id = p_job_id;
  if not found then
    raise exception 'export not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Public wrappers are security invoker. They only forward into private.
create or replace function public.create_book_from_draft(p_draft_key text, p_title text, p_kitchen_name text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_book_from_draft(p_draft_key, p_title, p_kitchen_name); $$;

create or replace function public.update_book_title(p_book_id uuid, p_title text)
returns void language sql security invoker set search_path = ''
as $$ select private.update_book_title(p_book_id, p_title); $$;

create or replace function public.create_recipe(p_book_id uuid, p_payload jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_recipe(p_book_id, p_payload); $$;

create or replace function public.update_recipe(p_recipe_id uuid, p_version integer, p_patch jsonb)
returns integer language sql security invoker set search_path = ''
as $$ select private.update_recipe(p_recipe_id, p_version, p_patch); $$;

create or replace function public.soft_delete_recipe(p_recipe_id uuid)
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.soft_delete_recipe(p_recipe_id); $$;

create or replace function public.undo_delete_recipe(p_recipe_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.undo_delete_recipe(p_recipe_id); $$;

create or replace function public.set_favourite(p_recipe_id uuid, p_on boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.set_favourite(p_recipe_id, p_on); $$;

create or replace function public.increment_cooked(p_recipe_id uuid, p_key text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.increment_cooked(p_recipe_id, p_key); $$;

create or replace function public.create_kitchen(p_book_id uuid, p_name text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_kitchen(p_book_id, p_name); $$;

create or replace function public.delete_kitchen(p_kitchen_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.delete_kitchen(p_kitchen_id); $$;

create or replace function public.grant_kitchen_member(p_kitchen_id uuid, p_user_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.grant_kitchen_member(p_kitchen_id, p_user_id); $$;

create or replace function public.request_kitchen_join(p_kitchen_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.request_kitchen_join(p_kitchen_id); $$;

create or replace function public.approve_kitchen_join(p_request_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.approve_kitchen_join(p_request_id); $$;

create or replace function public.reject_kitchen_join(p_request_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.reject_kitchen_join(p_request_id); $$;

create or replace function public.create_book_invite(p_book_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_book_invite(p_book_id); $$;

create or replace function public.revoke_book_invite(p_invite_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.revoke_book_invite(p_invite_id); $$;

create or replace function public.redeem_invite(p_token text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.redeem_invite(p_token); $$;

create or replace function public.create_album(p_book_id uuid, p_name text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_album(p_book_id, p_name); $$;

create or replace function public.create_media_asset(p_book_id uuid, p_kitchen_id uuid, p_mime text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_media_asset(p_book_id, p_kitchen_id, p_mime); $$;

create or replace function public.mark_media_ready(p_media_id uuid, p_width integer, p_height integer, p_path text)
returns void language sql security invoker set search_path = ''
as $$ select private.mark_media_ready(p_media_id, p_width, p_height, p_path); $$;

create or replace function public.reject_media(p_media_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.reject_media(p_media_id); $$;

create or replace function public.attach_album_photo(p_album_id uuid, p_media_id uuid, p_caption text, p_kitchen_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.attach_album_photo(p_album_id, p_media_id, p_caption, p_kitchen_id); $$;

create or replace function public.create_export_job(p_book_id uuid, p_snapshot jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_export_job(p_book_id, p_snapshot); $$;

create or replace function public.finish_export_job(p_job_id uuid, p_status text, p_pdf_path text, p_error text)
returns void language sql security invoker set search_path = ''
as $$ select private.finish_export_job(p_job_id, p_status, p_pdf_path, p_error); $$;

revoke all on all tables in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update, delete on public.recipes from authenticated;
revoke insert, update, delete on public.cooking_events from authenticated;
revoke insert, update, delete on public.book_invites from authenticated;
revoke insert, update, delete on public.media_assets from authenticated;
revoke insert on public.album_photos from authenticated;
revoke insert, update, delete on public.export_jobs from authenticated;
revoke delete on public.kitchens from authenticated;

do $$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
  loop
    execute format('revoke all on function %I.%I(%s) from public, anon', r.nspname, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to authenticated', r.nspname, r.proname, r.args);
  end loop;
end $$;

-- Completion functions are not callable from the browser. The Node server calls them with the secret key.
revoke all on function public.mark_media_ready(uuid, integer, integer, text) from public, anon, authenticated;
revoke all on function public.finish_export_job(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.mark_media_ready(uuid, integer, integer, text) from public, anon, authenticated;
revoke all on function private.finish_export_job(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.mark_media_ready(uuid, integer, integer, text) to service_role;
grant execute on function public.finish_export_job(uuid, text, text, text) to service_role;
grant execute on function private.mark_media_ready(uuid, integer, integer, text) to service_role;
grant execute on function private.finish_export_job(uuid, text, text, text) to service_role;

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;
