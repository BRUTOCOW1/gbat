export interface GolfShot {
  id?: string;
  hole_id: string;
  club_id: string;
  distance: number;
  shot_type: string;
  lie: string;
  result: string;
  stroke_number: number;

  // ✅ Mark these optional
  trajectory?: string;
  shape?: string;

  // Optional already (or should be)
  shot_intent?: string;
  contact?: string;
  contact_severity?: number;
  impact_location?: string;
  putt_length?: number;
  slope?: string;
  grain_direction?: string;
  green_speed?: number;
  read_quality?: string;
  break_pattern?: any; // or more specific type
  notes?: string;
}
