export interface GolfBag {
    golfbag_id: string;
    name: string;
    user_id: string; // Changed from number to string - Supabase uses UUID strings
  }
  