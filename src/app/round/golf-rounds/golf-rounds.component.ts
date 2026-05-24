import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../shared/services/notification.service';

/** Headline stats for the rounds list (rolling window + all-time). */
interface RoundStatsSummary {
  /** e.g. "Last 12 months" */
  periodLabel: string;
  roundsInPeriod: number;
  /** Rounds in period ÷ 12 */
  roundsPerMonthAvg: number;
  /** Finished 18/9 (all course holes have a played row). */
  completeInPeriod: number;
  /** Started but not finished (≥1 hole logged). */
  inProgressInPeriod: number;
  avgStrokes: number | null;
  bestStrokes: number | null;
  worstStrokes: number | null;
  avgPutts: number | null;
  scoredRoundsInPeriod: number;
  allTimeRounds: number;
  allTimeComplete: number;
  allTimeInProgress: number;
  allTimeAvgStrokes: number | null;
  allTimeBestStrokes: number | null;
}

/** Enriched round row for the list (from loadRounds). */
interface RoundListRow {
  id: string;
  course_id: string;
  golfbag_id?: string | null;
  date_played: string;
  total_strokes?: number | null;
  putts?: number | null;
  fairways_hit?: number | null;
  course_name: string;
  holes_played: number;
  holes_total: number;
  is_round_complete: boolean;
}

@Component({
  selector: 'app-golf-rounds',
  templateUrl: './golf-rounds.component.html',
  styleUrls: ['./golf-rounds.component.css'],
})
export class GolfRoundsComponent implements OnInit {
  rounds: RoundListRow[] = [];
  selectedRound: RoundListRow | null = null;
  weatherData: any | null = null;
  courseName: string | null = null;
  loading = false;
  userId: string | null = null;
  golfBagId: string | null = null;

  totalStrokes: number | null = null;
  totalPutts: number | null = null;

  /** Rolling window (months) for headline stats — last N months from today. */
  readonly statsPeriodMonths = 12;

