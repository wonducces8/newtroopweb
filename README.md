# Troop 1941 website

A responsive static site for Scout Troop 1941 in Leesburg, Virginia, with separate pages for troop details, adventures, calendar, photos, people, and contact.

## Pages

- index.html: home page with animated campsite illustration
- about.html: troop overview and meeting details
- about.html: troop overview, meeting details, camp, skills, and service
- calendar.html: live Google Calendar
- photos.html: public albums with captions, full-aspect photos, and shuffle
- people.html: live patrol and leadership roster
- contact.html: directions and Scoutmaster contact
- admin.html: secure roster, announcement, social link, and photo album editor

## Admin setup

The site uses Supabase Auth, Postgres, and Storage. Follow SETUP.md and run supabase-schema.sql in the Supabase SQL Editor. The public site contains only the project URL and publishable key; row-level security restricts edits and uploads to the authorized admin allowlist. Never add a Supabase secret/service-role key or login password to the site.
