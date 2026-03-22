#!/usr/bin/env python3
"""
Convert a single-band elevation GeoTIFF (ground DEM) to a GLB mesh for web viewers.
Subtracts a local origin from X/Y/Z so coordinates are small (Three.js friendly).
Writes a small JSON sidecar with origin + CRS for georeferencing shots later.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import xy
import trimesh
from scipy.ndimage import distance_transform_edt, gaussian_filter


def smooth_dem(z: np.ndarray, nodata: float | None, sigma: float) -> np.ndarray:
    """Gaussian blur on valid cells; keeps nodata holes. Reduces blocky grid look."""
    if sigma <= 0:
        return z
    mask = np.isfinite(z)
    if nodata is not None:
        mask &= z != nodata
    if not np.any(mask):
        return z
    fill = float(np.median(z[mask]))
    z_work = np.where(mask, z, fill)
    smoothed = gaussian_filter(z_work, sigma=sigma, mode="nearest")
    return np.where(mask, smoothed, z)


def fill_holes_near_valid(
    z: np.ndarray,
    nodata: float | None,
    max_radius_px: float,
    sigma: float,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Interpolate nodata cells that are within max_radius_px of real samples.
    Large gaps (e.g. deep canopy) stay empty — avoids inventing terrain far from data.
    """
    mask = np.isfinite(z)
    if nodata is not None:
        mask &= z != nodata
    invalid = ~mask
    if not np.any(invalid) or not np.any(mask):
        return z, mask
    if max_radius_px <= 0 or sigma <= 0:
        return z, mask

    # EDT: distance from each pixel to nearest *zero* in input — use 1=invalid, 0=valid
    dist = distance_transform_edt((~mask).astype(np.uint8))
    fill = float(np.median(z[mask]))
    z_exp = np.where(mask, z, fill)
    z_blur = gaussian_filter(z_exp, sigma=sigma, mode="nearest")
    take = invalid & (dist <= max_radius_px)
    z_out = np.where(take, z_blur, z)
    mask_out = mask | take
    return z_out, mask_out


