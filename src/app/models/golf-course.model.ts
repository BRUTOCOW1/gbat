export interface GolfCourse {
    id: string;
    name: string;
    location: string;
    rating?: number;
    slope?: number;
    par?: number;
    holes: GolfHole[];
  }
  
  export interface GolfHole {
    hole_number: number;
    par: number;
    yardage: number;
    handicap?: number;
  }
  