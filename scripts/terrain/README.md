# Whole-course terrain: LAZ → DEM → GLB

Repeatable pipeline (no CloudCompare required for the export). Adjust paths to your machine.

## 1. Install tools

**Ubuntu / Debian**

```bash
sudo apt update
sudo apt install -y pdal gdal-bin python3-pip python3-venv
```

**Python deps** (use a venv in this folder):

```bash
cd scripts/terrain
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2. Inspect the LAZ

```bash
pdal info /path/to/your.laz
pdal info /path/to/your.laz --summary
```

Note **CRS** and **bounds**. If something fails later, this is the reference.

## 3. Build a PDAL pipeline for ground + GeoTIFF

1. Copy `pipeline_smrf_dem.json` to e.g. `pipeline_lions.json`.
2. Replace `REPLACE_WITH_INPUT.laz` with the **absolute path** to your file.
3. Replace `REPLACE_WITH_OUTPUT.tif` with where you want the DEM (e.g. `/tmp/lions_dem_1m.tif`).

Run:

```bash
pdal pipeline pipeline_lions.json -v Debug
```

**What it does:** `filters.smrf` finds ground points, `filters.range` keeps classification **2** (ground), `writers.gdal` rasterizes **Z** to a GeoTIFF at **1 m** resolution.

**Tuning:** If the DEM is empty or noisy, try changing `resolution` (e.g. `0.5` or `2.0`) or SMRF `cell` / `window` in the JSON. If `Classification[2:2]` filters everything out, temporarily **remove** the `filters.range` stage and rasterize all post-SMRF points (check PDAL docs for your version).

## 4. Optional: clip before rasterizing

To shrink TIFF size to the course polygon, add a PDAL **crop** filter (bounds or WKT polygon) **before** `filters.smrf` in the same JSON. Get bounds from `pdal info` or QGIS.

## 5. DEM → GLB (mesh)

From `scripts/terrain` with venv activated:

```bash
python3 dem_to_glb.py /tmp/lions_dem_1m.tif --out lions_course.glb --sidecar lions_course_meta.json
```

This writes a **GLB** with **small coordinates** (centered) and a **JSON** sidecar with `origin_x/y/z` and CRS so you can map taps back to real coordinates in app code.

## 6. Upload and wire the app

1. Upload `lions_course.glb` (and optionally `lions_course_meta.json`) to **Supabase Storage** or any HTTPS host.
2. Store the public URL on **`golf_courses`** (recommended for whole-course mesh) or duplicate the same URL on each **`golf_holes`** row for that course.
3. In the Angular viewer, load the GLB; when saving a shot, transform **local vertex position + sidecar origin** back to **WGS84** using `pyproj` in a small API or precomputed metadata.

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| `pdal: command not found` | `apt install pdal` |
| Empty or flat DEM | SMRF params; clip; check CRS; try without `filters.range` |
| Huge GLB | Increase raster cell size; decimate mesh (add step later) |
| Python import errors | Activate venv; `pip install -r requirements.txt` |
