import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { WeatherService } from '../../services/weather.service';
import { ActivatedRoute, Router } from '@angular/router';
import { GolfHole } from '../../shared/models/golf-course.model';
import { NotificationService } from '../../shared/services/notification.service';
import { GolfShot } from '../../shared/models/golf-shot.model';

interface HoleData extends GolfHole {
  playedHoleId?: string;
  strokes?: number;
  putts?: number;
  shots?: GolfShot[];
  scoreToPar?: number;
  gir?: boolean;
  fir?: boolean;
}

@Component({
  selector: 'app-golf-round',
  templateUrl: './golf-round.component.html',
  styleUrls: ['./golf-round.component.css'],
})
export class GolfRoundComponent implements OnInit {
  roundId: any;
  weatherData: any | null = null;
  courseName: string | null = null;
  courseId: any;
  datePlayed: any;
  selectedHole: HoleData | null = null;
  loading = false;
  userId: string | null = null;
  golfBagId: string | null = null;
  holes: HoleData[] = [];

  // Round statistics
  totalStrokes: number = 0;
  totalPutts: number = 0;
  totalPar: number = 0;
  scoreToPar: number = 0;
  greensInRegulation: number = 0;
  fairwaysInRegulation: number = 0;

  constructor(
    private supabaseService: SupabaseService,
    private weatherService: WeatherService,
    private router: Router,
    private route: ActivatedRoute,
    private cdRef: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.supabaseService.getUser();
    if (!user) {
      this.notificationService.showWarning('Please log in to view round details.');
      this.router.navigate(['/login']);
      return;
    }
    this.userId = user.id;
    this.roundId = this.route.snapshot.paramMap.get('id');

    const roundRes = await this.supabaseService.getGolfRoundById(this.roundId);
    if (roundRes.data && roundRes.data.length > 0) {
      const round = roundRes.data[0];
      this.courseId = round.course_id;
      this.userId = round.user_id;
      this.golfBagId = round.golfbag_id;
      this.datePlayed = round.date_played;
      this.fetchWeather(round);
      this.getHoles();
    } else {
      this.notificationService.showError('Round not found. Redirecting to dashboard...');
      this.router.navigate(['/dashboard']);
      return;
    }

  }

  async selectHole(hole: HoleData): Promise<void> {
    if (this.selectedHole && this.selectedHole.id === hole.id) {
      // Collapse if same hole is clicked
      this.selectedHole = null;
      return;
    }
    
    // Load shots for this hole if not already loaded
    if (!hole.shots && hole.playedHoleId) {
      const shots = await this.supabaseService.getShotsForPlayedHole(hole.playedHoleId);
      hole.shots = shots ?? undefined;
    }
    
    this.selectedHole = hole;
  }

  async getHoles(): Promise<void> {
    this.loading = true;
    try {
      const courseHoles = await this.supabaseService.getGolfHolesByCourseId(this.courseId);
      
      // Get all played holes for this round
      const { data: playedHoles } = await this.supabaseService.getPlayedHolesForRound(this.roundId);
      const playedHolesMap = new Map<string, any>();
      
      if (playedHoles) {
        playedHoles.forEach(ph => {
          playedHolesMap.set(ph.hole_id, ph);
        });
      }

      // Combine hole definitions with played hole data
      this.holes = courseHoles.map(hole => {
        const playedHole = playedHolesMap.get(hole.id!);
        const holeData: HoleData = { ...hole };
        
        if (playedHole) {
          holeData.playedHoleId = playedHole.id;
          holeData.strokes = playedHole.strokes;
        }
        
        return holeData;
      });

      // Load shots and calculate stats for each hole
      await this.loadHoleDetails();
      this.calculateRoundStatistics();
      
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading holes: ${errorMsg}`);
      console.error('Error loading holes:', error);
    } finally {
      this.loading = false;
    }
  }

  async loadHoleDetails(): Promise<void> {
    for (const hole of this.holes) {
      if (hole.playedHoleId) {
        const shots = await this.supabaseService.getShotsForPlayedHole(hole.playedHoleId);
        // Convert null to undefined to match the type
        hole.shots = shots ?? undefined;
        if (shots) {
          hole.putts = shots.filter(s => s.shot_type === 'Putt').length;
          hole.strokes = shots.reduce((sum, s) => sum + 1 + (s.penalty_strokes || 0), 0);
          hole.scoreToPar = hole.strokes - hole.par;
          hole.gir = this.calculateGIR(shots, hole.par);
          hole.fir = this.calculateFIR(shots, hole.par);
        }
      }
    }
  }

  getApplicableFairwayHoles(): number {
    return this.holes.filter(h => h.par >= 4).length;
  }

  calculateGIR(shots: GolfShot[], par: number): boolean {
    const targetShotNumber = par - 2;
    if (targetShotNumber < 1) return false;
    
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

  calculateFIR(shots: GolfShot[], par: number): boolean {
    if (par < 4) return false;
    if (shots.length === 0) return false;
    
    const teeShot = shots[0];
    const location = teeShot.result_location || teeShot.result || '';
    return location === 'Fairway';
  }

  calculateRoundStatistics(): void {
    this.totalStrokes = this.holes.reduce((sum, h) => sum + (h.strokes || 0), 0);
    this.totalPutts = this.holes.reduce((sum, h) => sum + (h.putts || 0), 0);
    this.totalPar = this.holes.reduce((sum, h) => sum + h.par, 0);
    this.scoreToPar = this.totalStrokes - this.totalPar;
    this.greensInRegulation = this.holes.filter(h => h.gir).length;
    this.fairwaysInRegulation = this.holes.filter(h => h.fir).length;
  }

  async fetchWeather(round: any): Promise<void> {
    try {
      const courseData = await this.supabaseService.getGolfCourseNameById(this.courseId);
      this.courseName = courseData || 'Unknown Course';

      // Example usage of your WeatherService
      this.weatherService.getWeather(this.courseName!, 'Austin', 'USA', this.datePlayed)
        .subscribe({
          next: (data) => {
            this.weatherData = data?.weather;
            this.cdRef.detectChanges();
          },
          error: (err) => {
            // Weather is optional, so just log it
            console.error('Error fetching weather:', err);
            // Don't show error notification for weather as it's optional
          }
        });
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading round details: ${errorMsg}`);
      console.error('Error fetching weather or course name:', error);
    }
  }

  goToHole(holeNumber: number): void {
    this.router.navigate([`/golf-hole/${holeNumber}`], {
      state: { roundId: this.roundId }
    });
  }

  goToRounds(): void {
    this.router.navigate(['/dashboard'])
  }

  goToSummary(): void {
    this.router.navigate([`/round-summary/${this.roundId}`]);
  }

  formatScoreToPar(score: number | undefined): string {
    if (score === undefined || score === null) return '—';
    if (score === 0) return 'E';
    if (score > 0) return `+${score}`;
    return score.toString();
  }

  getScoreClass(score: number | undefined): string {
    if (score === undefined || score === null) return '';
    if (score < 0) return 'score-under';
    if (score === 0) return 'score-even';
    return 'score-over';
  }
}
