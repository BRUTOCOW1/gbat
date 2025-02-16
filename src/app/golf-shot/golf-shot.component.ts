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
  holeId!: string;
  holeNum!: string
  userId!: string;
  roundId!: string;
  golfBagId!: string;
  shots: GolfShot[] = [];

  golferClubs: GolferClub[] = [];

  newShot: GolfShot = {
    hole_id: this.holeId,
    club_id: '',
    distance: 0,
    shot_type: 'Tee Shot',
    lie: 'Fairway',
    result: 'Fairway',
    stroke_number: 1
  };

  constructor(private route: ActivatedRoute, private router: Router, private supabaseService: SupabaseService) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.userId = navigation.extras.state['userId'];
      this.golfBagId = navigation.extras.state['golfBagId'];
      this.holeId = navigation.extras.state['holeId'];
      this.roundId = navigation.extras.state['roundId'];
      console.log("bexoop", this.roundId);
    }
  }

  async ngOnInit() {
    this.holeNum = this.route.snapshot.paramMap.get('holeNumber')!;
    if (!this.userId || !this.golfBagId) {
      console.error("Missing userId or golfBagId in navigation state");
      this.router.navigate(['/new-round']); // Redirect back if state is missing
    }
    this.loadClubs();
  }

  async loadClubs() {
    if (!this.userId || !this.golfBagId) return;
    const { data, error } = await this.supabaseService.getClubsByBagId(this.golfBagId, this.userId);
    if (!error && data) {
      const clubIds = data.map((club) => club.club_id);
      if (clubIds.length > 0) {
        const { data: clubData, error } = await this.supabaseService.getClubsFromIds(clubIds);
        if (!error && clubData) {
          this.golferClubs = clubData;
        }
      }
    }        
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
        // Ensure `played_golf_hole` exists
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

        // Insert the shot
        this.newShot.hole_id = playedHoleId;
        const addedShot = await this.supabaseService.addGolfShot(this.newShot);
        this.shots.push(...addedShot);

        // Update strokes in `played_golf_hole`
        await this.supabaseService.updatePlayedHoleStrokes(playedHoleId, this.shots.length);

        // Check if hole is complete (i.e., last shot result is "Made")
        if (this.newShot.result === "Made") {
            this.moveToNextHole();
        }

        this.resetNewShot();
    } catch (error) {
        console.error("Error adding shot:", error);
    }
}

  
moveToNextHole() {
  const nextHole = parseInt(this.holeNum) + 1;

  if (nextHole > 18) {
      console.log("Round complete!");
      this.router.navigate(['/golf-round', this.roundId]); // Navigate back to round summary
  } else {
      this.router.navigate([`/golf-hole/${nextHole}`], {
          state: { userId: this.userId, golfBagId: this.golfBagId, roundId: this.roundId }
      });
  }
}


  
  
  
  async ensurePlayedHoleExists(): Promise<string> {
    const { data, error } = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
  
    if (!error && data.length > 0) {
      return data[0].id; // ✅ Hole already exists, return its ID
    }
  
    // If no entry exists, create it
    const newHoleEntry = {
      round_id: this.roundId,
      hole_id: this.holeId,
      strokes: 1, // Default values
      fairway_hit: false,
      green_in_regulation: false,
      penalty_strokes: 0
    };
  
    const { data: createdHole, error: createError } = await this.supabaseService.createPlayedHole(newHoleEntry);
    
    if (createError) {
      console.error("Error creating played hole:", createError);
      throw createError;
    }
  
    return createdHole[0].id; // ✅ Return new hole ID
  }
  
  // 81f3226f-57d8-47ba-bddc-003992d39fb3 d5dc3a65-5e12-4f93-949d-fc67fd6531d1
  // d5dc3a65-5e12-4f93-949d-fc67fd6531d1
  async deleteShot(id: string) {
    await this.supabaseService.deleteShot(id);
    this.shots = this.shots.filter(shot => shot.id !== id);
  }

  resetNewShot() {
    this.newShot = {
      hole_id: this.holeId,
      club_id: '',
      distance: 0,
      shot_type: 'Tee Shot',
      lie: 'Fairway',
      result: 'Fairway',
      stroke_number: this.shots.length + 1
    };
  }
}
