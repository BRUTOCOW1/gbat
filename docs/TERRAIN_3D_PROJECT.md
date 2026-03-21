# 3D golf hole terrain — project suggestions

This document distills recommendations for the **US-only**, **“fast beats perfect”** hole renderer: LiDAR-backed elevation where possible, tap-to-place shots, Supabase-backed metadata and assets.

---

## 1. Goals and non-goals

**Goals**

- Shot entry on phone that feels **easier** than typing or 2D-only maps.
- **Repeatable pipeline**: new hole → bbox + optional processing → mesh URL → client loads and raycasts.
- **Honest fidelity**: good enough to recognize terrain; not survey-grade certification.

**Non-goals (for early versions)**

- Perfect bunker/green micro-topography.
- Global coverage (v1 is US).
- Real-time streaming of massive point clouds in-app.

---

## 2. When elevation downloads are unavailable (outages)

Outages at **USGS National Map**, **AWS Open Data** mirrors, or your own network should not block all progress.

**Parallel tracks that need no live DEM download**

1. **Schema and API** — `golf_holes` terrain columns (already sketched), RLS policies, Storage bucket for `terrain_mesh_url`, signed URLs if private.
2. **Renderer vertical slice** — Three.js (or chosen stack) with a **synthetic heightfield**: plane + `Math.sin` / Perlin noise, or a **small committed fixture** (tiny JSON/GLB checked into repo for dev only). Proves camera, picking, and shot persistence.
3. **Coordinate contract** — Define how a tap becomes **WGS84** (or stored **local ENU + hole origin**) and how that maps to your existing `golf_shot` model.
4. **Pipeline code structure** — Interfaces for “fetch DEM → raster → mesh → upload”; **mock implementation** returns fixture URL until downloads work.
5. **Fallback elevation** — If long-term you use **Open-Elevation**, **Mapbox Terrain-RGB**, or **copernicus**-style global DEMs for non-US later, keep the same **heightfield → mesh** stage so only the *source* swaps.

**Caches**

- If you ever successfully download tiles, **retain them in versioned object storage** (or local artifact cache in CI) so rebuilds do not depend on the live service being up.

---

## 3. Elevation data strategy (US)

| Tier | Source | Typical use |
|------|--------|-------------|
| **Preferred** | USGS **3DEP** LiDAR-derived seamless DEMs (often **1 m** in much of CONUS) | Primary pipeline |
| **Fallback** | USGS **1/3 arc-second** (~10 m) national DEM | Coverage gaps or quick pass |
| **Emergency** | Global DEM (e.g. **Copernicus GLO-30**) | Only if USGS is down long-term and legal/terms allow |

**Store in DB** (`elevation_source`, `terrain_meta`) which product and date were used for reproducibility and support.

---

## 4. Supabase data model (summary)

Already aligned with migration ideas on `golf_holes`:

- **Framing**: `terrain_bbox_*` (WGS84) with buffer applied in the pipeline, not necessarily stored twice.
- **Pin**: `pin_lng`, `pin_lat` for camera and distance UX.
- **Delivery**: `terrain_mesh_url`, `terrain_asset_version`, `terrain_status`.
- **Provenance**: `elevation_source`, `elevation_processed_at`, `terrain_meta` (JSON).

**Optional later**

- `golf_courses` level: default **terrain provider** or **org-wide bucket prefix**.
- **Storage**: bucket `terrain-meshes/{course_id}/{hole_id}/v{n}.glb` (or packed zip with sidecar JSON).

---

## 5. Offline / batch pipeline (recommended shape)

1. **Input**: `hole_id` → load bbox (and course location sanity check).
2. **Fetch**: DEM GeoTIFF(s) covering bbox + margin (e.g. 50–150 m).
3. **Normalize**: single CRS for sampling (local **ENU** per hole is ideal for stable meshes; document origin in `terrain_meta`).
4. **Resample**: fixed grid resolution (e.g. 1–3 m for mobile budget) → height array.
5. **Mesh**: indexed plane or skirted terrain; **decimate** to triangle budget.
6. **Export**: **glTF/GLB** (Three.js-friendly) + small **JSON** (bounds, origin, exaggeration, units).
7. **Upload** → set `terrain_mesh_url`, bump `terrain_asset_version`, set `terrain_status = ready`.

Run as **CLI**, **GitHub Action**, or **queue worker** — not in the Angular app.

---

## 6. Client (Angular) renderer

- **Load** GLB from `terrain_mesh_url` (with version query string).
- **Controls**: orbit / pinch-zoom; constrain pitch for usability.
- **Pick**: raycast to terrain; show marker; optional drag to refine.
- **Persist**: shot position in the same coordinate system your backend expects (lat/lon or ENU + metadata).

**Performance**

- Single material where possible; limit texture size; test on **mid-tier Android**.

---

## 7. Product and content workflow

- **Authoring bbox**: start **manual** (map click rectangle) or from **tee + green + buffer**; refine later.
- **QA**: flag holes with `terrain_status = failed` and show 2D fallback UI.
- **Versioning**: never overwrite in place; new version = new object or new `v` in path + version column bump.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Provider outage | Cached tiles; synthetic dev fixtures; fallback DEM tier |
| Bad bbox | Validation (min/max, area limits); preview in internal tool |
| Mobile perf | Triangle budget, LOD later |
| Licensing | Confirm terms for each DEM and for redistribution of derived meshes |
| Stale terrain | `elevation_processed_at`; optional “regenerate” admin action |

---

## 9. Suggested phases

| Phase | Outcome |
|-------|---------|
| **0** | Schema + Storage + fixture mesh + tap-to-place + persist shot (no real DEM) |
| **1** | Batch job + USGS 3DEP when available → real meshes for pilot courses |
| **2** | Fallback DEM path + `terrain_status = fallback` UX |
| **3** | Polish: materials, pin line, distance arc, optional 2D map sync |

---

## 10. Alignment with GBAT stack

- **Angular** app: viewer component + service loading mesh by `hole_id`.
- **Supabase**: `golf_holes` fields + Storage; optional Edge Function to **sign** URLs.
- **Existing rounds/shots**: extend shot model only if needed (e.g. store `placement_lng`, `placement_lat`, or structured `lie` from 3D).

This keeps elevation **out of the request path** for players: they only fetch **small processed assets**.
