create table if not exists public.troop_content (
  key text primary key,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.troop_content drop constraint if exists troop_content_key_check;
alter table public.troop_content
  add constraint troop_content_key_check
  check (key in ('patrols', 'leaders', 'announcement', 'socials'));

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
create policy "Public can read troop content"
  on public.troop_content for select to anon, authenticated using (true);
drop policy if exists "Admins can insert troop content" on public.troop_content;
create policy "Admins can insert troop content"
  on public.troop_content for insert to authenticated
  with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));
drop policy if exists "Admins can update troop content" on public.troop_content;
create policy "Admins can update troop content"
  on public.troop_content for update to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));
drop policy if exists "Admins can read own admin row" on public.site_admins;
create policy "Admins can read own admin row"
  on public.site_admins for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.photo_folders (
  name text primary key check (name ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.photo_library (
  path text primary key,
  folder_name text not null references public.photo_folders(name) on update cascade,
  caption text not null default '',
  created_at timestamptz not null default now()
);
alter table public.photo_folders enable row level security;
alter table public.photo_library enable row level security;
revoke all on table public.photo_folders from anon, authenticated;
revoke all on table public.photo_library from anon, authenticated;
grant select on table public.photo_folders to anon, authenticated;
grant insert, update, delete on table public.photo_folders to authenticated;
grant select on table public.photo_library to anon, authenticated;
grant insert, update, delete on table public.photo_library to authenticated;

drop policy if exists "Public can read photo folders" on public.photo_folders;
create policy "Public can read photo folders"
  on public.photo_folders for select to anon, authenticated using (true);
drop policy if exists "Admins can manage photo folders" on public.photo_folders;
create policy "Admins can manage photo folders"
  on public.photo_folders for all to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));
drop policy if exists "Public can read photo library" on public.photo_library;
create policy "Public can read photo library"
  on public.photo_library for select to anon, authenticated using (true);
drop policy if exists "Admins can manage photo library" on public.photo_library;
create policy "Admins can manage photo library"
  on public.photo_library for all to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('troop-photos', 'troop-photos', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.photo_folders(name) values ('General') on conflict do nothing;
insert into public.photo_library(path, folder_name, caption)
select objects.name, 'General', ''
from storage.objects as objects
where objects.bucket_id = 'troop-photos'
  and position('/' in objects.name) = 0
  and left(objects.name, 1) <> '.'
on conflict (path) do nothing;

drop policy if exists "Public can view troop photos" on storage.objects;
create policy "Public can view troop photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'troop-photos');
drop policy if exists "Admins can upload troop photos" on storage.objects;
create policy "Admins can upload troop photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'troop-photos'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );
drop policy if exists "Admins can delete troop photos" on storage.objects;
create policy "Admins can delete troop photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'troop-photos'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );
