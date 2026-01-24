import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { GolfShot } from '../../shared/models/golf-shot.model';
import { NotificationService } from '../../shared/services/notification.service';

interface GolferClub {
  id: string;             // ✅ golfer_club.id
  club_id: string;        // ✅ golfclub.id (for FK)
  number: string;
  category: string;
}

interface BreakSegment {
  direction: string;
  severity: number;
  distance_start: number;
  distance_end: number;
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
  breakSegments: BreakSegment[] = [];
  isEditMode = false;
  formReady = false;

  currentShotId?: string;           // if you store shot.id
  currentStrokeNumber?: number;     // if your “key” is stroke_number
  prevShot?: GolfShot = {
    hole_id: '',  // Will be set to playedHoleId
    club_id: '',
    distance: 0,
    shot_type: 'Tee Shot',
    lie: 'Fairway',
    result: 'Fairway',
    stroke_number: 1   
  }

  newShot: GolfShot = {
    hole_id: '',  // Will be set to playedHoleId
    club_id: '',
    distance: 0,
    shot_type: 'Tee Shot',
    lie: 'Fairway',
    result: 'Fairway',
    stroke_number: 1,
    is_kick_in: false
  };

  lastGreenSpeed?: number; // Track last green speed for autofill

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
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
    let strokeNum: number;
    if (passedShot || shotNumParam) {
      this.isEditMode = true;

      // Source 1: shot object passed in state
      if (passedShot) {
        this.hydrateFormFromShot(passedShot as GolfShot);
      } else {
        // Source 2: fetch by playedHoleId + stroke number (or by shot id)
        strokeNum = Number(shotNumParam);
        this.currentStrokeNumber = strokeNum;
        if (this.playedHoleId && Number.isFinite(strokeNum)) {
          const row = await this.supabaseService.getShotForPlayedHole(this.playedHoleId, strokeNum);
          if (row) this.hydrateFormFromShot(row as GolfShot);
        }
      }
    } else {
      // Create mode - load previous shot for smart inference
      if (this.playedHoleId && this.shots.length > 0) {
        // Get the last shot from the shots array (already loaded)
        const lastShot = this.shots[this.shots.length - 1];
        if (lastShot) {
          this.prevShot = lastShot;
        }
      }

      // Reset with smart defaults
      this.resetNewShot();
    }

