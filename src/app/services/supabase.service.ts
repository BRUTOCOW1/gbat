
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { GolfBag } from '../models/golf-bag.model';
import { GolfShot } from '../models/golf-shot.model';
import { GolfClub } from '../models/golf-club.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private authStateSubject = new BehaviorSubject<boolean>(false);
  authState$ = this.authStateSubject.asObservable();

  constructor() {
    this.supabase = createClient(
      'https://mgpgbijsyiwkappxedfu.supabase.co', // Replace with your Supabase URL
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncGdiaWpzeWl3a2FwcHhlZGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyMDY4NDQsImV4cCI6MjA1MTc4Mjg0NH0.IkpfzHy9xE00p7GjbSyhg30H_5hZ7_4zHFJoXhBTdmY' // Replace with your Supabase Anon Key
    );
    this.initializeAuthListener();
  }


  // ==================== AUTH METHODS ====================

  async createUser(email: string, password: string) {
    const result = await this.supabase.auth.signUp({ email, password });
    console.log('Supabase auth.signUp response:', result);
    return result;
  }

  /** Sign in an existing user */
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Sign-in failed: ${error.message}`);
    return  { user: data.user, session: data.session, error };;
  }

  /** Get the currently authenticated user */
  async getUser(): Promise<User | null> {
    const { data, error } = await this.supabase.auth.getUser();
    if (error) {
      console.error('Error fetching user:', error.message);
      return null;
    }
    return data.user;
  }

  async getCurrentUser(): Promise<any> {
  const { data, error } = await this.supabase.auth.getUser();
  if (error) {
    console.error('Error fetching current user:', error.message);
    return null;
  }

  return data?.user;
}

  /** Get the current authentication session */
  async getSession() {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) {
      console.error('Error fetching session:', error.message);
      return null;
    }
    return data.session;
  }

  /** Sign out the current user */
  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) console.error('Error signing out:', error.message);
    this.authStateSubject.next(false);
  }

  /** Listen for authentication state changes */
  private initializeAuthListener() {
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.authStateSubject.next(!!session);
    });
  }

  // ==================== USER METHODS ====================

  /** Get all users from the users view */
  async getUsers(): Promise<User[] | null> {
    const { data, error } = await this.supabase.from('users_view').select('*');
    if (error) {
      console.error('Error fetching users:', error.message);
      return null;
    }
    return data;
  }

  // ==================== PROFILE METHODS ====================

  /** Get current user's profile */
  async getProfile(): Promise<any> {
    const { data, error } = await this.supabase.from('profile').select('*').single();
    if (error) {
      console.error('Error fetching profile:', error.message);
      return null;
    }
    return data;
  }

  /** Create a user profile */
  async createProfile(profile: { id: string; name: string; email: string; height: number; weight: number; sex: string }) {
    return await this.supabase.from('profile').insert(profile).select('*');
  }

  /** Get profile by user ID */
  async getProfileById(userId: string) {
    const { data, error } = await this.supabase.from('profile').select('*').eq('id', userId).single();
    if (error) {
      console.error('Error fetching profile:', error.message);
      return null;
    }
    return data;
  }

  // ==================== GOLF BAG METHODS ====================

  /** Create a new golf bag */
  async createGolfBag(bag: { user_id: string; name: string }) {
    return await this.supabase.from('golfbag').insert(bag).select('*');
  }

  /** Get all golf bags */
  async getGolfBags() {
    return await this.supabase.from('golfbag').select('*');
  }

  /** Get golf bags by user ID */
  async getGolfBagsByUser(userId: string): Promise<{ data: GolfBag[] | null; error: any }> {
    return await this.supabase.from('golfbag').select('*').eq('user_id', userId);
  }

  /** Get a golf bag by its ID */
  async getGolfBagById(bagId: string) {
    const { data, error } = await this.supabase.from('golf_bags').select('*').eq('id', bagId).single();
    if (error) {
      console.error('Error fetching golf bag:', error.message);
      throw error;
    }
    return data;
  }

  /** Update a golf bag's club IDs */
  async updateGolfBagClubIds(bagId: string, clubIds: string[]) {
    const { data, error } = await this.supabase.from('golf_bags').update({ golf_club_ids: clubIds }).eq('id', bagId);
    if (error) {
      console.error('Error updating golf bag:', error.message);
      throw error;
    }
    return data;
  }

  // ==================== GOLF CLUB METHODS ====================

  /** Get all golf clubs */
  async getAllClubs() {
    return await this.supabase.from('golfclub').select('*');
  }

  /** Get clubs by golf bag ID */
  async getClubsByBag(golfBagId: string) {
    return await this.supabase.from('golfclub').select('*').eq('golfbag_id', golfBagId);
  }

  /** Add a club to a bag */
  async addClubToBag(club: { golf_bag_id: string; first: string; last: string; loft: string }) {
    return await this.supabase.from('golfclub').insert(club).select('*');
  }

  /** Remove a club from a bag */
  async removeClub(clubId: string) {
    return await this.supabase.from('golfclub').delete().eq('golfclub_id', clubId);
  }

  /** Search for golf clubs by maker and/or category */
  async searchClubs(maker?: string, category?: string) {
    let query = this.supabase.from('golfclub').select('*');

    if (maker) query = query.ilike('maker', `%${maker}%`);
    if (category) query = query.eq('category', category);

    return await query;
  }

  // ==================== GOLFER-CLUB RELATIONSHIPS ====================

/** Get a golfer's club by user ID and club ID */
async getGolferClub(golferId: string, clubId: string) {
  return await this.supabase
    .from('golfer_club')
    .select('*')
    .eq('golfer_id', golferId)
    .eq('club_id', clubId);
}

/** Assign a club to a golfer */
async createGolferClub(golferClub: { golfer_id: string; club_id: string; cur_bag_id: string }) {
  return await this.supabase.from('golfer_club').insert(golferClub).select('*');
}


  /** Get clubs assigned to a user in a specific bag */
  async getClubsByBagId(bagId: string, userId: string) {
    return await this.supabase.from('golfer_club').select('club_id').eq('golfer_id', userId).eq('cur_bag_id', bagId);
  }

  /** Get club details from a list of club IDs */
  async getClubsFromIds(clubIds: string[]) {
    return await this.supabase.from('golfclub').select('*').in('id', clubIds);
  }
  /** Get golfer_club entry for a given golfer and club */
async getGolferClubEntry(golferId: string, clubId: string) {
  return await this.supabase
    .from('golfer_club')
    .select('*')
    .eq('golfer_id', golferId)
    .eq('club_id', clubId);
}


 // ==================== GOLF COURSE RELATIONSHIPS ====================

  // ==================== GOLF COURSE METHODS ====================

  /** Search for golf courses by name */
  async searchGolfCourses(query: string) {
    const { data, error } = await this.supabase
      .from('golf_courses')
      .select('*')
      .ilike('name', `%${query}%`);

    if (error) {
      console.error('Error searching for courses:', error.message);
      return [];
    }
    return data;
  }

  /** Get a golf course by ID */
  async getGolfCourseById(courseId: string) {
    const { data, error } = await this.supabase
      .from('golf_courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (error) {
      console.error('Error fetching course:', error.message);
      return null;
    }
    return data;
  }

  /** Get holes for a given golf course */
  async getGolfHolesByCourseId(courseId: string) {
    const { data, error } = await this.supabase
      .from('golf_holes')
      .select('*')
      .eq('course_id', courseId)
      .order('hole_number', { ascending: true });

    if (error) {
      console.error('Error fetching holes:', error.message);
      return [];
    }
    return data;
  }

  async getGolfCourseNameById(courseId: string) {
    const { data, error } = await this.supabase
    .from('golf_courses')
    .select('name')
    .eq('id', courseId)

  if (error) {
    console.error('Error fetching Course Name:', error.message);
    return [];
  }
  return data;
  }


    // ==================== GOLF ROUND METHODS ====================

/** Get golf rounds by user ID */
  async getGolfRoundsByUser(userId: string) {
    return await this.supabase.from('golf_rounds').select('*').eq('user_id', userId);
  }


/** Get golf round by round ID */
async getGolfRoundById(round_id: string) {
  return await this.supabase.from('golf_rounds').select('*').eq('id', round_id);
}

/** Create a new golf round */
  async createGolfRound(round: {
    user_id: string;
    date_played: string;
    weather: string;
    golf_bag_id: string;
    course_id: string;
  }) {
    return await this.supabase.from('golf_rounds').insert(round).select('*');
  }

  /** Get all golf courses */
  async getAllGolfCourses() {
    return await this.supabase.from('golf_courses').select('*');
  }


    // ==================== GOLF SHOT METHODS ====================
  async addGolfShot(shot: GolfShot) {
    console.log(shot);
    const { data, error } = await this.supabase
      .from('golf_shot')
      .insert([shot])
      .select();

    if (error) throw error;
    return data;
  }


  async deleteShot(shot_id: string) {
    const { error } = await this.supabase
      .from('golf_shot')
      .delete()
      .eq('id', shot_id);

    if (error) throw error;
  }


  async getShotsForHole(holeNumber: number, courseId: string) {
    // Fetch hole ID from golf course and hole number
    const response = await this.getGolfHoleId(courseId, holeNumber);

    if (!response || response.error || !response.data || response.data.length === 0) {
        console.error("Error fetching hole ID or no data returned:", response?.error);
        return null; // Handle error properly
    }

    const hole_id = response.data[0].id; // Extract hole ID safely
    console.log("Hole ID:", hole_id);

    // Fetch shots using the correct hole ID
    const { data, error } = await this.supabase
        .from('golf_shot')
        .select('*')
        .eq('hole_id', hole_id)
        .order('stroke_number', { ascending: true });

    if (error) {
        console.error("Error fetching shots:", error);
        return null; // Handle error
    }

    console.log(data);

    return data; // Return only the fetched shot data
}

async getShotsForPlayedHole(played_hole_id: string) {
  // Fetch hole ID from golf course and hole number


  // Fetch shots using the correct hole ID
  const { data, error } = await this.supabase
      .from('golf_shot')
      .select('*')
      .eq('hole_id', played_hole_id)
      .order('stroke_number', { ascending: true });

  if (error) {
      console.error("Error fetching shots:", error);
      return null; // Handle error
  }

  console.log(data);

  return data; // Return only the fetched shot data
}


      // ==================== GOLF HOLE METHODS ====================
  async getGolfHoleId(courseId: string, holeNumber: number) {
    return await this.supabase.from('golf_holes').select('id').eq('course_id', courseId).eq('hole_number', holeNumber);
   }

  async getGolfHoleDetails(courseId: string, holeNumber: number) {
    const response = await this.supabase
      .from('golf_holes')
      .select('*')
      .eq('course_id', courseId)
      .eq('hole_number', holeNumber)
      .single(); // Fetch only one result
  
    return response; // Returns { data, error }
  }
  


  /** Get `played_golf_hole` entry for a specific round & hole */
  async getPlayedHole(roundId: string, holeId: string) {
    return await this.supabase
      .from('played_golf_hole')
      .select('id')  // ✅ Select only the ID for accuracy
      .eq('round_id', roundId)
      .eq('hole_id', holeId);
  }


  /** Create a new `played_golf_hole` entry */
  async createPlayedHole(entry: { round_id: string; hole_id: string; strokes: number }) {
    return await this.supabase
      .from('played_golf_hole')
      .insert([entry])
      .select('*');
  }

  async get_golferci_from_golfci(golf_ci: string) {
    return await this.supabase.from('golfer_club').select('id').eq('club_id', golf_ci);
  }

  /** ✅ Increment strokes in played_golf_hole */
  async incrementHoleStrokeCount(playedHoleId: string) {
    const { error } = await this.supabase
      .from('played_golf_hole')
      .update({ strokes: this.supabase.rpc('increment_strokes', { row_id: playedHoleId }) })
      .eq('id', playedHoleId);

    if (error) {
      console.error("Error updating hole strokes:", error);
    }
  }

  /** ✅ Increment total strokes in golf_rounds */
  async incrementRoundStrokeCount(roundId: string) {
    const { error } = await this.supabase
      .from('golf_rounds')
      .update({ total_strokes: this.supabase.rpc('increment_strokes', { row_id: roundId }) })
      .eq('id', roundId);

    if (error) {
      console.error("Error updating round strokes:", error);
    }
  }

  async updatePlayedHoleStrokes(playedHoleId: string, strokes: number) {
      const { error } = await this.supabase
          .from('played_golf_hole')
          .update({ strokes: strokes })
          .eq('id', playedHoleId);

      if (error) {
          console.error("Error updating strokes:", error);
      }
  }

}
