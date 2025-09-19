import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { WeatherService } from '../services/weather.service';
import { ActivatedRoute, Router } from '@angular/router';
import { GolfHole } from '../models/golf-course.model';
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
  selectedHole: any;
  loading = false;
  userId: string | null = null;
  golfBagId: string | null = null;
  holes: GolfHole[];

  // For optional aggregator data
  totalStrokes: number | null = null;
  totalPutts: number | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private weatherService: WeatherService,
    private router: Router,
    private route: ActivatedRoute,
    private cdRef: ChangeDetectorRef
  ) {
    this.holes = [];
  }

  async ngOnInit(): Promise<void> {
    const user = await this.supabaseService.getUser();
    if (!user) {
      console.warn('No user is authenticated.');
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
      console.error('No round data found. Redirecting...');
      this.router.navigate(['/dashboard']);
      return;
    }

  }

  async selectHole(hole: any): Promise<void> {
    if (this.selectedHole && this.selectedHole.id === hole.id) {
      // Collapse if same round is clicked
      this.selectedHole = null;
      return;
    }
    this.selectedHole = hole;

  }

  async getHoles(): Promise<void> {
    this.holes = await this.supabaseService.getGolfHolesByCourseId(this.courseId);

  }

  async fetchWeather(round: any): Promise<void> {
    try {
      const courseData = await this.supabaseService.getGolfCourseNameById(this.courseId);
      this.courseName = courseData?.length ? courseData[0].name : 'Unknown Course';

      // Example usage of your WeatherService
      this.weatherService.getWeather(this.courseName!, 'Austin', 'USA', this.datePlayed)
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

  goToHole(holeNumber: number): void {
    this.router.navigate([`/golf-hole/${holeNumber}`], {
      state: { roundId: this.roundId }
    });
  }

  goToRounds(): void {
    this.router.navigate(['/dashboard'])
  }
}