def build_grid_mesh(
    z: np.ndarray,
    transform,
    nodata: float | None,
    stride: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Regular grid -> vertices (N,3) and triangle faces (M,3).

    *stride* subsamples the DEM (e.g. 2 = every other cell → ~4× fewer triangles).
    World positions use original raster indices: (i*stride, j*stride).
    """
    rows, cols = z.shape
    mask = np.isfinite(z)
    if nodata is not None:
        mask &= z != nodata

    verts: list[list[float]] = []
    ij_to_v: dict[tuple[int, int], int] = {}

    def vid(i: int, j: int) -> int | None:
        if i < 0 or j < 0 or i >= rows or j >= cols:
            return None
        if not mask[i, j]:
            return None
        key = (i, j)
        if key not in ij_to_v:
            ri, rj = i * stride, j * stride
            xs, ys = xy(transform, ri, rj, offset="center")
            h = float(z[i, j])
            ij_to_v[key] = len(verts)
            verts.append([float(xs), float(ys), h])
        return ij_to_v[key]

    faces: list[list[int]] = []
    for i in range(rows - 1):
        for j in range(cols - 1):
            v00 = vid(i, j)
            v01 = vid(i, j + 1)
            v10 = vid(i + 1, j)
            v11 = vid(i + 1, j + 1)
            missing = sum(1 for x in (v00, v01, v10, v11) if x is None)
            if missing == 0:
                faces.append([v00, v10, v11])
                faces.append([v00, v11, v01])
            elif missing == 1:
                # One nodata corner: one triangle covers the quad (stitches edge gaps)
                if v11 is None and v00 is not None and v01 is not None and v10 is not None:
                    faces.append([v00, v10, v01])
                elif v01 is None and v00 is not None and v10 is not None and v11 is not None:
                    faces.append([v00, v10, v11])
                elif v10 is None and v00 is not None and v01 is not None and v11 is not None:
                    faces.append([v00, v01, v11])
                elif v00 is None and v01 is not None and v10 is not None and v11 is not None:
                    faces.append([v01, v10, v11])

    if not verts:
        raise SystemExit("No valid elevation samples; check nodata and SMRF output.")
    v = np.array(verts, dtype=np.float64)
    f = np.array(faces, dtype=np.int64)
    return v, f


def terrain_vertex_colors(z_local: np.ndarray) -> np.ndarray:
    """RGBA uint8 per vertex — readable fairway / rough / high ground (not too dark for screens)."""
    lo = float(np.min(z_local))
    hi = float(np.max(z_local))
    span = hi - lo if hi > lo else 1.0
    t = np.clip((z_local - lo) / span, 0.0, 1.0)
    # Brighter greens → tan on highs (avoids “black terrain” with PBR viewers)
    r = np.interp(t, [0.0, 0.3, 0.55, 0.82, 1.0], [0.12, 0.22, 0.38, 0.55, 0.62])
    g = np.interp(t, [0.0, 0.3, 0.55, 0.82, 1.0], [0.38, 0.58, 0.68, 0.62, 0.55])
    b = np.interp(t, [0.0, 0.3, 0.55, 0.82, 1.0], [0.14, 0.22, 0.28, 0.32, 0.38])
    out = np.zeros((len(z_local), 4), dtype=np.uint8)
    out[:, 0] = np.clip(r * 255, 0, 255).astype(np.uint8)
    out[:, 1] = np.clip(g * 255, 0, 255).astype(np.uint8)
    out[:, 2] = np.clip(b * 255, 0, 255).astype(np.uint8)
    out[:, 3] = 255
    return out


def hillshade_modulate(
    colors_rgba: np.ndarray,
    v: np.ndarray,
    f: np.ndarray,
    strength: float,
) -> np.ndarray:
    """Darken/brighten vertex RGB by a fake sun dot(normal) — extra relief like hillshade."""
    if strength <= 0:
        return colors_rgba
    tm = trimesh.Trimesh(vertices=v, faces=f, process=False)
    vn = np.asarray(tm.vertex_normals, dtype=np.float64)
    sun = np.array([0.45, 0.28, 0.85], dtype=np.float64)
    sun /= np.linalg.norm(sun)
    lambert = np.clip(0.22 + 0.78 * (vn @ sun), 0.12, 1.0)
    blend = (1.0 - strength) + strength * lambert
    out = colors_rgba.astype(np.float64).copy()
    out[:, :3] = np.clip(out[:, :3] * blend[:, np.newaxis], 0, 255)
    return out.astype(np.uint8)


def main() -> None:
    p = argparse.ArgumentParser(description="GeoTIFF DEM -> GLB with local origin.")
    p.add_argument("dem", type=Path, help="Input GeoTIFF (single band elevation)")
    p.add_argument("--out", type=Path, default=Path("course_terrain.glb"))
    p.add_argument("--sidecar", type=Path, default=Path("course_terrain_meta.json"))
    p.add_argument(
        "--vertical-exaggeration",
        type=float,
        default=1.0,
        help="Multiply Z by this after centering (visual only)",
    )
    p.add_argument(
        "--stride",
        type=int,
        default=2,
        metavar="N",
        help="Use every Nth DEM cell in X/Y (~1/N² triangles). Try 2–4 for large courses.",
    )
    p.add_argument(
        "--smooth-sigma",
        type=float,
        default=1.35,
        metavar="SIGMA",
        help="Gaussian smooth in DEM pixels before meshing (0 = off). Reduces blockiness.",
    )
    p.add_argument(
        "--hole-fill-radius",
        type=float,
        default=22.0,
        metavar="PX",
        help="Fill nodata within this many pixels of valid data (native DEM grid). 0 = off.",
    )
    p.add_argument(
        "--hole-fill-sigma",
        type=float,
        default=5.0,
        metavar="SIGMA",
        help="Gaussian sigma used to interpolate filled holes (native pixels).",
    )
    p.add_argument(
        "--hillshade-strength",
        type=float,
        default=0.55,
        metavar="S",
        help="0–1: bake directional shading into vertex colors (CloudCompare-like). 0 = off.",
    )
    args = p.parse_args()

    if args.stride < 1:
        sys.exit("--stride must be >= 1")

    with rasterio.open(args.dem) as src:
        if src.count < 1:
            sys.exit("Expected at least one band")
        z = src.read(1).astype(np.float64)
        nodata = src.nodata
        transform = src.transform
        crs_wkt = src.crs.to_wkt() if src.crs else None

    z = smooth_dem(z, nodata, args.smooth_sigma)
    z, _mask_filled = fill_holes_near_valid(
        z,
        nodata,
        args.hole_fill_radius,
        args.hole_fill_sigma,
    )
    z_sub = z[:: args.stride, :: args.stride]
    v, f = build_grid_mesh(z_sub, transform, nodata, args.stride)

    # Local origin at XY center and min Z for stability (adjust if you prefer true min)
    cx = float((v[:, 0].min() + v[:, 0].max()) / 2.0)
    cy = float((v[:, 1].min() + v[:, 1].max()) / 2.0)
    z0 = float(v[:, 2].min())
    v[:, 0] -= cx
    v[:, 1] -= cy
    v[:, 2] -= z0
    v[:, 2] *= args.vertical_exaggeration

    colors = terrain_vertex_colors(v[:, 2])
    colors = hillshade_modulate(colors, v, f, args.hillshade_strength)
    mesh = trimesh.Trimesh(vertices=v, faces=f, process=False)
    mesh.visual.vertex_colors = colors
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.sidecar.parent.mkdir(parents=True, exist_ok=True)
    mesh.export(args.out)
    tri_count = len(f)
    print(f"Triangles: {tri_count:,}")

    meta = {
        "crs_wkt": crs_wkt,
        "origin_x": cx,
        "origin_y": cy,
        "origin_z": z0,
        "vertical_exaggeration": args.vertical_exaggeration,
        "stride": args.stride,
        "smooth_sigma": args.smooth_sigma,
        "hole_fill_radius": args.hole_fill_radius,
        "hole_fill_sigma": args.hole_fill_sigma,
        "hillshade_strength": args.hillshade_strength,
        "vertex_colors": "height_ramp_grass_plus_hillshade",
        "units": "projected CRS units for X/Y; Z same as DEM unless exaggerated",
        "glb": args.out.name,
    }
    args.sidecar.write_text(json.dumps(meta, indent=2))
    print(f"Wrote {args.out} and {args.sidecar}")


if __name__ == "__main__":
    main()
