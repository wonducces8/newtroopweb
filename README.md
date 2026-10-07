# Troop 1941 website

A responsive static site for Scout Troop 1941 in Leesburg, Virginia, with pages for troop details, adventures, calendar, photos, people, and contact.

## Pages

- `index.html`: home page with animated campsite illustration
- `about.html`: troop overview, meeting details, camp, skills, and service
- `calendar.html`: live Google Calendar
- `photos.html`: public albums, newest-first photos, optional captions, member uploads, and a scrollable full-screen viewer
- `people.html`: live patrol and leadership roster
- `contact.html`: directions and Scoutmaster contact
- `login.html`: shared site sign-in and approved member account requests
- `admin.html`: member approvals, roster, announcement, social links, and photo administration

## Setup

Follow [SETUP.md](SETUP.md). Run `supabase-schema.sql`, then `supabase-members-migration.sql`. The public site contains only the Supabase project URL and publishable key. Database row-level security requires admin approval before member photo tools are available. Never commit secret or service-role keys.
