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


def build_grid_mesh(z: np.ndarray, transform, nodata: float | None) -> tuple[np.ndarray, np.ndarray]:
    """Regular grid -> vertices (N,3) and triangle faces (M,3)."""
    rows, cols = z.shape
    mask = np.isfinite(z)
    if nodata is not None:
        mask &= z != nodata
    # Optional: fill small holes with nanmean neighbors — skip for v1

    verts: list[list[float]] = []
    ij_to_v: dict[tuple[int, int], int] = {}

    def vid(i: int, j: int) -> int | None:
        if i < 0 or j < 0 or i >= rows or j >= cols:
            return None
        if not mask[i, j]:
            return None
        key = (i, j)
        if key not in ij_to_v:
            xs, ys = xy(transform, i, j, offset="center")
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
            if None in (v00, v01, v10, v11):
                continue
            faces.append([v00, v10, v11])
            faces.append([v00, v11, v01])

    if not verts:
        raise SystemExit("No valid elevation samples; check nodata and SMRF output.")
    v = np.array(verts, dtype=np.float64)
    f = np.array(faces, dtype=np.int64)
    return v, f


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
    args = p.parse_args()

    with rasterio.open(args.dem) as src:
        if src.count < 1:
            sys.exit("Expected at least one band")
        z = src.read(1).astype(np.float64)
        nodata = src.nodata
        transform = src.transform
        crs_wkt = src.crs.to_wkt() if src.crs else None

    v, f = build_grid_mesh(z, transform, nodata)

    # Local origin at XY center and min Z for stability (adjust if you prefer true min)
    cx = float((v[:, 0].min() + v[:, 0].max()) / 2.0)
    cy = float((v[:, 1].min() + v[:, 1].max()) / 2.0)
    z0 = float(v[:, 2].min())
    v[:, 0] -= cx
    v[:, 1] -= cy
    v[:, 2] -= z0
    v[:, 2] *= args.vertical_exaggeration

    mesh = trimesh.Trimesh(vertices=v, faces=f, process=False)
    mesh.export(args.out)

    meta = {
        "crs_wkt": crs_wkt,
        "origin_x": cx,
        "origin_y": cy,
        "origin_z": z0,
        "vertical_exaggeration": args.vertical_exaggeration,
        "units": "projected CRS units for X/Y; Z same as DEM unless exaggerated",
        "glb": args.out.name,
    }
    args.sidecar.write_text(json.dumps(meta, indent=2))
    print(f"Wrote {args.out} and {args.sidecar}")


if __name__ == "__main__":
    main()
