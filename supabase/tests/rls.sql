-- Local RLS checks for Hand Me Down.
-- Do not run this against the remote project.
--
--   supabase start
--   supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
--
-- The script inserts auth users, exercises policies as `authenticated`, then rolls back.

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', '',
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cook@example.com', '',
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@example.com', '',
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select public.create_book_from_draft('draft-key-rls-1', 'Private table', 'Home kitchen') as book_id \gset

reset role;
insert into public.book_members (book_id, user_id, role)
values (:'book_id', '22222222-2222-4222-8222-222222222222', 'reader');

-- Outsider cannot read the book.
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  n int;
begin
  select count(*) into n from public.books;
  if n <> 0 then
    raise exception 'outsider can read a private book';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;

-- A reader cannot self-grant kitchen membership.
do $$
begin
  begin
    insert into public.kitchen_members (book_id, kitchen_id, user_id, role)
    select k.book_id, k.id, auth.uid(), 'cook' from public.kitchens k limit 1;
    raise exception 'self-grant should have failed';
  exception
    when insufficient_privilege then
      null;
    when others then
      if sqlerrm = 'self-grant should have failed' then
        raise;
      end if;
      if sqlstate not in ('42501', 'P0001') then
        raise;
      end if;
  end;
end $$;

reset role;

-- Cross-book foreign key, run as the table owner so RLS is not the thing failing.
do $$
declare
  v_book uuid;
  v_other uuid;
  v_kitchen uuid;
begin
  select id into v_book from public.books limit 1;
  insert into public.books (title, owner_id, draft_key)
  values ('Other', '11111111-1111-4111-8111-111111111111', 'other-draft-rls')
  returning id into v_other;
  insert into public.kitchens (book_id, name) values (v_other, 'Other kitchen') returning id into v_kitchen;
  begin
    insert into public.recipes (
      book_id, kitchen_id, title, course, servings, ingredients_json, steps_json, created_by
    ) values (
      v_book, v_kitchen, 'Illegal link', 'mains', 2, '[]'::jsonb, '[]'::jsonb,
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'cross-book insert should have failed';
  exception
    when foreign_key_violation then
      null;
  end;
end $$;

rollback;
