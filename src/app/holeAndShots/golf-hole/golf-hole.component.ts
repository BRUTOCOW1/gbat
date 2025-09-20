import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

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
  numHoles: any;

  holeDetails: any;
  shots: any[] = [];
  playedHoleId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
  ) {
    // getCurrentNavigation only exists during an in-app navigation, not on hard reloads.
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras.state?.['roundId']) {
      this.roundId = nav.extras.state['roundId'];
    } else if ((window.history.state as any)?.roundId) {
      this.roundId = (window.history.state as any).roundId;
    }
  }

  async ngOnInit(): Promise<void> {
    // 1) Read the initial holeNumber (ok to use snapshot once)
    this.holeNumber = parseInt(this.route.snapshot.paramMap.get('holeNumber')!, 10);

    // 2) Ensure round context BEFORE reacting to hole changes
    if (!this.roundId) {
      // optional: pull from query param if you use it ?roundId=...
      const q = this.route.snapshot.queryParamMap.get('roundId');
      if (q) this.roundId = q;
    }
    const roundRes = await this.supabaseService.getGolfRoundById(this.roundId);
    const round = roundRes?.data?.[0];
    if (!round) {
      console.error('No round data found. Redirecting...');
      this.router.navigate(['/dashboard']);
      return;
    }
    this.courseId = round.course_id;
    this.numHoles = (await this.supabaseService.getGolfHolesByCourseId(this.courseId)).length;
    this.userId = round.user_id;
    this.golfBagId = round.golfbag_id;

    // 3) Initial load for the current hole
    await this.loadHole(this.holeNumber);

    // 4) NOW subscribe to param changes (courseId etc. is ready)
    this.route.paramMap.subscribe(pm => {
      const n = pm.get('holeNumber');
      if (!n) return;
      const nextNum = +n;

      // Reset per-hole state to avoid UI showing stale info while loading
      this.holeNumber = nextNum;
      this.holeDetails = null;
      this.shots = [];
      this.playedHoleId = null;

      // Fire-and-forget; the method awaits internally
      void this.loadHole(nextNum);
    });
  }

  /** Single place to (re)load both details and shots for a hole */
  private async loadHole(num: number): Promise<void> {
    try {
      await this.loadHoleDetails(num); // sets this.holeDetails
      await this.loadShots();          // uses this.holeDetails.id
    } catch (e) {
      console.error('Failed to load hole:', e);
    }
  }

  /** Fetch ONE hole’s details for (courseId, holeNumber) */
  private async loadHoleDetails(holeNum: number): Promise<void> {
    // Assuming your service returns { data: Hole[] }
    const resp = await this.supabaseService.getGolfHoleDetails(this.courseId, holeNum);
    if (resp.error) {
      console.error('Error fetching hole details:', resp.error);
      return;
    }
    const rows = resp.data ?? [];
    this.holeDetails = Array.isArray(rows) ? rows[0] : rows;
    if (!this.holeDetails) {
      console.warn('No hole details returned for course', this.courseId, 'hole', holeNum);
    }
  }

  /** Ensure played_golf_hole exists and load its shots */
  private async loadShots(): Promise<void> {
    if (!this.holeDetails?.id || !this.roundId) {
      console.warn('Missing holeDetails.id or roundId when loading shots');
      return;
    }

    // // 1) Find or create played_golf_hole
    const playedHoleRes = await this.supabaseService.getPlayedHole(this.roundId, this.holeDetails.id);
    if (playedHoleRes.error) {
      console.error('Error fetching played hole:', playedHoleRes.error);
      return;
    }
    const existing = playedHoleRes.data ?? [];
    if (existing.length > 0) {
      this.playedHoleId = existing[0].id;
    }
    // } else {
    //   const createdRes = await this.supabaseService.createPlayedHole({
    //     round_id: this.roundId,
    //     hole_id: this.holeDetails.id,
    //     strokes: 0 // start at 0; set to 1 only when a shot exists, if that’s your model
    //   });
    //   if (createdRes.error || !createdRes.data?.length) {
    //     console.error('Error creating played hole:', createdRes.error);
    //     return;
    //   }
    //   this.playedHoleId = createdRes.data[0].id;
    // }

    // 2) Load shots for this played hole
    if (this.playedHoleId) {
      const shotsRes = await this.supabaseService.getShotsForPlayedHole(this.playedHoleId);
      if ((shotsRes as any)?.error) {
        console.error('Error fetching shots:', (shotsRes as any).error);
        this.shots = [];
        return;
      }
      // If your service returns { data, error }, use .data; if it returns an array, use directly
      this.shots = (shotsRes as any)?.data ?? shotsRes ?? [];
    }
  }

  goToShotEntry(): void {
    if (!this.holeDetails?.id) return;
    this.router.navigate([`/golf-shot/${this.holeNumber}/newShot`], {
      state: {
        userId: this.userId,
        golfBagId: this.golfBagId,
        holeId: this.holeDetails.id,
        roundId: this.roundId
      }
    });
  }

  goToShot(shotNum: number): void {
    if (!this.holeDetails?.id) return;
    this.router.navigate([`/golf-shot/${this.holeNumber}/${shotNum}`], {
      state: {
        userId: this.userId,
        golfBagId: this.golfBagId,
        holeId: this.holeDetails.id,
        roundId: this.roundId
      }
    });
  }

  goToPreviousHole(): void {
    this.navigateToHole(this.holeNumber - 1);
  }

  goToNextHole(): void {
    this.navigateToHole(this.holeNumber + 1);
  }

  private navigateToHole(num: number): void {
    // Guard: don’t navigate with undefined state values
    this.router.navigate([`/golf-hole/${num}`], {
      state: {
        userId: this.userId,
        golfBagId: this.golfBagId,
        roundId: this.roundId
        // no need to pass holeId; we re-fetch details anyway
      }
    });
  }

  goToRound(): void {
    this.router.navigate([`/golf-round/${this.roundId}`]);
  }
}
