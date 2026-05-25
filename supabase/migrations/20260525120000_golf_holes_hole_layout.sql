-- Schematic 2D overhead hole diagram (authoring / shot placement).
alter table public.golf_holes
  add column if not exists hole_layout jsonb,
  add column if not exists hole_layout_status text
    default 'none'
    check (hole_layout_status in ('none', 'draft', 'published'));

comment on column public.golf_holes.hole_layout is
  'Top-down schematic: versioned polygons, tee/pin (normalized viewBox coords)';

comment on column public.golf_holes.hole_layout_status is
  'none = use client template by par; draft/published = use hole_layout when set';
