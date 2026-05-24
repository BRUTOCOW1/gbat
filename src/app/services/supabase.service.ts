
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { GolfBag } from '../shared/models/golf-bag.model';
import { GolfShot } from '../shared/models/golf-shot.model';
import { GolfClub } from '../shared/models/golf-club.model';
import { normalizeClubForDb } from '../shared/club-spec';
import { User } from '../shared/models/user.model';
import { GolfCourse, GolfHole } from '../shared/models/golf-course.model';
import { environment } from '../../environments/environment';
import {
  computePlayerStats,
  UserPlayerStats,
  PlayerStatsRoundRow,
  PlayerStatsCourseRow,
  PlayerStatsPlayedHoleRow,
  PlayerStatsHoleParRow,
} from '../shared/player-stats';

/** Aggregated shot history for one bag slot (`golfer_club.id` → `golf_shot.club_id`). */
export interface GolferClubUsageStats {
  totalShots: number;
  /** Distinct rounds where this club appears on at least one shot */
  roundsWithClub: number;
  /** `totalShots / roundsWithClub` when rounds > 0 */
  avgShotsPerRound: number | null;
  fullSwingCount: number;
  puttCount: number;
  penaltyCount: number;
  /** Non-putt, non-penalty shots with distance > 0 */
  avgCarryYds: number | null;
  /** Most recent `date_played` among rounds that include this club */
  lastUsedDate: string | null;
}

@Injectable({
  providedIn: 'root',
})

export class SupabaseService {
  private readonly apiUrl = environment.supabase.url;
  private readonly apiKey = environment.supabase.anonKey;

  private supabase: SupabaseClient;
  private authStateSubject = new BehaviorSubject<boolean>(false);
  authState$ = this.authStateSubject.asObservable();

  constructor() {
    // Avoid Navigator LockManager + Zone.js "immediate lock failed" (see supabase-js #936).
    // Single-tab SPA: run auth ops without cross-tab locks; acceptable for this app.
    this.supabase = createClient(this.apiUrl, this.apiKey, {
      auth: {
        lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => await fn(),
      },
    });
    this.initializeAuthListener();
  }

  /**
   * Helper method to handle and log errors consistently.
   */
  private handleError(methodName: string, error: any): void {
    console.error(`SupabaseService -> ${methodName}() Error:`, error.message || error);
  }

  // ==================== AUTH METHODS ====================

