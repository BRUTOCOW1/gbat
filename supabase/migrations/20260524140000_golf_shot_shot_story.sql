-- Rich optional shot facets (technique, ground game, carry vs plan, etc.)
alter table public.golf_shot
  add column if not exists shot_story jsonb;

comment on column public.golf_shot.shot_story is
  'ShotStory v1: techniques[], carry_vs_plan, ground_plan/actual, landing_terrain, strike_feel, note — parallel to trajectory/shape/contact columns.';
