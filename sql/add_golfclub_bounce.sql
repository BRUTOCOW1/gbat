-- Run in Supabase SQL editor if migrations are not applied via CLI.
alter table public.golfclub
  add column if not exists bounce double precision;

comment on column public.golfclub.bounce is 'Sole bounce angle in degrees; mainly for wedges.';
