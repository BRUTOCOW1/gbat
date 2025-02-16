
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { GolfBag } from '../models/golf-bag.model';
import { GolfShot } from '../models/golf-shot.model';
import { GolfClub } from '../models/golf-club.model';
import { User } from '../models/user.model';
import { GolfCourse, GolfHole } from '../models/golf-course.model';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { map, catchError } from 'rxjs/operators';
@Injectable({
  providedIn: 'root',
})

export class SupabaseService {
  private apiUrl = 'https://mgpgbijsyiwkappxedfu.supabase.co';
  private apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncGdiaWpzeWl3a2FwcHhlZGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyMDY4NDQsImV4cCI6MjA1MTc4Mjg0NH0.IkpfzHy9xE00p7GjbSyhg30H_5hZ7_4zHFJoXhBTdmY' // Replace with your Supabase Anon Key

  private supabase: SupabaseClient;
  private authStateSubject = new BehaviorSubject<boolean>(false);
  authState$ = this.authStateSubject.asObservable();

  constructor(private http: HttpClient) {
    // TODO: Move these to environment variables
    this.supabase = createClient(
      this.apiUrl, 
      this.apiKey
    );
    this.initializeAuthListener();
  }

  /**
   * Helper method to handle and log errors consistently.
   */
  private handleError(methodName: string, error: any): void {
    console.error(`SupabaseService -> ${methodName}() Error:`, error.message || error);
  }

  // ==================== AUTH METHODS ====================

  async createUser(email: string, password: string) {
    try {
      const result = await this.supabase.auth.signUp({ email, password });
      return result;
    } catch (error: any) {
      this.handleError('createUser', error);
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<{ user: User | null; session: any; error: any }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { user: data.user as User, session: data.session, error: null };
    } catch (error: any) {
      this.handleError('signIn', error);
      return { user: null, session: null, error };
    }
  }

