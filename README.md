# Troop 1941 website

A responsive static site for Scout Troop 1941 in Leesburg, Virginia, with separate pages for troop details, adventures, calendar, photos, people, and contact.

## Pages

- index.html: home page with animated campsite illustration
- about.html: troop overview and meeting details
- adventures.html: camp, skills, and service
- calendar.html: live Google Calendar
- photos.html: troop slideshow
- people.html: live patrol and leadership roster
- contact.html: directions and Scoutmaster contact
- admin.html: secure editor for rosters, home announcements, and shared troop photos

## Admin setup

The admin editor uses Supabase Auth, Postgres, and Storage for rosters, announcements, and a public shuffled photo gallery. Follow SETUP.md and run supabase-schema.sql in the Supabase SQL Editor. The site uses only the project URL and publishable key in config.js; row-level security limits edits, uploads, and deletes to the admin allowlist. Never add a Supabase secret/service-role key or login password to the site.

The static site can be hosted by any service that serves the files from this repository.