  async createUser(email: string, password: string): Promise<any> {
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

  async getSession(): Promise<any | null> {
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

  async deleteGolfBag(bagId: string, userId: string) {
    try {
      const { error: clubErr } = await this.supabase
        .from('golfer_club')
        .delete()
        .eq('cur_bag_id', bagId)
        .eq('golfer_id', userId);
      if (clubErr) throw clubErr;

      const { error } = await this.supabase
        .from('golfbag')
        .delete()
        .eq('golfbag_id', bagId)
        .eq('user_id', userId);
      return { error };
    } catch (error: any) {
      this.handleError('deleteGolfBag', error);
      return { error };
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

  async upsertClubs(clubs: GolfClub[]) {
    try {
      const rows = clubs.map((club) => normalizeClubForDb(club));
      const { data, error } = await this.supabase
        .from('golfclub')
        .upsert(rows, { onConflict: 'id' })
        .select();
      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      this.handleError('upsertClubs', error);
      return { data: null, error };
    }
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
        .select('id, club_id')  // ✅ include the PK id!
        .eq('cur_bag_id', bagId)
        .eq('golfer_id', userId);
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

  async removeGolferClub(golferClubId: string) {
    try {
      return await this.supabase.from('golfer_club').delete().eq('id', golferClubId);
    } catch (error: any) {
      this.handleError('removeGolferClub', error);
      return { data: null, error };
    }
  }

  /**
   * Remove a club from its bag. Detaches by clearing `cur_bag_id` when possible
   * (keeps the row for shot history); falls back to delete when the row has no FK blockers.
   */
  async removeGolferClubFromBag(golferClubId: string, userId: string) {
    try {
      const { error: detachErr } = await this.supabase
        .from('golfer_club')
        .update({ cur_bag_id: null })
        .eq('id', golferClubId)
        .eq('golfer_id', userId);
      if (!detachErr) return { error: null };

      const detachMsg = (detachErr.message || '').toLowerCase();
      const notNullableSearchable =
        detachMsg.includes('null value') ||
        detachMsg.includes('not-null') ||
        detachMsg.includes('23502');
      if (!notNullableSearchable) {
        return { error: detachErr };
      }

      return await this.removeGolferClub(golferClubId);
    } catch (error: any) {
      this.handleError('removeGolferClubFromBag', error);
      return { error };
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

  async getGolfCourseNameById(courseId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('golf_courses')
        .select('name')
        .eq('id', courseId)
        .single();
      if (error) throw error;
      return data?.name || null;
    } catch (error: any) {
      this.handleError('getGolfCourseNameById', error);
      return null;
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

  async getGolfCoursesByUser(userId: string): Promise<GolfCourse[]> {
    try {
      // Get unique course IDs from rounds played by the user
      const { data: rounds, error: roundsError } = await this.supabase
        .from('golf_rounds')
        .select('course_id')
        .eq('user_id', userId);

      if (roundsError) throw roundsError;
      if (!rounds || rounds.length === 0) return [];

      // Get unique course IDs
      const uniqueCourseIds = [...new Set(rounds.map(r => r.course_id))];

      // Fetch the courses
      const { data: courses, error: coursesError } = await this.supabase
        .from('golf_courses')
        .select('*')
        .in('id', uniqueCourseIds);

      if (coursesError) throw coursesError;
      return courses || [];
    } catch (error: any) {
      this.handleError('getGolfCoursesByUser', error);
      return [];
    }
  }

  async insertGolfCourseWithHoles(course: Partial<GolfCourse>, holes: Omit<GolfHole, 'course_id'>[]) {
    try {
      // Insert the course and get its ID
      const { data: insertedCourse, error: courseError } = await this.supabase
        .from('golf_courses')
        .insert([course])
        .select()
        .single();

      if (courseError) throw courseError;
      const course_id = insertedCourse.id;

      // Insert the holes, attaching the course_id
      const holesWithCourseId = holes.map(hole => ({
        ...hole,
        course_id,
        id: crypto.randomUUID() // if your DB expects this
      }));

      const { error: holesError } = await this.supabase
        .from('golf_holes')
        .insert(holesWithCourseId);

      if (holesError) throw holesError;

      return insertedCourse;
    } catch (error: any) {
      this.handleError('insertGolfCourseWithHoles', error);
      throw error;
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
    tee_box?: string;
    tee_time?: string;
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

  async getPlayedHolesForRound(roundId: string) {
    try {
      const { data, error } = await this.supabase
        .from('played_golf_hole')
        .select('id, strokes, hole_id')
        .eq('round_id', roundId);
      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      this.handleError('getPlayedHolesForRound', error);
      return { data: null, error };
    }
  }

  /** Count played_golf_hole rows per round (for list progress). */
  async getPlayedHoleCountsByRoundIds(roundIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!roundIds.length) {
      return map;
    }
    try {
      const { data, error } = await this.supabase.from('played_golf_hole').select('round_id').in('round_id', roundIds);
      if (error) {
        throw error;
      }
      for (const row of data ?? []) {
        const id = String((row as { round_id: string }).round_id);
        map.set(id, (map.get(id) ?? 0) + 1);
      }
      return map;
    } catch (error: any) {
      this.handleError('getPlayedHoleCountsByRoundIds', error);
      return map;
    }
  }

  /** Count golf_holes rows per course (expected holes in a full round). */
  async getHoleCountsByCourseIds(courseIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!courseIds.length) {
      return map;
    }
    try {
      const { data, error } = await this.supabase.from('golf_holes').select('course_id').in('course_id', courseIds);
      if (error) {
        throw error;
      }
      for (const row of data ?? []) {
        const cid = String((row as { course_id: string }).course_id);
        map.set(cid, (map.get(cid) ?? 0) + 1);
      }
      return map;
    } catch (error: any) {
      this.handleError('getHoleCountsByCourseIds', error);
      return map;
    }
  }

  /** Latest stimp on this round (by hole order, then stroke), in two queries — avoids N+1 per hole. */
  async getLastPuttGreenSpeedForRound(roundId: string): Promise<number | undefined> {
    try {
      const { data: playedHoles, error } = await this.getPlayedHolesForRound(roundId);
      if (error || !playedHoles?.length) return undefined;
      const holeOrder = playedHoles.map((h: { id: string }) => h.id);
      const { data: shots, error: shotsErr } = await this.supabase
        .from('golf_shot')
        .select('hole_id, stroke_number, shot_type, green_speed')
        .in('hole_id', holeOrder);
      if (shotsErr || !shots?.length) return undefined;
      const putts = (shots as any[]).filter(
        (s) => s.shot_type === 'Putt' && s.green_speed != null && s.green_speed !== ''
      );
      if (!putts.length) return undefined;
      putts.sort((a, b) => {
        const ai = holeOrder.indexOf(a.hole_id);
        const bi = holeOrder.indexOf(b.hole_id);
        if (ai !== bi) return ai - bi;
        return (a.stroke_number || 0) - (b.stroke_number || 0);
      });
      return putts[putts.length - 1].green_speed as number;
    } catch (error: any) {
      this.handleError('getLastPuttGreenSpeedForRound', error);
      return undefined;
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

  async addGolfShot(shot: GolfShot): Promise<GolfShot[] | null> {
    try {
      const { data, error } = await this.supabase
        .from('golf_shot')
        .insert([shot])
        .select();
      if (error) throw error;
      return data as GolfShot[] | null;
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

  async getShotsForPlayedHole(played_hole_id: string): Promise<GolfShot[] | null> {
    try {
      const { data, error } = await this.supabase
        .from('golf_shot')
        .select('*')
        .eq('hole_id', played_hole_id)
        .order('stroke_number', { ascending: true });
      if (error) throw error;
      return data as GolfShot[] | null;
    } catch (error: any) {
      this.handleError('getShotsForPlayedHole', error);
      return null;
    }
  }

  /** Rolling average carry distance for this golfer_club (excludes putts). */
  async getAverageDistanceForGolferClub(golferClubId: string): Promise<number | null> {
    try {
      const { data, error } = await this.supabase
        .from('golf_shot')
        .select('distance')
        .eq('club_id', golferClubId)
        .neq('shot_type', 'Putt')
        .neq('shot_type', 'Penalty')
        .gt('distance', 0);
      if (error) throw error;
      if (!data?.length) return null;
      const sum = data.reduce((acc, row: { distance: number | null }) => acc + (Number(row.distance) || 0), 0);
      return Math.round(sum / data.length);
    } catch (error: any) {
      this.handleError('getAverageDistanceForGolferClub', error);
      return null;
    }
  }

  /**
   * Shot and round usage for a single golfer_club row (FK target of `golf_shot.club_id`).
   */
  async getGolferClubUsageStats(golferClubId: string): Promise<GolferClubUsageStats> {
    const empty = (): GolferClubUsageStats => ({
      totalShots: 0,
      roundsWithClub: 0,
      avgShotsPerRound: null,
      fullSwingCount: 0,
      puttCount: 0,
      penaltyCount: 0,
      avgCarryYds: null,
      lastUsedDate: null,
    });

    try {
      const { data: shots, error: shotsErr } = await this.supabase
        .from('golf_shot')
        .select('hole_id, shot_type, distance')
        .eq('club_id', golferClubId);
      if (shotsErr) throw shotsErr;
      if (!shots?.length) return empty();

      const totalShots = shots.length;
      let puttCount = 0;
      let penaltyCount = 0;
      let fullSwingCount = 0;
      let carrySum = 0;
      let carryN = 0;

      for (const s of shots as { hole_id: string; shot_type: string | null; distance: number | null }[]) {
        const st = s.shot_type || '';
        if (st === 'Putt') puttCount++;
        else if (st === 'Penalty') penaltyCount++;
        else {
          fullSwingCount++;
          const d = Number(s.distance);
          if (d > 0) {
            carrySum += d;
            carryN++;
          }
        }
      }

      const holeIds = [...new Set(shots.map((s: { hole_id: string }) => s.hole_id).filter(Boolean))];
      const roundIdSet = new Set<string>();

      const chunkSize = 200;
      for (let i = 0; i < holeIds.length; i += chunkSize) {
        const slice = holeIds.slice(i, i + chunkSize);
        const { data: played, error: phErr } = await this.supabase
          .from('played_golf_hole')
          .select('id, round_id')
          .in('id', slice);
        if (phErr) throw phErr;
        for (const row of played || []) {
          if (row.round_id) roundIdSet.add(String(row.round_id));
        }
      }

      const roundsWithClub = roundIdSet.size;
      const avgShotsPerRound =
        roundsWithClub > 0 ? Math.round((totalShots / roundsWithClub) * 10) / 10 : null;

      const avgCarryYds = carryN > 0 ? Math.round(carrySum / carryN) : null;

      let lastUsedDate: string | null = null;
      const roundIds = [...roundIdSet];
      if (roundIds.length) {
        for (let i = 0; i < roundIds.length; i += chunkSize) {
          const slice = roundIds.slice(i, i + chunkSize);
          const { data: rounds, error: rErr } = await this.supabase
            .from('golf_rounds')
            .select('date_played')
            .in('id', slice);
          if (rErr) throw rErr;
          for (const r of rounds || []) {
            const d = (r as { date_played?: string }).date_played;
            if (!d) continue;
            if (!lastUsedDate || d > lastUsedDate) lastUsedDate = d;
          }
        }
      }

      return {
        totalShots,
        roundsWithClub,
        avgShotsPerRound,
        fullSwingCount,
        puttCount,
        penaltyCount,
        avgCarryYds,
        lastUsedDate,
      };
    } catch (error: any) {
      this.handleError('getGolferClubUsageStats', error);
      return empty();
    }
  }

  async getShotCountForPlayedHole(played_hole_id: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('golf_shot')
        .select('*', { count: 'exact', head: true })
        .eq('hole_id', played_hole_id);
      if (error) throw error;
      return count || 0;
    } catch (error: any) {
      this.handleError('getShotCountForPlayedHole', error);
      return 0;
    }
  }


  async getShotForPlayedHole(played_hole_id: string, shot_num: number): Promise<GolfShot | null> {
    try {
      const { data, error } = await this.supabase
        .from('golf_shot')
        .select('*')
        .eq('hole_id', played_hole_id)
        .eq('stroke_number', shot_num)
        .maybeSingle();
      if (error) throw error;
      return data as GolfShot | null;
    } catch (error: any) {
      this.handleError('getShotForPlayedHole', error); // (typo fixed)
      return null;
    }
  }



  // ==================== OPTIONAL: ADVANCED QUERIES (EXAMPLE) ====================

  /**
   * Example aggregator method that returns total strokes and total putts in a round.
   * (Requires your DB to have a "shot_type = 'Putt'" or similar logic.)
   */
  async getRoundAggregate(roundId: string): Promise<{ totalStrokes: number; totalPutts: number }> {
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


  // Update by id (preferred)
  async updateGolfShotById(id: string, patch: Partial<GolfShot>): Promise<GolfShot | null> {
    try {
      const { data, error } = await this.supabase
        .from('golf_shot')
        .update(patch)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as GolfShot | null;
    } catch (error: any) {
      this.handleError('updateGolfShotById', error);
      return null;
    }
  }

  // Update by (played_hole_id, stroke_number)
  async updateGolfShotByPlayedHoleAndStroke(played_hole_id: string, stroke_number: number, patch: Partial<GolfShot>): Promise<GolfShot | null> {
    try {
      const { data, error } = await this.supabase
        .from('golf_shot')
        .update(patch)
        .eq('hole_id', played_hole_id)
        .eq('stroke_number', stroke_number)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as GolfShot | null;
    } catch (error: any) {
      this.handleError('updateGolfShotByPlayedHoleAndStroke', error);
      return null;
    }
  }

  // Delete by (played_hole_id, stroke_number) if needed
  async deleteShotByPlayedHoleAndStroke(played_hole_id: string, stroke_number: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('golf_shot')
        .delete()
        .eq('hole_id', played_hole_id)
        .eq('stroke_number', stroke_number);
      if (error) throw error;
    } catch (error: any) {
      this.handleError('deleteShotByPlayedHoleAndStroke', error);
      throw error;
    }
  }

  /** Aggregated player stats from rounds and shot history. */
  async getUserPlayerStats(userId: string): Promise<UserPlayerStats> {
    const empty = computePlayerStats([], [], [], [], []);

    try {
      const { data: rounds, error: roundsErr } = await this.getGolfRoundsByUser(userId);
      if (roundsErr) {
        throw roundsErr;
      }
      const roundRows = (rounds ?? []) as PlayerStatsRoundRow[];
      if (!roundRows.length) {
        return empty;
      }

      const roundIds = roundRows.map((r) => String(r.id));
      const courseIds = [...new Set(roundRows.map((r) => String(r.course_id)).filter(Boolean))];

      const playedHoles: PlayerStatsPlayedHoleRow[] = [];
      const chunkSize = 200;

      for (let i = 0; i < roundIds.length; i += chunkSize) {
        const slice = roundIds.slice(i, i + chunkSize);
        const { data, error } = await this.supabase
          .from('played_golf_hole')
          .select('id, round_id, hole_id, strokes')
          .in('round_id', slice);
        if (error) {
          throw error;
        }
        playedHoles.push(...((data ?? []) as PlayerStatsPlayedHoleRow[]));
      }

      const playedHoleIds = playedHoles.map((ph) => ph.id);
      const shots: {
        hole_id: string;
        stroke_number: number;
        shot_type: string | null;
        distance: number | null;
        result_location?: string | null;
        result?: string | null;
      }[] = [];

      for (let i = 0; i < playedHoleIds.length; i += chunkSize) {
        const slice = playedHoleIds.slice(i, i + chunkSize);
        const { data, error } = await this.supabase
          .from('golf_shot')
          .select('hole_id, stroke_number, shot_type, distance, result_location, result')
          .in('hole_id', slice);
        if (error) {
          throw error;
        }
        shots.push(...(data ?? []));
      }

      const golfHoleIds = [...new Set(playedHoles.map((ph) => ph.hole_id).filter(Boolean))];
      const holePars: PlayerStatsHoleParRow[] = [];

      for (let i = 0; i < golfHoleIds.length; i += chunkSize) {
        const slice = golfHoleIds.slice(i, i + chunkSize);
        const { data, error } = await this.supabase
          .from('golf_holes')
          .select('id, par')
          .in('id', slice);
        if (error) {
          throw error;
        }
        holePars.push(...((data ?? []) as PlayerStatsHoleParRow[]));
      }

      let courses: PlayerStatsCourseRow[] = [];
      if (courseIds.length) {
        const { data, error } = await this.supabase
          .from('golf_courses')
          .select('id, par, rating, slope')
          .in('id', courseIds);
        if (error) {
          throw error;
        }
        courses = (data ?? []) as PlayerStatsCourseRow[];
      }

      return computePlayerStats(roundRows, courses, playedHoles, shots, holePars);
    } catch (error: any) {
      this.handleError('getUserPlayerStats', error);
      return empty;
    }
  }

  // ==================== BLOG METHODS ====================

  async getBlogPosts(): Promise<any[] | null> {
    try {
      const { data, error } = await this.supabase
        .from('post')
        .select('*');
      if (error) throw error;
      return data;
    } catch (error: any) {
      this.handleError('getBlogPosts', error);
      return null;
    }
  }

}