    this.formReady = true;

  }

    // Tolerant JSON parse: handles string or double-encoded string
  private parseJsonLoose(v: unknown): unknown {
    let out = v;
    for (let i = 0; i < 2; i++) {            // try at most twice (handles "\"[]\"" cases)
      if (typeof out === 'string') {
        try { out = JSON.parse(out as string); } catch { break; }
      }
    }
    return out;
  }

  private normalizeBreak(raw: unknown): Array<{ direction?: string; severity?: number }> {
    const parsed = this.parseJsonLoose(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed as any];
    return [];
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
    
    // Load last green speed from round for autofill
    if (!this.lastGreenSpeed) {
      await this.loadLastGreenSpeed();
    }
  }

  private async loadLastGreenSpeed(): Promise<void> {
    try {
      // Get all played holes for this round
      const { data: playedHoles } = await this.supabaseService.getPlayedHolesForRound(this.roundId);
      if (!playedHoles || playedHoles.length === 0) return;

      const playedHoleIds = playedHoles.map(h => h.id);
      
      // Get all shots from this round
      const allShots: GolfShot[] = [];
      for (const holeId of playedHoleIds) {
        const shots = await this.supabaseService.getShotsForPlayedHole(holeId);
        if (shots) {
          allShots.push(...shots);
        }
      }

      // Find the last putt with a green speed
      const putts = allShots.filter(s => s.shot_type === 'Putt' && s.green_speed);
      if (putts.length > 0) {
        const lastPutt = putts[putts.length - 1];
        this.lastGreenSpeed = lastPutt.green_speed;
      }
    } catch (error) {
      console.error('Error loading last green speed:', error);
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
      // Handle kick-in putt - minimal entry
      if (this.newShot.is_kick_in && this.newShot.shot_type === 'Putt') {
        // Set minimal required fields for kick-in
        const putter = this.golferClubs.find(c => 
          c.category?.toLowerCase().includes('putter') ||
          c.number?.toLowerCase().includes('putter')
        );
        if (putter) {
          this.newShot.club_id = putter.id;
          this.newShot.club_name = `${putter.number} ${putter.category}`.trim();
        }
        this.newShot.putt_length = 0; // Kick-in is essentially 0 feet
        this.newShot.result = 'Made';
        this.newShot.result_location = 'Made';
        // Skip other validations for kick-in
      } else {
        // a) club resolve
        const selected = this.golferClubs.find(gc => gc.id === this.newShot.club_id);
        if (!selected) {
          this.notificationService.showError('Please select a club for this shot.');
          return;
        }
        this.newShot.club_name = `${selected.number} ${selected.category}`.trim();
      }
  
      // b) normalize JSON + penalties
      // Use break segments if available, otherwise fall back to string parsing
      if (this.breakSegments.length > 0) {
        this.newShot.break_pattern = this.convertBreakSegmentsToJson();
      } else {
        const arr = this.normalizeBreak(this.break_pattern_string);
        this.newShot.break_pattern = arr;
      }
      
      this.newShot.penalty_strokes = this.getPenaltyStrokes(this.newShot.penalty);
      
      // Set result field for backward compatibility - use result_location as primary value
      // The check constraint expects single values, not combined strings
      if (this.newShot.result_location) {
        this.newShot.result = this.newShot.result_location;
      } else if (!this.newShot.result) {
        // If no result_location and no existing result, set to empty string
        this.newShot.result = '';
      }
      
      // For putts, remove distance if putt_length is set (avoid dual distance)
      if (this.newShot.shot_type === 'Putt' && this.newShot.putt_length) {
        this.newShot.distance = 0;
      }
      
      // Save green speed for next putt autofill
      if (this.newShot.shot_type === 'Putt' && this.newShot.green_speed) {
        this.lastGreenSpeed = this.newShot.green_speed;
      }
  
      // c) find existing played row
      const ph = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
      let playedHoleId = ph?.data?.[0]?.id as string | undefined;
  
      // d) if missing, create with strokes: 1 + penalty strokes
      if (!playedHoleId) {
        const initialStrokes = 1 + (this.newShot.penalty_strokes || 0);
        const { data: created, error } = await this.supabaseService.createPlayedHole({
          round_id: this.roundId!,
          hole_id: this.holeId,
          strokes: initialStrokes, // ✅ satisfies the CHECK constraint, includes penalty
        });
        if (error || !created?.length) {
          const errorMsg = this.notificationService.getErrorMessage(error);
          this.notificationService.showError(errorMsg || 'Unable to create hole entry. Please try again.');
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
      if (!inserted) {
        this.notificationService.showError('Unable to save shot. Please try again.');
        return;
      }

      // h) update strokes on played hole - calculate total including penalty strokes
      // Reload shots to get accurate count including the one we just added
      await this.tryLoadExistingPlayedHoleAndShots();
      // Calculate total: each shot counts as 1 stroke, plus any penalty strokes
      const totalStrokes = this.shots.reduce((sum, shot) => {
        return sum + 1 + (shot.penalty_strokes || 0);
      }, 0);
      await this.supabaseService.updatePlayedHoleStrokes(playedHoleId!, totalStrokes);
  
      // i) local state (shots already refreshed in step h)
      this.playedHoleId = playedHoleId!;
  
      this.notificationService.showSuccess('Shot saved successfully!');

      // Check if hole is complete (Made or kick-in putt)
      const isComplete = this.newShot.result === 'Made' || 
                        this.newShot.result_location === 'Made' ||
                        (this.newShot.is_kick_in && this.newShot.shot_type === 'Putt');
      
      if (isComplete) {
        this.notificationService.showSuccess(`Hole ${this.holeNumber} complete! Moving to next hole...`);
        this.moveToNextHole();
      } else {
        // Update prevShot to the shot we just added for next shot inference
        this.prevShot = { ...this.newShot };
        this.resetNewShot(); // Smart defaults for next shot
      }
    } catch (err) {
      const errorMsg = this.notificationService.getErrorMessage(err);
      this.notificationService.showError(errorMsg);
      console.error('Error adding shot:', err);
    }
  }


  private resetNewShot(): void {
    const nextStrokeNumber = (this.shots?.length ?? 0) + 1;
    
    // Default values
    this.newShot = {
      hole_id: this.playedHoleId || '',
      club_id: '',
      distance: 0,
      shot_type: 'Tee Shot',
      lie: 'Fairway',
      result: '',
      stroke_number: nextStrokeNumber,
      is_kick_in: false,
    };

    // Smart inference based on context
    if (nextStrokeNumber === 1 || this.shots.length === 0) {
      // First shot of the hole is always a tee shot
      this.newShot.shot_type = 'Tee Shot';
      this.newShot.lie = 'Tee Box'; // Special lie for tee shots
      // Suggest driver or appropriate tee club
      this.suggestTeeClub();
    } else if (this.prevShot) {
      // Infer from previous shot's result
      this.inferShotFromPrevious(this.prevShot);
    } else if (this.shots.length > 0) {
      // Fallback: use last shot from array if prevShot wasn't set
      const lastShot = this.shots[this.shots.length - 1];
      if (lastShot) {
        this.inferShotFromPrevious(lastShot);
      }
    }

    // Clear break pattern for new shots
    this.break_pattern_string = '';
    this.breakSegments = [];
    
    // Autofill green speed for putts if available
    if (this.newShot.shot_type === 'Putt' && this.lastGreenSpeed) {
      this.newShot.green_speed = this.lastGreenSpeed;
    }
  }

  addBreakSegment(): void {
    const lastSegment = this.breakSegments.length > 0 
      ? this.breakSegments[this.breakSegments.length - 1] 
      : null;
    
    const newSegment: BreakSegment = {
      direction: '',
      severity: 1,
      distance_start: lastSegment ? lastSegment.distance_end : 0,
      distance_end: lastSegment ? lastSegment.distance_end + 10 : 10
    };
    
    this.breakSegments.push(newSegment);
  }

  removeBreakSegment(index: number): void {
    this.breakSegments.splice(index, 1);
  }

  convertBreakSegmentsToJson(): any[] {
    return this.breakSegments.filter(seg => seg.direction && seg.distance_start !== undefined && seg.distance_end !== undefined);
  }

  /**
   * Smart inference of shot type, lie, and club based on previous shot result
   */
  private inferShotFromPrevious(prevShot: GolfShot): void {
    // Use result_location if available, otherwise fall back to result
    const prevResult = prevShot.result_location || prevShot.result || '';
    const prevLie = prevShot.lie || '';

    // Determine shot type based on where the previous shot ended
    // Check result_location first, then fall back to result
    const location = prevShot.result_location || prevResult;
    
    if (location === 'Green' || location === 'Made' || prevResult.includes('Made')) {
      // If on green or made, next shot is a putt
      this.newShot.shot_type = 'Putt';
      this.newShot.lie = 'Green';
      this.suggestPuttClub();
    } else if (location === 'Fringe') {
      // If on fringe, next is a chip
      this.newShot.shot_type = 'Chip';
      this.newShot.lie = 'Fringe';
      this.suggestChipClub();
    } else if (location === 'Bunker' || prevLie === 'Bunker') {
      // If in bunker, next is a recovery/sand shot
      this.newShot.shot_type = 'Recovery';
      this.newShot.lie = 'Bunker';
      this.suggestSandClub();
    } else if (location === 'Water' || location === 'OB') {
      // If in water or OB, next is a recovery/re-entry shot
      this.newShot.shot_type = 'Recovery';
      this.newShot.lie = location === 'Water' ? 'Fairway' : 'Fairway'; // After drop/penalty
      this.suggestRecoveryClub();
    } else if (['Fairway', 'Light Rough', 'Thick Rough'].includes(location)) {
      // If on fairway or rough, next is likely an approach shot
      this.newShot.shot_type = 'Approach';
      this.newShot.lie = location;
      this.suggestApproachClub();
    } else if (location === 'Trees') {
      // If in trees, next is a punchout/recovery
      this.newShot.shot_type = 'Punchout';
      this.newShot.lie = 'Trees';
      this.suggestPunchoutClub();
    } else {
      // Default: approach shot from current lie
      this.newShot.shot_type = 'Approach';
      this.newShot.lie = location || prevLie || 'Fairway';
    }
  }

  /**
   * Suggest appropriate club for tee shot (usually driver or longest club)
   */
  private suggestTeeClub(): void {
    if (this.golferClubs.length === 0) return;
    
    // Look for driver first
    const driver = this.golferClubs.find(c => 
      c.category?.toLowerCase().includes('driver') || 
      c.number?.toLowerCase().includes('driver')
    );
    
    if (driver) {
      this.newShot.club_id = driver.id;
      return;
    }
    
    // Otherwise, suggest the longest club (lowest number in irons, or wood)
    const sortedClubs = [...this.golferClubs].sort((a, b) => {
      const aNum = parseInt(a.number || '99');
      const bNum = parseInt(b.number || '99');
      return aNum - bNum;
    });
    
    if (sortedClubs.length > 0) {
      this.newShot.club_id = sortedClubs[0].id;
    }
  }

  /**
   * Suggest appropriate club for putting (putter)
   */
  private suggestPuttClub(): void {
    if (this.golferClubs.length === 0) return;
    
    const putter = this.golferClubs.find(c => 
      c.category?.toLowerCase().includes('putter') ||
      c.number?.toLowerCase().includes('putter')
    );
    
    if (putter) {
      this.newShot.club_id = putter.id;
    }
  }

  /**
   * Suggest appropriate club for chipping (usually wedge)
   */
  private suggestChipClub(): void {
    if (this.golferClubs.length === 0) return;
    
    // Look for wedge (sand, gap, lob, or pitching wedge)
    const wedge = this.golferClubs.find(c => {
      const cat = c.category?.toLowerCase() || '';
      const num = c.number?.toLowerCase() || '';
      return cat.includes('wedge') || num.includes('wedge') || 
             ['sw', 'gw', 'lw', 'pw', 'aw'].some(w => num.includes(w));
    });
    
    if (wedge) {
      this.newShot.club_id = wedge.id;
    }
  }

  /**
   * Suggest appropriate club for sand shots (sand wedge)
   */
  private suggestSandClub(): void {
    if (this.golferClubs.length === 0) return;
    
    // Look for sand wedge specifically
    const sandWedge = this.golferClubs.find(c => {
      const cat = c.category?.toLowerCase() || '';
      const num = c.number?.toLowerCase() || '';
      return cat.includes('sand') || num.includes('sand') || num.includes('sw');
    });
    
    if (sandWedge) {
      this.newShot.club_id = sandWedge.id;
    } else {
      // Fallback to any wedge
      this.suggestChipClub();
    }
  }

  /**
   * Suggest appropriate club for recovery shots (usually mid-iron or hybrid)
   */
  private suggestRecoveryClub(): void {
    if (this.golferClubs.length === 0) return;
    
    // Look for hybrid or mid-iron (6-8 iron)
    const hybrid = this.golferClubs.find(c => 
      c.category?.toLowerCase().includes('hybrid')
    );
    
    if (hybrid) {
      this.newShot.club_id = hybrid.id;
      return;
    }
    
    // Otherwise suggest 7-iron
    const sevenIron = this.golferClubs.find(c => 
      c.number === '7' && c.category?.toLowerCase().includes('iron')
    );
    
    if (sevenIron) {
      this.newShot.club_id = sevenIron.id;
    }
  }

  /**
   * Suggest appropriate club for approach shots (usually mid to short iron)
   */
  private suggestApproachClub(): void {
    if (this.golferClubs.length === 0) return;
    
    // Suggest 7 or 8 iron for approach shots (can be adjusted based on distance)
    const approachIron = this.golferClubs.find(c => {
      const num = c.number || '';
      return (num === '7' || num === '8' || num === '9') && 
             c.category?.toLowerCase().includes('iron');
    });
    
    if (approachIron) {
      this.newShot.club_id = approachIron.id;
    }
  }

  /**
   * Suggest appropriate club for punchout shots (usually low iron or hybrid)
   */
  private suggestPunchoutClub(): void {
    if (this.golferClubs.length === 0) return;
    
    // Suggest 4 or 5 iron for punchout (low trajectory)
    const punchoutIron = this.golferClubs.find(c => {
      const num = c.number || '';
      return (num === '4' || num === '5') && 
             c.category?.toLowerCase().includes('iron');
    });
    
    if (punchoutIron) {
      this.newShot.club_id = punchoutIron.id;
    } else {
      // Fallback to recovery club
      this.suggestRecoveryClub();
    }
  }
  

  private moveToNextHole(): void {
    const nextHole = parseInt(this.holeNum, 10) + 1;
    if (nextHole > 18) {
      this.notificationService.showSuccess('Round complete! Great round!');
      this.router.navigate([`/round-summary/${this.roundId}`]); 
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

    const arr = this.normalizeBreak(shot.break_pattern);
    this.break_pattern_string = JSON.stringify(arr);
    this.newShot.break_pattern = arr;
    
    // Load break segments from the parsed array
    if (Array.isArray(arr) && arr.length > 0) {
      this.breakSegments = arr.map((seg: any) => ({
        direction: seg.direction || '',
        severity: seg.severity || 1,
        distance_start: seg.distance_start ?? 0,
        distance_end: seg.distance_end ?? 10
      }));
    } else {
      this.breakSegments = [];
    }
  }

  private normalizeBeforeSave() {
    const selected = this.golferClubs.find(gc => gc.id === this.newShot.club_id);
    if (selected) {
      this.newShot.club_name = `${selected.number} ${selected.category}`.trim();
    }
  
    // Use break segments if available, otherwise fall back to string parsing
    if (this.breakSegments.length > 0) {
      this.newShot.break_pattern = this.convertBreakSegmentsToJson();
    } else {
      const arr = this.normalizeBreak(this.break_pattern_string);
      this.newShot.break_pattern = arr;
    }
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
      this.notificationService.showError('Unable to update shot. Missing shot identifier.');
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
    if (!confirm('Are you sure you want to delete this shot?')) {
      return;
    }

    try {
      if (this.currentShotId) {
        await this.supabaseService.deleteShot(this.currentShotId);
      } else if (this.playedHoleId && this.currentStrokeNumber) {
        await this.supabaseService.deleteShotByPlayedHoleAndStroke(this.playedHoleId, this.currentStrokeNumber);
      } else {
        this.notificationService.showError('Unable to delete shot. Missing shot identifier.');
        return;
      }

      this.notificationService.showSuccess('Shot deleted successfully.');
      this.router.navigate([`/golf-shot/${this.holeNumber}`], { state: { roundId: this.roundId } });
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error deleting shot: ${errorMsg}`);
    }
  }
}
