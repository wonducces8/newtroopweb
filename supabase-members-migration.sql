-- Member accounts and photo permissions for Troop 1941.
-- Run after supabase-schema.sql in the Supabase SQL Editor.

create table if not exists public.photo_access_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  role text check (role in ('contributor','curator')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint approved_accounts_need_role check (status <> 'approved' or role is not null)
);

alter table public.photo_access_requests enable row level security;
revoke all on table public.photo_access_requests from anon, authenticated;
grant select, update on table public.photo_access_requests to authenticated;

create or replace function public.is_troop_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.site_admins
    where user_id = (select auth.uid())
  );
$$;

create or replace function public.current_troop_photo_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select role
  from public.photo_access_requests
  where user_id = (select auth.uid())
    and status = 'approved'
  limit 1;
$$;

revoke all on function public.is_troop_admin() from public, anon;
revoke all on function public.current_troop_photo_role() from public, anon;
grant execute on function public.is_troop_admin() to authenticated;
grant execute on function public.current_troop_photo_role() to authenticated;

drop policy if exists "Accounts can read own request or admins can read all" on public.photo_access_requests;
create policy "Accounts can read own request or admins can read all"
  on public.photo_access_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_troop_admin());

drop policy if exists "Only admins can review access requests" on public.photo_access_requests;
create policy "Only admins can review access requests"
  on public.photo_access_requests for update to authenticated
  using (public.is_troop_admin())
  with check (public.is_troop_admin());

create or replace function public.create_photo_access_request()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.photo_access_requests(user_id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_photo_access_request_after_signup on auth.users;
create trigger create_photo_access_request_after_signup
  after insert on auth.users
  for each row execute function public.create_photo_access_request();

-- Keep the current admin-only controls, while allowing approved contributors to
-- add photos and curators to manage photo organization.
alter table public.photo_library
  add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.photo_library
  alter column created_by set default auth.uid();

drop policy if exists "Admins can manage photo folders" on public.photo_folders;
drop policy if exists "Admins can manage photo library" on public.photo_library;
drop policy if exists "Approved members can add photo library rows" on public.photo_library;
drop policy if exists "Curators and admins can update photo library" on public.photo_library;
drop policy if exists "Curators and admins can delete photo library rows" on public.photo_library;

create policy "Admins and curators can manage photo folders"
  on public.photo_folders for all to authenticated
  using (public.is_troop_admin() or public.current_troop_photo_role() = 'curator')
  with check (public.is_troop_admin() or public.current_troop_photo_role() = 'curator');

create policy "Approved members can add photo library rows"
  on public.photo_library for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (public.is_troop_admin() or public.current_troop_photo_role() in ('contributor','curator'))
    and exists (
      select 1 from public.photo_folders
      where name = folder_name
        and (left(path, char_length(folder_name) + 1) = folder_name || '/' or path = folder_name)
    )
  );

create policy "Curators and admins can update photo library"
  on public.photo_library for update to authenticated
  using (public.is_troop_admin() or public.current_troop_photo_role() = 'curator')
  with check (public.is_troop_admin() or public.current_troop_photo_role() = 'curator');

create policy "Curators and admins can delete photo library rows"
  on public.photo_library for delete to authenticated
  using (public.is_troop_admin() or public.current_troop_photo_role() = 'curator');

-- Curators can delete an album only after its photos have been moved or removed.
drop policy if exists "Admins and curators can manage photo folders" on public.photo_folders;
create policy "Admins and curators can manage photo folders"
  on public.photo_folders for all to authenticated
  using (
    public.is_troop_admin()
    or (
      public.current_troop_photo_role() = 'curator'
      and not exists (select 1 from public.photo_library where folder_name = name)
    )
  )
  with check (public.is_troop_admin() or public.current_troop_photo_role() = 'curator');

drop policy if exists "Admins can upload troop photos" on storage.objects;
drop policy if exists "Admins can delete troop photos" on storage.objects;
drop policy if exists "Approved members can upload troop photos" on storage.objects;
drop policy if exists "Curators and admins can move troop photos" on storage.objects;
drop policy if exists "Curators and admins can delete troop photos" on storage.objects;
drop policy if exists "Contributors can clean up orphan uploads" on storage.objects;

create policy "Approved members can upload troop photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'troop-photos'
    and exists (
      select 1 from public.photo_folders
      where name = split_part(storage.objects.name, '/', 1)
    )
    and (public.is_troop_admin() or public.current_troop_photo_role() in ('contributor','curator'))
  );

create policy "Curators and admins can move troop photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'troop-photos'
    and (public.is_troop_admin() or public.current_troop_photo_role() = 'curator')
  )
  with check (
    bucket_id = 'troop-photos'
    and exists (
      select 1 from public.photo_folders
      where name = split_part(storage.objects.name, '/', 1)
    )
    and (public.is_troop_admin() or public.current_troop_photo_role() = 'curator')
  );

create policy "Curators and admins can delete troop photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'troop-photos'
    and (public.is_troop_admin() or public.current_troop_photo_role() = 'curator')
  );

-- Let a contributor remove an upload that failed before its library record was
-- created; valid public photos can only be removed by a curator or an admin.
create policy "Contributors can clean up orphan uploads"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'troop-photos'
    and public.current_troop_photo_role() in ('contributor','curator')
    and not exists (
      select 1 from public.photo_library where path = storage.objects.name
    )
  );
