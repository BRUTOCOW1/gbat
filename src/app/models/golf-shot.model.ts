export interface GolfShot {
    id?: string;
    hole_id: string;
    club_id: string;
    distance?: number;
    shot_type: 'Tee Shot' | 'Approach' | 'Chip' | 'Putt';
    lie: 'Fairway' | 'Rough' | 'Bunker' | 'Green' | 'Water' | 'OB';
    result: 'Fairway' | 'Bunker' | 'OB' | 'Water' | 'Green' | 'Missed' | 'Made';
    stroke_number: number;
    created_at?: string;
  }
  