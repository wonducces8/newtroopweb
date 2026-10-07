-- Enable saved photo assignments for the refreshed site.
alter table public.troop_content drop constraint if exists troop_content_key_check;
alter table public.troop_content add constraint troop_content_key_check
  check (key in ('patrols', 'leaders', 'announcement', 'socials', 'visuals'));
