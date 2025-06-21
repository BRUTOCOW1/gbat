import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { GolfShot } from '../models/golf-shot.model';

interface GolferClub {
  id: string;
  number: string;
  category: string;
}

@Component({
  selector: 'app-golf-shot',
  templateUrl: './golf-shot.component.html',
  styleUrls: ['./golf-shot.component.css']
})
export class GolfShotComponent implements OnInit {
  holeNum!: string;
  userId!: string;
  roundId!: string;
  golfBagId!: string;
  holeId!: string;        // actual golf_holes.id
  playedHoleId!: string;  // from played_golf_hole.id
  shots: GolfShot[] = [];
  golferClubs: GolferClub[] = [];
  break_pattern_string: string = '';


  newShot: GolfShot = {
    hole_id: '',  // Will be set to playedHoleId
    club_id: '',
    distance: 0,
    shot_type: 'Tee Shot',
    lie: 'Fairway',
    result: 'Fairway',
    stroke_number: 1
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService
  ) {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras.state) {
      this.userId = nav.extras.state['userId'];
      this.golfBagId = nav.extras.state['golfBagId'];
      this.holeId = nav.extras.state['holeId'];
      this.roundId = nav.extras.state['roundId'];
    }
  }

  async ngOnInit(): Promise<void> {
    this.holeNum = this.route.snapshot.paramMap.get('holeNumber')!;
    if (!this.userId || !this.golfBagId) {
      console.error('Missing userId or golfBagId in navigation state');
      this.router.navigate(['/new-round']);
      return;
    }
    // 1) Load clubs for the user’s selected bag
    await this.loadClubs();
    // 2) Ensure we have a playedHoleId
    await this.ensurePlayedHoleId();
    // 3) Load existing shots
    await this.loadShots();
  }
  getParsedBreakPattern(): any {
    try {
      return JSON.parse(this.break_pattern_string || '[]');
    } catch (e) {
      return [];
    }
  }
  
  private async ensurePlayedHoleId(): Promise<void> {
    const playedHoleRes = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
    if (playedHoleRes.data && playedHoleRes.data.length > 0) {
      this.playedHoleId = playedHoleRes.data[0].id;
    } else {
      // If for some reason it doesn’t exist, create it
      const { data: createdHole, error } = await this.supabaseService.createPlayedHole({
        round_id: this.roundId,
        hole_id: this.holeId,
        strokes: 0
      });
      if (error || !createdHole?.length) {
        console.error('Error creating played hole:', error);
        return;
      }
      this.playedHoleId = createdHole[0].id;
    }
    this.newShot.hole_id = this.playedHoleId;
  }

  private async loadShots(): Promise<void> {
    if (!this.playedHoleId) return;
    const data = await this.supabaseService.getShotsForPlayedHole(this.playedHoleId);
    this.shots = data || [];
  }

  private async loadClubs(): Promise<void> {
    const { data, error } = await this.supabaseService.getClubsByBagId(this.golfBagId, this.userId);
    if (error) {
      console.error('Error loading clubs from bag:', error);
      return;
    }
    if (data && data.length > 0) {
      const clubIds = data.map((c) => c.club_id);
      const { data: clubs, error: clubsErr } = await this.supabaseService.getClubsFromIds(clubIds);
      if (clubsErr) {
        console.error('Error fetching club details:', clubsErr);
        return;
      }
      this.golferClubs = clubs || [];
    }
  }
  getClubName(clubId: string): string {
    const club = this.golferClubs.find(c => c.id === clubId);
    return club ? `${club.number} (${club.category})` : 'Unknown Club';
  }
  
  viewShotDetail(shot: GolfShot) {
    this.router.navigate([`/golf-shot-detail/${shot.id}`], {
      state: { shot, holeId: this.holeId, roundId: this.roundId }
    });
  }
  async addShot() {
    const { data, error } = await this.supabaseService.get_golferci_from_golfci(this.newShot.club_id);
    if (!error && data) {
      this.newShot.club_id = data[0].id;
    } else {
      console.error("Was not able to find golfer club id from golf club id");
      return;
    }
  
    if (!this.holeId || !this.newShot.club_id) return;
  
    this.newShot.stroke_number = this.shots.length + 1;
  
    try {
      // Ensure played_golf_hole exists
      let { data: playedHoleData } = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
      let playedHoleId = playedHoleData?.length ? playedHoleData[0].id : null;
  
      if (!playedHoleId) {
        const newPlayedHole = {
          round_id: this.roundId!,
          hole_id: this.holeId,
          strokes: 1,
        };
        const { data: createdPlayedHole } = await this.supabaseService.createPlayedHole(newPlayedHole);
        if (createdPlayedHole && createdPlayedHole.length > 0) {
          playedHoleId = createdPlayedHole[0].id;
        } else {
          console.error("Error: played_golf_hole was not created correctly.");
          return;
        }
      }
  
      // ✅ Convert break_pattern string → JSON before insert
      try {
        this.newShot.break_pattern = JSON.parse(this.break_pattern_string || '[]');
      } catch (e) {
        console.error('Invalid break pattern JSON:', e);
        this.newShot.break_pattern = [];
      }
  
      // Insert the shot
      this.newShot.hole_id = playedHoleId;
      const addedShot = await this.supabaseService.addGolfShot(this.newShot);
      this.shots.push(...addedShot ?? []);
  
      // Update strokes in played_golf_hole
      await this.supabaseService.updatePlayedHoleStrokes(playedHoleId, this.shots.length);
  
      // Check if hole is complete
      if (this.newShot.result === "Made") {
        this.moveToNextHole();
      }
  
      this.resetNewShot();
    } catch (error) {
      console.error("Error adding shot:", error);
    }
  }
  


  private moveToNextHole(): void {
    const nextHole = parseInt(this.holeNum, 10) + 1;
    if (nextHole > 18) {
      console.log('Round complete! Navigating back to round summary...');
      this.router.navigate(['/dashboard']); 
      return;
    }
    this.router.navigate([`/golf-hole/${nextHole}`], {
      state: { roundId: this.roundId }
    });
  }

  async deleteShot(id: string): Promise<void> {
    await this.supabaseService.deleteShot(id);
    this.shots = this.shots.filter((shot) => shot.id !== id);
    // Update strokes in played_golf_hole
    await this.supabaseService.updatePlayedHoleStrokes(this.playedHoleId, this.shots.length);
  }

  private resetNewShot(): void {
    this.newShot = {
      hole_id: this.playedHoleId,
      club_id: '',
      distance: 0,
      shot_type: 'Tee Shot',
      lie: 'Fairway',
      result: 'Fairway',
      stroke_number: this.shots.length + 1
    };
  }
}
