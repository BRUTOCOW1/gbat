export interface GolfCourse {
  id: string;
  name: string;
  location: string;
  rating?: number;
  slope?: number;
  par?: number;
  external_id?: string;
  holes: GolfHole[];
}

export interface GolfHole {
  id?: string;
  course_id: string;
  hole_number: number;
  par: number;
  handicap?: number;

  tee_box_black?: number;
  tee_box_blue?: number;
  tee_box_white?: number;
  tee_box_red?: number;

  /** 3D terrain / LiDAR pipeline — see supabase/migrations */
  terrain_status?: 'none' | 'pending' | 'ready' | 'failed' | 'fallback';
  terrain_bbox_min_lng?: number | null;
  terrain_bbox_min_lat?: number | null;
  terrain_bbox_max_lng?: number | null;
  terrain_bbox_max_lat?: number | null;
  pin_lng?: number | null;
  pin_lat?: number | null;
  terrain_mesh_url?: string | null;
  terrain_asset_version?: number;
  elevation_source?: string | null;
  elevation_processed_at?: string | null;
  terrain_vertical_exaggeration?: number | null;
  terrain_meta?: Record<string, unknown> | null;
}

