# Local terrain preview

Put your generated files here so `ng serve` can load them without Supabase:

- `lions_course.glb` — mesh from `dem_to_glb.py`
- (optional) `lions_course_meta.json` — sidecar; the preview page can be extended to read it later

**Do not commit large GLB files** if you use Git LFS or prefer to keep them out of the repo—this folder is for local dev only.

Then open: **http://localhost:4200/dev/terrain-local**

To use another filename, either rename to `lions_course.glb` or change `glbAssetPath` in `terrain-local-preview.component.ts`.
