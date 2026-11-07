-- Local check for the server-only schema. Rolls back.
-- anon must not be able to read the shared book. service_role is granted.
-- This does not apply the migration, and it must not be run against the remote project.

begin;

do $$
begin
  if has_table_privilege('anon', 'public.books', 'select') then
    raise exception 'anon can read books';
  end if;
  if has_table_privilege('anon', 'public.recipes', 'insert') then
    raise exception 'anon can insert recipes';
  end if;
  if not has_table_privilege('service_role', 'public.books', 'select') then
    raise exception 'service_role cannot read books';
  end if;
end $$;

rollback;