  async signOut(): Promise<void> {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;
      this.authStateSubject.next(false);
    } catch (error: any) {
      this.handleError('signOut', error);
    }
  }

  async getUser(): Promise<User | null> {
    try {
      const { data, error } = await this.supabase.auth.getUser();
      if (error) throw error;
      return data.user as User;
    } catch (error: any) {
      this.handleError('getUser', error);
      return null;
    }
  }

  async getSession(): Promise<any> {
    try {
      const { data, error } = await this.supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (error: any) {
      this.handleError('getSession', error);
      return null;
    }
  }

  private initializeAuthListener(): void {
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.authStateSubject.next(!!session);
    });
  }

  // ==================== PROFILE METHODS ====================

  async createProfile(profile: { id: string; name: string; email: string; height: number; weight: number; sex: string }) {
    try {
      return await this.supabase.from('profile').insert(profile).select('*');
    } catch (error: any) {
      this.handleError('createProfile', error);
      return { data: null, error };
    }
  }

  async getProfileById(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('profile')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    } catch (error: any) {
      this.handleError('getProfileById', error);
      return null;
    }
  }

  // ==================== GOLF BAG METHODS ====================

  async createGolfBag(bag: { user_id: string; name: string }) {
    try {
      return await this.supabase.from('golfbag').insert(bag).select('*');
    } catch (error: any) {
      this.handleError('createGolfBag', error);
      return { data: null, error };
    }
  }

  async getGolfBagsByUser(userId: string): Promise<{ data: GolfBag[] | null; error: any }> {
    try {
      const { data, error } = await this.supabase
        .from('golfbag')
        .select('*')
        .eq('user_id', userId);
      return { data, error };
    } catch (error: any) {
      this.handleError('getGolfBagsByUser', error);
      return { data: null, error };
    }
  }

  // ==================== GOLF CLUB METHODS ====================

  async getAllClubs(): Promise<{ data: GolfClub[] | null; error: any }> {
    try {
      const { data, error } = await this.supabase.from('golfclub').select('*');
      return { data, error };
    } catch (error: any) {
      this.handleError('getAllClubs', error);
      return { data: null, error };
    }
  }
  // Fetch golf clubs for the authenticated user
  getGolfClubs(): Observable<GolfClub[]> {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Access-Control-Allow-Origin': '*',  // 👈 Add this
      'Access-Control-Allow-Methods': 'GET, OPTIONS',  // 👈 Ensure OPTIONS is allowed
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', 
    };

    this.apiUrl += '/rest/v1/golfclub';

  
    return this.http.get<GolfClub[]>(`${this.apiUrl}?select=*`, { headers }).pipe(      map((response) => response || []),
      catchError((error) => {
        console.error('CORS Error:', error);
        throw error;
      })
    );
  }
  
  async searchClubs(maker?: string, category?: string): Promise<{ data: GolfClub[] | null; error: any }> {
    try {
      let query = this.supabase.from('golfclub').select('*');
      if (maker) query = query.ilike('maker', `%${maker}%`);
      if (category) query = query.eq('category', category);
      const { data, error } = await query;
      return { data, error };
    } catch (error: any) {
      this.handleError('searchClubs', error);
      return { data: null, error };
    }
  }

  // ==================== GOLFER-CLUB RELATIONSHIPS ====================

  async createGolferClub(golferClub: { golfer_id: string; club_id: string; cur_bag_id: string }) {
    try {
      return await this.supabase.from('golfer_club').insert(golferClub).select('*');
    } catch (error: any) {
      this.handleError('createGolferClub', error);
      return { data: null, error };
    }
  }

  async getClubsByBagId(bagId: string, userId: string) {
    try {
      return await this.supabase
        .from('golfer_club')
        .select('club_id')
        .eq('golfer_id', userId)
        .eq('cur_bag_id', bagId);
    } catch (error: any) {
      this.handleError('getClubsByBagId', error);
      return { data: null, error };
    }
  }

  async getClubsFromIds(clubIds: string[]) {
    try {
      return await this.supabase.from('golfclub').select('*').in('id', clubIds);
    } catch (error: any) {
      this.handleError('getClubsFromIds', error);
      return { data: null, error };
    }
  }

  async get_golferci_from_golfci(golf_ci: string) {
    try {
      return await this.supabase.from('golfer_club').select('id').eq('club_id', golf_ci);
    } catch (error: any) {
      this.handleError('get_golferci_from_golfci', error);
      return { data: null, error };
    }
  }

  // ==================== GOLF COURSE METHODS ====================

  async searchGolfCourses(query: string): Promise<GolfCourse[]> {
    try {
      const { data, error } = await this.supabase
        .from('golf_courses')
        .select('*')
        .ilike('name', `%${query}%`);
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      this.handleError('searchGolfCourses', error);
      return [];
    }
  }

  async getGolfCourseById(courseId: string): Promise<GolfCourse | null> {
    try {
      const { data, error } = await this.supabase
        .from('golf_courses')
        .select('*')
        .eq('id', courseId)
        .single();
      if (error) throw error;
      return data as GolfCourse;
    } catch (error: any) {
      this.handleError('getGolfCourseById', error);
      return null;
    }
  }

  async getGolfHolesByCourseId(courseId: string): Promise<GolfHole[]> {
    try {
      const { data, error } = await this.supabase
        .from('golf_holes')
        .select('*')
        .eq('course_id', courseId)
        .order('hole_number', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      this.handleError('getGolfHolesByCourseId', error);
      return [];
    }
  }

  async getGolfCourseNameById(courseId: string) {
    try {
      const { data, error } = await this.supabase
        .from('golf_courses')
        .select('name')
        .eq('id', courseId);
      if (error) throw error;
      return data;
    } catch (error: any) {
      this.handleError('getGolfCourseNameById', error);
      return [];
    }
  }

  async getAllGolfCourses() {
    try {
      return await this.supabase.from('golf_courses').select('*');
    } catch (error: any) {
      this.handleError('getAllGolfCourses', error);
      return { data: null, error };
    }
  }

  // ==================== GOLF ROUND METHODS ====================

  async getGolfRoundsByUser(userId: string) {
    try {
      return await this.supabase.from('golf_rounds').select('*').eq('user_id', userId);
    } catch (error: any) {
      this.handleError('getGolfRoundsByUser', error);
      return { data: null, error };
    }
  }

  async getGolfRoundById(round_id: string) {
    try {
      return await this.supabase.from('golf_rounds').select('*').eq('id', round_id);
    } catch (error: any) {
      this.handleError('getGolfRoundById', error);
      return { data: null, error };
    }
  }

  async createGolfRound(round: {
    user_id: string;
    date_played: string;
    golfbag_id: string;
    course_id: string;
    // optional fields
    weather?: string;
  }) {
    try {
      return await this.supabase.from('golf_rounds').insert(round).select('*');
    } catch (error: any) {
      this.handleError('createGolfRound', error);
      return { data: null, error };
    }
  }

  // ==================== GOLF HOLE / PLAYED GOLF HOLE ====================

  async getGolfHoleDetails(courseId: string, holeNumber: number) {
    try {
      return await this.supabase
        .from('golf_holes')
        .select('*')
        .eq('course_id', courseId)
        .eq('hole_number', holeNumber)
        .single();
    } catch (error: any) {
      this.handleError('getGolfHoleDetails', error);
      return { data: null, error };
    }
  }

  async getPlayedHole(roundId: string, holeId: string) {
    try {
      return await this.supabase
        .from('played_golf_hole')
        .select('id, strokes')
        .eq('round_id', roundId)
        .eq('hole_id', holeId);
    } catch (error: any) {
      this.handleError('getPlayedHole', error);
      return { data: null, error };
    }
  }

  async createPlayedHole(entry: { round_id: string; hole_id: string; strokes: number }) {
    try {
      return await this.supabase
        .from('played_golf_hole')
        .insert([entry])
        .select('*');
    } catch (error: any) {
      this.handleError('createPlayedHole', error);
      return { data: null, error };
    }
  }

  async updatePlayedHoleStrokes(playedHoleId: string, strokes: number) {
    try {
      const { error } = await this.supabase
        .from('played_golf_hole')
        .update({ strokes })
        .eq('id', playedHoleId);
      if (error) throw error;
    } catch (error: any) {
      this.handleError('updatePlayedHoleStrokes', error);
    }
  }

  // ==================== GOLF SHOT METHODS ====================

  async addGolfShot(shot: GolfShot) {
    console.log(shot);
    try {
      const { data, error } = await this.supabase
        .from('golf_shot')
        .insert([shot])
        .select();
      if (error) throw error;
      return data;
    } catch (error: any) {
      this.handleError('addGolfShot', error);
      return null;
    }
  }

  async deleteShot(shot_id: string): Promise<void> {
    try {
      const { error } = await this.supabase.from('golf_shot').delete().eq('id', shot_id);
      if (error) throw error;
    } catch (error: any) {
      this.handleError('deleteShot', error);
    }
  }

  async getShotsForPlayedHole(played_hole_id: string) {
    try {
      const { data, error } = await this.supabase
        .from('golf_shot')
        .select('*')
        .eq('hole_id', played_hole_id)
        .order('stroke_number', { ascending: true });
      if (error) throw error;
      return data;
    } catch (error: any) {
      this.handleError('getShotsForPlayedHole', error);
      return null;
    }
  }

  // ==================== OPTIONAL: ADVANCED QUERIES (EXAMPLE) ====================

  /**
   * Example aggregator method that returns total strokes and total putts in a round.
   * (Requires your DB to have a "shot_type = 'Putt'" or similar logic.)
   */
  async getRoundAggregate(roundId: string) {
    try {
      // Example: fetch all shots for the round, group them, etc.
      // This might be done with a single SQL or Postgres function.
      // For illustration, we'll do it in two queries:
      const { data: holesData, error: holesError } = await this.supabase
        .from('played_golf_hole')
        .select('id')
        .eq('round_id', roundId);
      if (holesError) throw holesError;
      if (!holesData || holesData.length === 0) return { totalStrokes: 0, totalPutts: 0 };

      const holeIds = holesData.map((h) => h.id);
      const { data: shotsData, error: shotsError } = await this.supabase
        .from('golf_shot')
        .select('*')
        .in('hole_id', holeIds);
      if (shotsError) throw shotsError;

      const totalStrokes = shotsData.length;
      const totalPutts = shotsData.filter((s) => s.shot_type === 'Putt').length;

      return { totalStrokes, totalPutts };
    } catch (error: any) {
      this.handleError('getRoundAggregate', error);
      return { totalStrokes: 0, totalPutts: 0 };
    }
  }
}