  roundStats: RoundStatsSummary | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.supabaseService.getUser();
    if (!user) {
      this.notificationService.showWarning('Please log in to view your rounds.');
      this.router.navigate(['/login']);
      return;
    }
    this.userId = user.id;
    await this.loadRounds();
  }

  async loadRounds(): Promise<void> {
    if (!this.userId) return;
    this.loading = true;

    try {
      const { data, error } = await this.supabaseService.getGolfRoundsByUser(this.userId);
      if (error) {
        const errorMsg = this.notificationService.getErrorMessage(error);
        this.notificationService.showError(errorMsg);
        console.error('Error fetching rounds:', error);
        return;
      }
      if (data) {
        const roundIds = data.map((r) => String(r.id));
        const courseIds = [...new Set(data.map((r) => String(r.course_id)))];
        const [playedByRound, holesPerCourse] = await Promise.all([
          this.supabaseService.getPlayedHoleCountsByRoundIds(roundIds),
          this.supabaseService.getHoleCountsByCourseIds(courseIds),
        ]);

        this.rounds = await Promise.all(
          data.map(async (round) => {
            const courseData = await this.supabaseService.getGolfCourseNameById(round.course_id);
            const courseName = courseData || 'Unknown Course';
            const rid = String(round.id);
            const cid = String(round.course_id);
            const holesPlayed = playedByRound.get(rid) ?? 0;
            const holesTotal = holesPerCourse.get(cid) ?? 0;
            const is_round_complete = holesTotal > 0 && holesPlayed >= holesTotal;
            return {
              ...(round as object),
              course_name: courseName,
              holes_played: holesPlayed,
              holes_total: holesTotal,
              is_round_complete,
            } as RoundListRow;
          })
        );
        this.recomputeStats();
        if (this.rounds.length === 0) {
          this.notificationService.showInfo('No rounds found. Start a new round to begin tracking!');
        }
      }
    } catch (err) {
      const errorMsg = this.notificationService.getErrorMessage(err);
      this.notificationService.showError(errorMsg);
      console.error('Unexpected error:', err);
    } finally {
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }

  async selectRound(round: RoundListRow): Promise<void> {
    if (this.selectedRound && this.selectedRound.id === round.id) {
      this.selectedRound = null;
      return;
    }
    this.selectedRound = round;
    this.golfBagId = round.golfbag_id ?? null;
    this.weatherData = null;
    this.totalStrokes = null;
    this.totalPutts = null;

    const aggregator = await this.supabaseService.getRoundAggregate(round.id);
    this.totalStrokes = aggregator.totalStrokes;
    this.totalPutts = aggregator.totalPutts;
  }

  startNewRound(): void {
    this.router.navigate(['/new-round']);
  }

  goToRound(roundId: string | number): void {
    this.router.navigate([`/golf-round/${roundId}`]);
  }

  /** Clamp progress bar width 0–100 (handles overfill edge cases). */
  min100(n: number): number {
    if (!Number.isFinite(n)) {
      return 0;
    }
    return Math.min(100, Math.max(0, n));
  }

  private recomputeStats(): void {
    if (!this.rounds.length) {
      this.roundStats = null;
      return;
    }

    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth() - this.statsPeriodMonths, now.getDate());
    windowStart.setHours(0, 0, 0, 0);

    const inPeriod = this.rounds.filter((r) => {
      const d = this.parseRoundDate(r.date_played);
      if (!d) return false;
      return d >= windowStart && d <= now;
    });

    const completeInPeriod = inPeriod.filter((r) => r.is_round_complete).length;
    const inProgressInPeriod = inPeriod.filter(
      (r) => !r.is_round_complete && (r.holes_played ?? 0) > 0
    ).length;

    const allTimeComplete = this.rounds.filter((r) => r.is_round_complete).length;
    const allTimeInProgress = this.rounds.filter(
      (r) => !r.is_round_complete && (r.holes_played ?? 0) > 0
    ).length;

    const scored = (arr: RoundListRow[]) =>
      arr.map((r) => r.total_strokes).filter((s): s is number => s != null && Number(s) > 0).map((s) => Number(s));

    const putts = (arr: RoundListRow[]) =>
      arr.map((r) => r.putts as number | undefined).filter((p): p is number => p != null && Number(p) >= 0).map((p) => Number(p));

    const sPeriod = scored(inPeriod);
    const pPeriod = putts(inPeriod);
    const sAll = scored(this.rounds);

    const avg = (nums: number[]) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null);

    this.roundStats = {
      periodLabel: `Last ${this.statsPeriodMonths} months`,
      roundsInPeriod: inPeriod.length,
      roundsPerMonthAvg: Math.round((inPeriod.length / this.statsPeriodMonths) * 10) / 10,
      completeInPeriod,
      inProgressInPeriod,
      avgStrokes: sPeriod.length ? avg(sPeriod) : null,
      bestStrokes: sPeriod.length ? Math.min(...sPeriod) : null,
      worstStrokes: sPeriod.length ? Math.max(...sPeriod) : null,
      avgPutts: pPeriod.length ? avg(pPeriod) : null,
      scoredRoundsInPeriod: sPeriod.length,
      allTimeRounds: this.rounds.length,
      allTimeComplete,
      allTimeInProgress,
      allTimeAvgStrokes: sAll.length ? avg(sAll) : null,
      allTimeBestStrokes: sAll.length ? Math.min(...sAll) : null,
    };
  }

  private parseRoundDate(datePlayed: string | Date | null | undefined): Date | null {
    if (datePlayed == null) {
      return null;
    }
    if (datePlayed instanceof Date) {
      return isNaN(datePlayed.getTime()) ? null : datePlayed;
    }
    const s = String(datePlayed);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) {
      const yy = +m[1];
      const mo = +m[2] - 1;
      const dd = +m[3];
      return new Date(yy, mo, dd);
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

}
