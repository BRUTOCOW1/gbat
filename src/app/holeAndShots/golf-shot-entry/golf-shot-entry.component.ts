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
  selector: 'app-golf-shot-entry',
  templateUrl: './golf-shot-entry.component.html',
  styleUrls: ['./golf-shot-entry.component.css']
})
export class GolfShotEntryComponent implements OnInit {
  holeNum!: string;
  holeNumber!: number;
  userId!: string;
  roundId!: string;
  golfBagId!: string;
  holeId!: string;        // actual golf_holes.id
  playedHoleId: string | null = null;  // from played_golf_hole.id
  shots: GolfShot[] = [];
  golferClubs: GolferClub[] = [];
  break_pattern_string: string = '';
  isEditMode = false;
  formReady = false;

  currentShotId?: string;           // if you store shot.id
  currentStrokeNumber?: number;     // if your “key” is stroke_number

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
    console.error("getting here")
    this.holeNum = this.route.snapshot.paramMap.get('holeNumber')!;
    this.holeNumber = parseInt(this.holeNum, 10);

    const shotNumParam = this.route.snapshot.paramMap.get('shotNumber'); // only if you route here for edit
    const st = (this.router.getCurrentNavigation()?.extras.state as any) ?? (window.history.state as any);

    // state may carry a full shot object when clicking from a list
    const passedShot = st?.shot as Partial<GolfShot> | undefined;

    if (!this.userId || !this.golfBagId) {
      this.router.navigate(['/new-round']);
      return;
    }
    // 1) Load clubs for the user’s selected bag
    await this.loadClubs();
    await this.tryLoadExistingPlayedHoleAndShots();

    // Decide edit vs create
    if (passedShot || shotNumParam) {
      this.isEditMode = true;

      // Source 1: shot object passed in state
      if (passedShot) {
        this.hydrateFormFromShot(passedShot as GolfShot);
      } else {
        // Source 2: fetch by playedHoleId + stroke number (or by shot id)
        const strokeNum = Number(shotNumParam);
        this.currentStrokeNumber = strokeNum;
        if (this.playedHoleId && Number.isFinite(strokeNum)) {
          const row = await this.supabaseService.getShotForPlayedHole(this.playedHoleId, strokeNum);
          if (row) this.hydrateFormFromShot(row as GolfShot);
        }
      }
    } else {
      // create mode
      this.resetNewShot(); // ensure defaults
    }

    this.formReady = true;

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
  
