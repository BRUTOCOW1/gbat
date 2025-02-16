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

  round!: any;

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

  async ngOnInit() {

    this.round = (await this.supabaseService.getGolfRoundById(this.roundId)).data![0];
    console.log(this.round);
    this.courseId = this.round.course_id;
    this.userId = this.round.user_id;
    this.golfBagId = this.round.golfbag_id
    this.holeNumber = parseInt(this.route.snapshot.paramMap.get('holeNumber')!, 10);
  
    if (!this.userId || !this.golfBagId) {
      console.error("Missing userId or golfBagId in navigation state");
      this.router.navigate(['/golf-round']);
    }
  
    await this.loadHoleDetails();
    await this.loadShots();
  }
  

  async loadHoleDetails() {
    const response = await this.supabaseService.getGolfHoleDetails(this.courseId, this.holeNumber);
    console.log(response);
    if (response.error) {
      console.error("Error fetching hole details:", response.error);
      return;
    }
  
    this.holeDetails = response.data;
  }
  

  async loadShots() {

    let { data: playedHoleData } = await this.supabaseService.getPlayedHole(this.roundId, this.holeDetails.id);
    let playedHoleId = playedHoleData?.length ? playedHoleData[0].id : null;

    const data = await this.supabaseService.getShotsForPlayedHole(playedHoleId);

    if (data) {
        this.shots = data;
    } else {
        console.warn("No shots found for this hole.");
    }
}

  goToShotEntry() {
    this.router.navigate([`/golf-shot/${this.holeDetails.hole_number}`], {
      state: { 
        userId: this.userId, 
        golfBagId: this.golfBagId, 
        holeId: this.holeDetails.id,
        roundId: this.roundId
      }
    });
  }
}
