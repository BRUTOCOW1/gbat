-- Terrain / 3D hole renderer support (US: USGS 3DEP-backed pipeline).
-- Table name matches app usage: golf_holes

alter table public.golf_holes
  add column if not exists terrain_status text
    default 'none'
    check (terrain_status in ('none', 'pending', 'ready', 'failed', 'fallback'));

-- WGS84 bounding box for clipping DEM / framing the mesh (min/max lon/lat)
alter table public.golf_holes
  add column if not exists terrain_bbox_min_lng double precision,
  add column if not exists terrain_bbox_min_lat double precision,
  add column if not exists terrain_bbox_max_lng double precision,
  add column if not exists terrain_bbox_max_lat double precision;

-- Optional pin position for camera aim & distance checks (if not stored elsewhere)
alter table public.golf_holes
  add column if not exists pin_lng double precision,
  add column if not exists pin_lat double precision;

-- Processed asset served to the client (Supabase Storage or CDN URL)
alter table public.golf_holes
  add column if not exists terrain_mesh_url text;

alter table public.golf_holes
  add column if not exists terrain_asset_version integer not null default 1;

-- Provenance & pipeline bookkeeping
alter table public.golf_holes
  add column if not exists elevation_source text; -- e.g. usgs_3dep_1m, usgs_13as_fallback

alter table public.golf_holes
  add column if not exists elevation_processed_at timestamptz;

-- Renderer hints (defaults can be overridden per hole)
alter table public.golf_holes
  add column if not exists terrain_vertical_exaggeration double precision default 1.0;

-- Extra parameters without schema churn (CRS notes, tile ids, mesh stats, errors)
alter table public.golf_holes
  add column if not exists terrain_meta jsonb default '{}'::jsonb;

comment on column public.golf_holes.terrain_status is 'Pipeline state for 3D terrain asset';
comment on column public.golf_holes.terrain_bbox_min_lng is 'WGS84 bbox for DEM clip / mesh extent';
comment on column public.golf_holes.terrain_mesh_url is 'Public URL to mesh or heightfield package (e.g. GLB + sidecar JSON)';
comment on column public.golf_holes.elevation_source is 'Which elevation product was used (USGS 3DEP tier, etc.)';
