-- list_problems_open_access (ALL, open) already covers reads; the separate
-- public SELECT policy only duplicated evaluation on every SELECT.
drop policy if exists "Allow public read access for list_problems" on public.list_problems;

select pg_notify('pgrst', 'reload schema');
