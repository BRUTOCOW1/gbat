export interface GolfShot {
  id?: string;
  hole_id: string;
  club_id: string;
  golfer_club_id?: string;
  club_name?: string; // ✅ added for display / denormalization
  distance: number;
  shot_type: string;
  lie: string;
  result: string; // Keep for backward compatibility, but we'll use result_location and result_quality
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

  // New fields for improved shot entry
  result_location?: string; // Where the ball ended up (Fairway, Green, Thick Rough, etc.)
  result_direction?: string; // Direction miss (Missed Left, Missed Right, Short, Long, etc.)
  result_quality?: string; // Quality of result (Still on Green, etc.)
  putt_speed_quality?: number; // Speed quality gauge for putts (0-100)
  is_kick_in?: boolean; // Flag for kick-in putts that skip detailed entry
}
