# Troop 1941 admin setup

The public site is static. The patrol and leadership editor uses Supabase Auth and Postgres so authorized adults can update one shared roster. The site only contains the project URL and a publishable browser key; never put a Supabase secret key in this repository.

## One-time setup

1. Create an Auth user for the administrator in Supabase Dashboard → Authentication → Users. Public sign-ups should remain disabled.
2. Open SQL Editor and run <code>supabase-schema.sql</code>.
3. After the Auth user exists, run this SQL with the admin's email:

   <pre>insert into public.site_admins (user_id)
   select id from auth.users where email = 'ADMIN-EMAIL-HERE'
   on conflict do nothing;</pre>

4. The project URL and publishable key are already configured in <code>config.js</code>. Publishable keys are intended for browser code; row-level security restricts writes.
5. Deploy the repository as a static website. Open <code>admin.html</code>, sign in with the Auth user's email and password, and edit Patrols and Leadership.

The public <code>people.html</code> page reads the two roster records. No youth contact details are collected by this editor.

## Security

Only user IDs present in <code>public.site_admins</code> can insert or update roster content. Public visitors can read the roster. Manage admin access by adding or removing rows in <code>site_admins</code> through the dashboard or SQL editor. Do not use a Supabase secret key or service-role key in browser code.
