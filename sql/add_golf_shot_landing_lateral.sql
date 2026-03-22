-- Run in Supabase SQL Editor (or migrate) so PostgREST accepts landing_lateral on inserts.
-- Error without this: "Could not find the 'landing_lateral' column of 'golf_shot' in the schema cache"

alter table public.golf_shot
  add column if not exists landing_lateral text;

comment on column public.golf_shot.landing_lateral is
  'Lateral landing vs hole/fairway: Left, Center, Right (or empty).';
