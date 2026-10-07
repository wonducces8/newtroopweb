# Troop 1941 site and account setup

The public site uses GitHub Pages. Supabase provides sign-in, approved member photo uploads, the roster editor, and the photo library.

## Supabase database

1. In Supabase Dashboard → SQL Editor, run `supabase-schema.sql` if the original site schema has not been installed.
2. Then run `supabase-members-migration.sql`. This adds signup requests, admin approval, and contributor/curator permissions while preserving the existing photo albums and admin accounts.
3. In Authentication → Providers, enable Email sign-in and allow new signups. Keep email confirmation enabled. New signups get a pending account request automatically; they cannot upload until an administrator approves them.
4. In Authentication → URL Configuration, set the Site URL to the published troop website and add its `/login.html` URL to the allowed redirect URLs.
5. Keep the existing `site_admins` allowlist. Only accounts in that table can edit the roster, announcements, social links, or approve and assign photo roles.

The browser uses only the project URL and publishable key in `config.js`. Never put a Supabase secret key, service-role key, Resend key, or webhook secret in site files.

## Member permissions

- Anyone can browse the public troop site and photo archive.
- Scouts and adults can create an account and confirm their email. New accounts remain pending until an administrator approves them.
- A **Photo contributor** can upload photos into existing albums. Uploads appear in the public archive immediately.
- A **Photo curator** can upload, create albums, move photos, edit captions, and remove photos. Curators can remove only empty albums.
- A site administrator can approve/reject accounts, assign or change contributor/curator access, and use the existing site editors.

Administrators review requests in Admin → Member account access. They can later change a role or revoke access there. A revoked account can still sign in but cannot use photo tools.

## Email alerts for new requests

The repository includes `supabase/functions/photo-request-notification`. Deploy it as the `photo-request-notification` Edge Function in Supabase. Store these values in Supabase Dashboard → Edge Functions → Secrets:

- `RESEND_API_KEY`: your Resend API key.
- `RESEND_FROM_EMAIL`: a sender address on your verified Resend domain.
- `ADMIN_NOTIFICATION_EMAIL`: where access request alerts should go.
- `PHOTO_WEBHOOK_SECRET`: a random private value you create.
- `SITE_ADMIN_URL` (optional): the published `admin.html` URL used in the notification.

Do not send these secrets in chat or commit them to GitHub. In Database → Webhooks, create a webhook for **INSERT** on `public.photo_access_requests`, pointing to:

`https://YOUR-PROJECT-REF.supabase.co/functions/v1/photo-request-notification`

Add an `x-webhook-secret` request header with the same private value saved as `PHOTO_WEBHOOK_SECRET`. The function checks that header before sending through Resend. Its JWT verification is disabled because the database webhook authenticates with this private header.

Supabase function deployment guide: [Deploy Edge Functions](https://supabase.com/docs/guides/functions/deploy). Manage production secrets in the [Supabase Dashboard](https://supabase.com/dashboard/project/_/functions/secrets).

## Photo archive

Photos are resized to at most 2048 px on their longest side and converted to WebP while preserving their aspect ratio. Captions are optional and hidden from the public gallery when blank. The gallery starts newest first; visitors can shuffle it. The full-screen viewer keeps the whole image reachable, including tall photos.

Only upload images that are appropriate for public sharing. Member uploads publish immediately; curators and administrators can remove them from the archive.
