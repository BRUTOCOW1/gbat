import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { GolfShot } from '../../shared/models/golf-shot.model';

interface GolferClub {
  id: string;             // ✅ golfer_club.id
  club_id: string;        // ✅ golfclub.id (for FK)
  number: string;
  category: string;
}



@Component({
  selector: 'app-golf-shot',
  templateUrl: './golf-shot.component.html',
  styleUrls: ['./golf-shot.component.css']
})
export class GolfShotComponent implements OnInit {
  shotNum!: string;
  holeNum!: string;
  holeNumber!: number;
  userId!: string;
  roundId!: string;
  golfBagId!: string;
  holeId!: string;        // actual golf_holes.id
  playedHoleId: string | null = null;  // from played_golf_hole.id
  golferClubs: GolferClub[] = [];
  break_pattern_string: string = '';


  shot: GolfShot = {
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
    this.holeNumber = parseInt(this.holeNum, 10);
    this.shotNum = this.route.snapshot.paramMap.get('shotNumber')!;

    if (!this.userId || !this.golfBagId) {
      console.error('Missing userId or golfBagId in navigation state');
      this.router.navigate(['/new-round']);
      return;
    }
    // 1) Load clubs for the user’s selected bag
    await this.loadClubs();
    await this.tryLoadExistingPlayedHoleAndShots();
    await this.loadShot();
  }
  getParsedBreakPattern(): any {
    try {
      return JSON.parse(this.break_pattern_string || '[]');
    } catch (e) {
      return [];
    }
  }

  getPenaltyStrokes(penalty: string | undefined): number {
    switch (penalty) {
      case 'stroke_only':
      case 'drop':
      case 'unplayable':
        return 1;
      case 'stroke_and_distance':
        return 2;
      default:
        return 0;
    }
  }
  // inside class GolfShotComponent
  get clubName(): string | null {
    if (!this.shot) return null as any;
    if (this.shot.club_name) return this.shot.club_name;
    const name = this.getClubName(this.shot.club_id || '');
    return name === 'Unknown Club' ? null : name;
  }

  

  
  private async tryLoadExistingPlayedHoleAndShots(): Promise<void> {
    const ph = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
    const existing = ph?.data ?? [];
    if (existing.length) {
      this.playedHoleId = existing[0].id;
    } else {
      this.playedHoleId = null; // No row yet; that’s fine until first shot
    }
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
      this.golferClubs = data.map((gc) => {
        const match = (clubs || []).find((club) => club.id === gc.club_id);
        return match
          ? {
              id: gc.id,                // ✅ golfer_club.id
              club_id: gc.club_id,      // ✅ FK to golfclub
              number: match.number,
              category: match.category
            }
          : {
              id: gc.id,                // ✅ still use golfer_club.id
              club_id: gc.club_id,
              number: 'Unknown',
              category: 'Unknown'
            };
      });
    }
  }

  private async loadShot(): Promise<void> {

    if (!this.playedHoleId) return;
  
    const row = await this.supabaseService.getShotForPlayedHole(
      this.playedHoleId,
      parseInt(this.shotNum, 10)
    );
    if (!row) { this.shot = { ...this.shot, stroke_number: 1 }; return; }
  
    const club = this.golferClubs.find(c => c.id === row.club_id);
    this.shot = {
      ...row,
      club_name: club ? `${club.number} ${club.category}`.trim() : 'Unknown Club',
    };
  }
  

  onPenaltyChange(): void {
    this.shot.penalty_strokes = this.getPenaltyStrokes(this.shot.penalty);
  }
  
  getClubName(clubId: string): string {
    const club = this.golferClubs.find(c => c.id === clubId);
    return club ? `${club.number} (${club.category})` : 'Unknown Club';
  }

  goToHole(holeNumber: number): void {
    this.router.navigate([`/golf-hole/${holeNumber}`], {
      state: { roundId: this.roundId }
    });
  }
  editShot(shot: GolfShot) {
    this.router.navigate([`/golf-shot/${this.holeNumber}/${shot.stroke_number}/edit`], {
      state: {
        shot,                    // ← whole object
        roundId: this.roundId,
        userId: this.userId,
        golfBagId: this.golfBagId,
        holeId: this.holeId      // golf_holes.id
      }
    });
  }
  

}
