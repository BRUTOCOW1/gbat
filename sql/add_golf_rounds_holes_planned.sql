-- How many holes the golfer intended to play this round (may be less than the course total).
alter table public.golf_rounds
  add column if not exists holes_planned integer
  check (holes_planned is null or holes_planned >= 1);

comment on column public.golf_rounds.holes_planned is
  'Intended holes for this round (e.g. 9, 14). Null means full course.';
