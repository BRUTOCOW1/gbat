import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

@Component({
  selector: 'app-golf-hole',
  templateUrl: './golf-hole.component.html',
  styleUrls: ['./golf-hole.component.css']
})
export class GolfHoleComponent implements OnInit {
  roundId!: string;
  holeNumber!: number;
  userId!: string;
  courseId!: string;
  golfBagId!: string;
  holeDetails: any;
  shots: any[] = [];
  playedHoleId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.roundId = navigation.extras.state['roundId'];
    }
  }

  async ngOnInit(): Promise<void> {
    // We read the holeNumber from the route param
    this.holeNumber = parseInt(this.route.snapshot.paramMap.get('holeNumber')!, 10);

    // Fetch the round so we know the courseId, userId, golfBagId
    const roundRes = await this.supabaseService.getGolfRoundById(this.roundId);
    if (roundRes.data && roundRes.data.length > 0) {
      const round = roundRes.data[0];
      this.courseId = round.course_id;
      this.userId = round.user_id;
      this.golfBagId = round.golfbag_id;
    } else {
      console.error('No round data found. Redirecting...');
      this.router.navigate(['/dashboard']);
      return;
    }

    await this.loadHoleDetails();
    await this.loadShots();
  }

  private async loadHoleDetails(): Promise<void> {
    const response = await this.supabaseService.getGolfHoleDetails(this.courseId, this.holeNumber);
    if (response.error) {
      console.error('Error fetching hole details:', response.error);
      return;
    }
    this.holeDetails = response.data;
  }

  private async loadShots(): Promise<void> {
    // 1) Check or create played_golf_hole
    const playedHoleRes = await this.supabaseService.getPlayedHole(this.roundId, this.holeDetails.id);
    if (playedHoleRes.data && playedHoleRes.data.length > 0) {
      this.playedHoleId = playedHoleRes.data[0].id;
    } else {
      // create a new played hole
      const { data: createdHole, error } = await this.supabaseService.createPlayedHole({
        round_id: this.roundId,
        hole_id: this.holeDetails.id,
        strokes: 1
      });
      if (error || !createdHole?.length) {
        console.error('Error creating played hole:', error);
        return;
      }
      this.playedHoleId = createdHole[0].id;
    }

    // 2) Fetch shots for that played hole
    if (this.playedHoleId) {
      const shotsData = await this.supabaseService.getShotsForPlayedHole(this.playedHoleId);
      this.shots = shotsData || [];
    }
  }

  goToShotEntry(): void {
    this.router.navigate([`/golf-shot/${this.holeNumber}`], {
      state: {
        userId: this.userId,
        golfBagId: this.golfBagId,
        holeId: this.holeDetails.id,
        roundId: this.roundId
      }
    });
  }
}
