-- First hole number in the planned range (e.g. 10 for back nine on an 18-hole course).
alter table public.golf_rounds
  add column if not exists holes_start integer not null default 1
  check (holes_start >= 1);

comment on column public.golf_rounds.holes_start is
  'First hole number in this round (default 1; 10 for back nine on 18-hole courses).';
