import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../../shared/services/notification.service';
import { GolfShot } from '../../shared/models/golf-shot.model';
import { GolfHole } from '../../shared/models/golf-course.model';

interface HoleStats {
  holeNumber: number;
  par: number;
  strokes: number;
  putts: number;
  gir: boolean;
  fir: boolean;
  scoreToPar: number;
}

interface RoundStatistics {
  totalStrokes: number;
  totalPutts: number;
  totalPar: number;
  scoreToPar: number;
  greensInRegulation: number;
  fairwaysInRegulation: number;
  averagePuttsPerHole: number;
  holesPlayed: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  worse: number;
  courseName: string;
  datePlayed: string;
  holeStats: HoleStats[];
}

@Component({
  selector: 'app-round-summary',
  templateUrl: './round-summary.component.html',
  styleUrls: ['./round-summary.component.css']
})
export class RoundSummaryComponent implements OnInit {
  roundId!: string;
  statistics: RoundStatistics | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.roundId = this.route.snapshot.paramMap.get('id') || '';
    
    if (!this.roundId) {
      this.notificationService.showError('Round ID not provided.');
      this.router.navigate(['/dashboard']);
      return;
    }

    await this.loadRoundStatistics();
  }

  async loadRoundStatistics(): Promise<void> {
    try {
      this.loading = true;

      // Get round details
      const roundRes = await this.supabaseService.getGolfRoundById(this.roundId);
      if (!roundRes.data || roundRes.data.length === 0) {
        this.notificationService.showError('Round not found.');
        this.router.navigate(['/dashboard']);
        return;
      }

      const round = roundRes.data[0];
      const courseId = round.course_id;
      const datePlayed = round.date_played;

      // Get course name
      const courseName = await this.supabaseService.getGolfCourseNameById(courseId) || 'Unknown Course';

      // Get all holes for the course
      const holes = await this.supabaseService.getGolfHolesByCourseId(courseId);

      // Get all played holes for this round
      const { data: playedHoles } = await this.supabaseService.getPlayedHolesForRound(this.roundId);
      if (!playedHoles || playedHoles.length === 0) {
        this.notificationService.showWarning('No holes played in this round.');
        this.router.navigate(['/dashboard']);
        return;
      }

      // Get all shots for all played holes
      const allShots: GolfShot[] = [];
      const holeStatsMap = new Map<number, HoleStats>();

      for (const playedHole of playedHoles) {
        const shots = await this.supabaseService.getShotsForPlayedHole(playedHole.id);
        if (shots) {
          allShots.push(...shots);
          
          // Find the corresponding hole definition
          const holeDef = holes.find(h => h.id === playedHole.hole_id);
          if (holeDef) {
            const putts = shots.filter(s => s.shot_type === 'Putt').length;
            const totalStrokes = shots.reduce((sum, s) => sum + 1 + (s.penalty_strokes || 0), 0);
            
            // Calculate GIR: ball on green by par-2 shots
            const gir = this.calculateGIR(shots, holeDef.par);
            
            // Calculate FIR: for par 4/5, tee shot lands on fairway
            const fir = this.calculateFIR(shots, holeDef.par);
            
            const scoreToPar = totalStrokes - holeDef.par;
            
            holeStatsMap.set(holeDef.hole_number, {
              holeNumber: holeDef.hole_number,
              par: holeDef.par,
              strokes: totalStrokes,
              putts: putts,
              gir: gir,
              fir: fir,
              scoreToPar: scoreToPar
            });
          }
        }
      }

      // Convert map to array and sort by hole number
      const holeStats = Array.from(holeStatsMap.values()).sort((a, b) => a.holeNumber - b.holeNumber);

      // Calculate aggregate statistics
      const totalStrokes = holeStats.reduce((sum, h) => sum + h.strokes, 0);
      const totalPutts = holeStats.reduce((sum, h) => sum + h.putts, 0);
      const totalPar = holeStats.reduce((sum, h) => sum + h.par, 0);
      const scoreToPar = totalStrokes - totalPar;
      const greensInRegulation = holeStats.filter(h => h.gir).length;
      const fairwaysInRegulation = holeStats.filter(h => h.fir).length;
      const averagePuttsPerHole = holeStats.length > 0 ? totalPutts / holeStats.length : 0;

      // Count score types
      const birdies = holeStats.filter(h => h.scoreToPar === -1).length;
      const pars = holeStats.filter(h => h.scoreToPar === 0).length;
      const bogeys = holeStats.filter(h => h.scoreToPar === 1).length;
      const doubleBogeys = holeStats.filter(h => h.scoreToPar === 2).length;
      const worse = holeStats.filter(h => h.scoreToPar > 2).length;

      this.statistics = {
        totalStrokes,
        totalPutts,
        totalPar,
        scoreToPar,
        greensInRegulation,
        fairwaysInRegulation,
        averagePuttsPerHole,
        holesPlayed: holeStats.length,
        birdies,
        pars,
        bogeys,
        doubleBogeys,
        worse,
        courseName,
        datePlayed,
        holeStats
      };

      this.loading = false;
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading round statistics: ${errorMsg}`);
      console.error('Error loading round statistics:', error);
      this.loading = false;
      this.router.navigate(['/dashboard']);
    }
  }

  /**
   * Calculate if green was hit in regulation
   * GIR = ball on green by shot (par - 2)
   * Par 3: on green by shot 1 (after tee shot)
   * Par 4: on green by shot 2 (after approach shot)
   * Par 5: on green by shot 3 (after second shot)
   */
  private calculateGIR(shots: GolfShot[], par: number): boolean {
    const targetShotNumber = par - 2;
    if (targetShotNumber < 1) return false;

    // Check if any shot with stroke_number <= targetShotNumber ended on green
    for (const shot of shots) {
      if (shot.stroke_number <= targetShotNumber) {
        const location = shot.result_location || shot.result || '';
        if (location === 'Green' || location === 'Made') {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate if fairway was hit in regulation
   * FIR = for par 4/5, tee shot lands on fairway
   */
  private calculateFIR(shots: GolfShot[], par: number): boolean {
    // FIR only applies to par 4 and par 5 holes
    if (par < 4) return false;

    // Check if the first shot (tee shot) landed on fairway
    if (shots.length === 0) return false;

    const teeShot = shots[0];
    const location = teeShot.result_location || teeShot.result || '';
    
    return location === 'Fairway';
  }

  formatScoreToPar(score: number): string {
    if (score === 0) return 'E';
    if (score > 0) return `+${score}`;
    return score.toString();
  }

  getScoreClass(score: number): string {
    if (score < 0) return 'score-under';
    if (score === 0) return 'score-even';
    return 'score-over';
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goToRound(): void {
    this.router.navigate([`/golf-round/${this.roundId}`]);
  }
}