  private async tryLoadExistingPlayedHoleAndShots(): Promise<void> {
    const ph = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
    const existing = ph?.data ?? [];
    if (existing.length) {
      this.playedHoleId = existing[0].id;
      const data = await this.supabaseService.getShotsForPlayedHole(this.playedHoleId!);
      this.shots = (data || []).map(shot => {
        const club = this.golferClubs.find(c => c.id === shot.club_id);
        return { ...shot, club_name: club ? `${club.number} ${club.category}`.trim() : 'Unknown Club' };
      });
    } else {
      this.playedHoleId = null; // No row yet; that’s fine until first shot
      this.shots = [];
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

  onPenaltyChange(): void {
    this.newShot.penalty_strokes = this.getPenaltyStrokes(this.newShot.penalty);
  }
  
  getClubName(clubId: string): string {
    const club = this.golferClubs.find(c => c.id === clubId);
    return club ? `${club.number} (${club.category})` : 'Unknown Club';
  }
  

  async addShot() {
    try {
      // a) club resolve
      const selected = this.golferClubs.find(gc => gc.id === this.newShot.club_id);
      if (!selected) {
        console.error('No golfer club for id', this.newShot.club_id);
        return;
      }
      this.newShot.club_name = `${selected.number} ${selected.category}`.trim();
  
      // b) normalize JSON + penalties
      try { this.newShot.break_pattern = JSON.parse(this.break_pattern_string || '[]'); }
      catch { this.newShot.break_pattern = []; }
      this.newShot.penalty_strokes = this.getPenaltyStrokes(this.newShot.penalty);
  
      // c) find existing played row
      const ph = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
      let playedHoleId = ph?.data?.[0]?.id as string | undefined;
  
      // d) if missing, create with strokes: 1
      if (!playedHoleId) {
        const { data: created, error } = await this.supabaseService.createPlayedHole({
          round_id: this.roundId!,
          hole_id: this.holeId,
          strokes: 1, // ✅ satisfies the CHECK constraint
        });
        if (error || !created?.length) {
          console.error('Error: played_golf_hole was not created.', error);
          return;
        }
        playedHoleId = created[0].id;
        this.shots = []; // first shot in this hole
      }
  
      // e) compute next stroke number (use current list length + 1)
      const nextStroke = (this.shots?.length ?? 0) + 1;
  
      // f) set FK to played hole, stroke number
      this.newShot.hole_id = playedHoleId!;
      this.newShot.stroke_number = nextStroke;
  
      // g) insert shot
      const inserted = await this.supabaseService.addGolfShot(this.newShot);
      if (!inserted) return;
  
      // h) update strokes on played hole to nextStroke
      await this.supabaseService.updatePlayedHoleStrokes(playedHoleId!, nextStroke);
  
      // i) local state
      this.playedHoleId = playedHoleId!;
      await this.tryLoadExistingPlayedHoleAndShots(); // refresh list
  
      if (this.newShot.result === 'Made') {
        this.moveToNextHole();
      } else {
        this.resetNewShot(); // keep hole_id prefilled below
      }
    } catch (err) {
      console.error('Error adding shot:', err);
    }
  }
  
  private resetNewShot(): void {
    this.newShot = {
      hole_id: this.playedHoleId || '', // keep it if we have it
      club_id: '',
      distance: 0,
      shot_type: 'Tee Shot',
      lie: 'Fairway',
      result: 'Fairway',
      stroke_number: (this.shots?.length ?? 0) + 1,
    };
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
    await this.supabaseService.updatePlayedHoleStrokes(this.playedHoleId!, this.shots.length);
  }


  goToHole(holeNumber: number): void {
    this.router.navigate([`/golf-hole/${holeNumber}`], {
      state: { roundId: this.roundId }
    });
  }

  private hydrateFormFromShot(shot: GolfShot) {
    // Keep identifiers for update/delete
    this.currentShotId = (shot as any).id; // if you have an id column
    this.currentStrokeNumber = shot.stroke_number;

    // If your select uses golfer_club.id, ensure .club_id matches that
    // (You already do that in your add flow.)
    this.newShot = {
      ...shot,
      // Make sure we keep FK to played hole if required by schema
      hole_id: shot.hole_id,
    };

    // Text field expects a string
    this.break_pattern_string = JSON.stringify(shot.break_pattern ?? []);
  }

  private normalizeBeforeSave() {
    // ensure club_name, penalties, and break_pattern
    const selected = this.golferClubs.find(gc => gc.id === this.newShot.club_id);
    if (selected) {
      this.newShot.club_name = `${selected.number} ${selected.category}`.trim();
    }

    try { this.newShot.break_pattern = JSON.parse(this.break_pattern_string || '[]'); }
    catch { this.newShot.break_pattern = []; }

    this.newShot.penalty_strokes = this.getPenaltyStrokes(this.newShot.penalty);
  }

  async onSubmit() {
    this.normalizeBeforeSave();

    if (this.isEditMode) {
      await this.saveEdits();
    } else {
      await this.addShot(); // your existing insert flow
    }
  }

  private async saveEdits() {
    // Prefer updating by shot.id. If you don’t have it, update by (played_hole_id, stroke_number)
    if (this.currentShotId) {
      await this.supabaseService.updateGolfShotById(this.currentShotId, this.newShot);
    } else if (this.playedHoleId && this.currentStrokeNumber) {
      await this.supabaseService.updateGolfShotByPlayedHoleAndStroke(
        this.playedHoleId,
        this.currentStrokeNumber,
        this.newShot
      );
    } else {
      console.error('No key to update shot.');
      return;
    }

    // Optionally refresh local list or navigate back
    this.router.navigate([`/golf-shot/${this.holeNumber}/${this.currentStrokeNumber}`], {
      state: { roundId: this.roundId, userId: this.userId, golfBagId: this.golfBagId, holeId: this.holeId }
    });
  }

  cancelEdit() {
    this.router.navigate([`/golf-shot/${this.holeNumber}/${this.currentStrokeNumber ?? 1}`], {
      state: { roundId: this.roundId, userId: this.userId, golfBagId: this.golfBagId, holeId: this.holeId }
    });
  }

  async deleteCurrentShot() {
    if (this.currentShotId) {
      await this.supabaseService.deleteShot(this.currentShotId);
    } else if (this.playedHoleId && this.currentStrokeNumber) {
      await this.supabaseService.deleteShotByPlayedHoleAndStroke(this.playedHoleId, this.currentStrokeNumber);
    }
    this.router.navigate([`/golf-shot/${this.holeNumber}`], { state: { roundId: this.roundId } });
  }
}
