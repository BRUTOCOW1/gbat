import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { WeatherService } from '../services/weather.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-golf-round',
  templateUrl: './golf-round.component.html',
  styleUrls: ['./golf-round.component.css'],
})
export class GolfRoundComponent implements OnInit {
  rounds: any[] = [];
  selectedRound: any | null = null;
  weatherData: any | null = null;
  courseName: string | null = null;
  loading = false;
  userId: string | null = null;
  golfBagId: string | null = null;
  holes: number[] = Array.from({ length: 18 }, (_, i) => i + 1);

  // For optional aggregator data
  totalStrokes: number | null = null;
  totalPutts: number | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private weatherService: WeatherService,
    private router: Router,
    private cdRef: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.supabaseService.getUser();
    if (!user) {
      console.warn('No user is authenticated.');
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
        console.error('Error fetching rounds:', error);
        return;
      }
      if (data) {
        // Example: load course name for each round
        this.rounds = await Promise.all(
          data.map(async (round) => {
            const courseData = await this.supabaseService.getGolfCourseNameById(round.course_id);
            const courseName = courseData?.length ? courseData[0].name : 'Unknown Course';
            return { ...round, course_name: courseName };
          })
        );
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }

  async selectRound(round: any): Promise<void> {
    if (this.selectedRound && this.selectedRound.id === round.id) {
      // Collapse if same round is clicked
      this.selectedRound = null;
      return;
    }
    this.selectedRound = round;
    this.golfBagId = round.golfbag_id;
    this.weatherData = null;
    this.totalStrokes = null;
    this.totalPutts = null;

    // Optionally fetch aggregator data
    const aggregator = await this.supabaseService.getRoundAggregate(round.id);
    this.totalStrokes = aggregator.totalStrokes;
    this.totalPutts = aggregator.totalPutts;

    // Fetch weather data if needed
    this.fetchWeather(round);
  }

  async fetchWeather(round: any): Promise<void> {
    if (!round || !round.course_id || !round.date_played) return;
    try {
      const courseData = await this.supabaseService.getGolfCourseNameById(round.course_id);
      this.courseName = courseData?.length ? courseData[0].name : 'Unknown Course';

      // Example usage of your WeatherService
      this.weatherService.getWeather(this.courseName!, 'Austin', 'USA', round.date_played)
        .subscribe({
          next: (data) => {
            this.weatherData = data?.weather;
            this.cdRef.detectChanges();
          },
          error: (err) => {
            console.error('Error fetching weather:', err);
          }
        });
    } catch (error) {
      console.error('Error fetching weather or course name:', error);
    }
  }

  startNewRound(): void {
    this.router.navigate(['/new-round']);
  }

  goToHole(holeNumber: number): void {
    if (!this.selectedRound || !this.golfBagId) return;
    this.router.navigate([`/golf-hole/${holeNumber}`], {
      state: { roundId: this.selectedRound.id }
    });
  }
}
