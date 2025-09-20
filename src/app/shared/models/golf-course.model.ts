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
    id?: string;
    course_id: string;
    hole_number: number;
    par: number;
    handicap?: number;
  
    tee_box_black?: number;
    tee_box_blue?: number;
    tee_box_white?: number;
    tee_box_red?: number;
  }
  
  