export interface GolfShot {
  id?: string;
  hole_id: string;
  club_id: string;
  golfer_club_id?: string;
  club_name?: string; // ✅ added for display / denormalization
  distance: number;
  shot_type: string;
  lie: string;
  result: string;
  stroke_number: number;

  // Optional shot details
  trajectory?: string;
  shape?: string;
  shot_intent?: string;
  contact?: string;
  contact_severity?: number;
  impact_location?: string;
  putt_length?: number;
  slope?: string;
  grain_direction?: string;
  green_speed?: number;
  read_quality?: string;
  break_pattern?: any;
  notes?: string;

  // ✅ Add these for penalties
  penalty?: 'none' | 'stroke_only' | 'stroke_and_distance' | 'drop' | 'unplayable';
  penalty_strokes?: number;
}
