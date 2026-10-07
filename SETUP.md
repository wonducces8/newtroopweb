# Troop 1941 admin setup

The public site is static. Supabase Auth and Postgres power the roster, announcement, and troop photo library. The website uses only the project URL and browser publishable key; never put a Supabase secret or service-role key in the repository.

## First-time setup and updates

1. Create an Auth user for the administrator in Supabase Dashboard → Authentication → Users. Keep public sign-ups disabled.
2. Open SQL Editor and run the complete `supabase-schema.sql` file. If you already ran an earlier version, run this updated file again to add the announcement field and photo storage bucket/policies. It is safe to rerun.
3. After the Auth user exists, add its ID to the admin allowlist by running this SQL with the administrator email:
   ```sql
   insert into public.site_admins (user_id)
   select id from auth.users where email = 'ADMIN-EMAIL-HERE'
   on conflict do nothing;
   ```
4. The project URL and publishable key are configured in `config.js`. Do not add a secret key.
5. Publish the repository as a static website. Sign in at `admin.html` to update patrols, leadership, a home-page announcement, and the photo library.

## Photo privacy

Photos uploaded through the admin are visible to anyone who can visit the public site. Upload only troop photos approved for public sharing. The `troop-photos` bucket accepts JPG, PNG, and WebP images up to 10 MB each. Administrators can remove photos in the admin page.

## Access controls

Only user IDs in `site_admins` can update roster content, upload photos, or delete photos. Public visitors can read the public roster, announcement, and photo library. Manage administrator access by adding or removing rows in `site_admins` using SQL Editor. Never use a Supabase secret/service-role key in browser code.
