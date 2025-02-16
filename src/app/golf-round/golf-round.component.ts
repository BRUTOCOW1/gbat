import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { WeatherService } from '../services/weather.service';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-golf-round',
  templateUrl: './golf-round.component.html',
  styleUrls: ['./golf-round.component.css'],
})
export class GolfRoundComponent implements OnInit {
  rounds: any[] = [];
  selectedRound: any | null = null;
  weatherData: any | null = null;
  course_name: string | null = null;
  loading = false;
  userId: string | null = null;
  golfBagId: string | null = null;
  holes: number[] = Array.from({ length: 18 }, (_, i) => i + 1); // ✅ Fix: Define holes in TypeScript
  constructor(
    private supabaseService: SupabaseService,
    private weatherService: WeatherService,
    private router: Router,
    private cdRef: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const user = await this.supabaseService.getCurrentUser();
    if (user) {
      this.userId = user.id;
      await this.loadRounds();
    } else {
      console.warn('No user is authenticated.');
    }
  }

  async loadRounds() {
    if (!this.userId) return;
  
    this.loading = true;
    try {
      const { data, error } = await this.supabaseService.getGolfRoundsByUser(this.userId);
  
      if (!error && data) {
        // Use Promise.all to fetch course names for all rounds concurrently
        this.rounds = await Promise.all(
          data.map(async (round) => {
            const courseName = await this.getCourseName(round.course_id);
            return { ...round, course_name: courseName }; // Append course_name to round
          })
        );
      } else {
        console.error('Error fetching rounds:', error);
      }
  
      this.cdRef.detectChanges();
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      this.loading = false;
    }
  }
  
  async getCourseName(courseId: string): Promise<string> {
    try {
      const courseData = await this.supabaseService.getGolfCourseNameById(courseId);
      if (!courseData || courseData.length === 0 || !courseData[0].name) {
        console.warn(`Course not found for ID: ${courseId}`);
        return "Unknown Course"; // Default value if course is not found
      }
      return courseData[0].name;
    } catch (error) {
      console.error(`Error fetching course name for ID ${courseId}:`, error);
      return "Unknown Course"; // Return a fallback value in case of an error
    }
  }
  
  selectRound(round: any) {
    // If the same round is clicked again, collapse it
    if (this.selectedRound && this.selectedRound.id === round.id) {
      this.selectedRound = null;
      return;
    }
  
    // Expand the selected round and hide the others
    this.selectedRound = round;
    this.weatherData = null;
    this.golfBagId = round.golfbag_id; // Ensure golf bag is stored for navigation
  
    this.fetchWeather(round);
  }
  

  async fetchWeather(round: any) {
    if (!round || !round.course_id || !round.date_played) {
      console.warn("Missing course ID or date");
      return;
    }

    try {
      const courseData = await this.supabaseService.getGolfCourseNameById(round.course_id);
      if (!courseData || courseData.length === 0 || !courseData[0].name) {
        console.warn("Course not found");
        return;
      }

      this.course_name = courseData[0].name ?? '';
      if (!this.course_name) {
        console.warn("Invalid course name");
        return;
      }

      this.weatherService.getWeather(this.course_name, "Austin", "USA", round.date_played)
        .subscribe({
          next: (data) => {
            this.weatherData = data.weather;
            this.cdRef.detectChanges();
          },
          error: (error) => {
            console.error("Error fetching weather:", error);
          },
          complete: () => {
            console.log("Weather fetch completed.");
          }
        });

    } catch (error) {
      console.error("Error fetching course name:", error);
    }
  }

  startNewRound() {
    this.router.navigate(['/new-round']);
  }

  goToHole(holeNumber: number) {
    if (!this.selectedRound || !this.golfBagId) return;

    this.router.navigate([`/golf-hole//${holeNumber}`], {
      state: { roundId: this.selectedRound.id }
    });
  }
}
