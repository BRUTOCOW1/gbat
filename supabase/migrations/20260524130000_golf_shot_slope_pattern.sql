-- Per-distance uphill/downhill putt segments (parallel to break_pattern break chips).
alter table public.golf_shot
  add column if not exists slope_pattern jsonb;

alter table public.golf_shot
  add column if not exists slope_control_points jsonb;

comment on column public.golf_shot.slope_pattern is
  'Putt elevation segments: [{ "slope", "distance_start", "distance_end" }] — queryable uphill/downhill by distance.';

comment on column public.golf_shot.slope_control_points is
  'Side-view slope editor control points [{ "x", "y" }, ...] for round-trip editing.';

-- Backfill from v1 packed break_pattern where slope lived inline.
update public.golf_shot
set
  slope_pattern = break_pattern->'slope',
  slope_control_points = break_pattern->'slopePoints'
where break_pattern is not null
  and jsonb_typeof(break_pattern) = 'object'
  and (break_pattern->>'version') = '1'
  and jsonb_typeof(break_pattern->'slope') = 'array'
  and jsonb_array_length(break_pattern->'slope') > 0
  and slope_pattern is null;
