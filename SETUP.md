# Troop 1941 admin setup

The static site uses Supabase Auth, Postgres, and Storage for the roster, announcements, and public photo albums.

## First-time setup and updates

1. Create an Auth user for the administrator in Supabase Dashboard → Authentication → Users. Keep public sign-ups disabled.
2. Run the complete `supabase-schema.sql` file in SQL Editor. After an earlier version was run, run this updated script again to add photo albums and captions. It migrates existing root-level photos into the General album and is safe to rerun.
3. After the Auth user exists, add its ID to the admin allowlist:
   ```sql
   insert into public.site_admins (user_id)
   select id from auth.users where email = 'ADMIN-EMAIL-HERE'
   on conflict do nothing;
   ```
4. The project URL and publishable key are set in `config.js`. Never add a Supabase secret or service-role key.
5. Publish the repo as a static site. The admin page lets authorized administrators update rosters and announcements, create photo albums, upload optimized photos, and edit captions.

## Photo library

Albums are public. Photos are resized to a maximum 2048 px on their longest side before upload and converted to WebP while preserving aspect ratio. Captions are optional and hidden when blank. Only upload images approved for public sharing. Administrators can delete photos in the admin page.

## Access controls

Only user IDs in `site_admins` can edit content, create albums, upload photos, edit captions, or delete photos. Public visitors can read public content and photos. Never use a Supabase secret/service-role key in browser code.
