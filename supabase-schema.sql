create table if not exists public.troop_content (
  key text primary key check (key in ('patrols', 'leaders')),
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.troop_content enable row level security;
alter table public.site_admins enable row level security;
revoke all on table public.troop_content from anon, authenticated;
revoke all on table public.site_admins from anon, authenticated;
grant select on table public.troop_content to anon, authenticated;
grant insert, update on table public.troop_content to authenticated;
grant select on table public.site_admins to authenticated;
drop policy if exists "Public can read troop content" on public.troop_content;
create policy "Public can read troop content" on public.troop_content for select to anon, authenticated using (true);
drop policy if exists "Admins can insert troop content" on public.troop_content;
create policy "Admins can insert troop content" on public.troop_content for insert to authenticated with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));
drop policy if exists "Admins can update troop content" on public.troop_content;
create policy "Admins can update troop content" on public.troop_content for update to authenticated using (exists (select 1 from public.site_admins where user_id = (select auth.uid()))) with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));
drop policy if exists "Admins can read own admin row" on public.site_admins;
create policy "Admins can read own admin row" on public.site_admins for select to authenticated using (user_id = (select auth.uid()));
