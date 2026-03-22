import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { GolfShot } from '../../shared/models/golf-shot.model';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-penalty-shot-entry',
  templateUrl: './penalty-shot-entry.component.html',
  styleUrls: ['./penalty-shot-entry.component.css'],
})
export class PenaltyShotEntryComponent implements OnInit {
  holeNumber!: number;
  userId!: string;
  roundId!: string;
  golfBagId!: string;
  holeId!: string;
  playedHoleId: string | null = null;
  shots: GolfShot[] = [];
  golferClubs: { id: string; number: string; category: string }[] = [];

  penaltyType: NonNullable<GolfShot['penalty']> = 'drop';
  saving = false;
  ready = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {
    const nav = this.router.getCurrentNavigation();
    const st =
      nav?.extras.state ??
      (typeof history !== 'undefined' ? ((history.state as Record<string, unknown>) || {}) : {});
    this.userId = st['userId'] as string;
    this.golfBagId = st['golfBagId'] as string;
    this.holeId = st['holeId'] as string;
    this.roundId = st['roundId'] as string;
  }

  async ngOnInit(): Promise<void> {
    const hn = this.route.snapshot.paramMap.get('holeNumber');
    this.holeNumber = hn ? parseInt(hn, 10) : 1;

    if (!this.userId || !this.golfBagId || !this.holeId || !this.roundId) {
      this.notificationService.showWarning('Missing round context.');
      this.router.navigate(['/new-round']);
      return;
    }

    await this.loadClubs();
    await this.loadPlayedHoleAndShots();
    this.ready = true;
  }

  private async loadClubs(): Promise<void> {
    const { data, error } = await this.supabaseService.getClubsByBagId(this.golfBagId, this.userId);
    if (error || !data?.length) {
      this.notificationService.showError('Could not load clubs for this bag.');
      return;
    }
    const clubIds = data.map((c) => c.club_id);
    const { data: clubs } = await this.supabaseService.getClubsFromIds(clubIds);
    this.golferClubs = data.map((gc) => {
      const match = (clubs || []).find((club) => club.id === gc.club_id);
      return {
        id: gc.id,
        number: match?.number ?? '?',
        category: match?.category ?? '',
      };
    });
  }

  private async loadPlayedHoleAndShots(): Promise<void> {
    const ph = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
    const existing = ph?.data ?? [];
    if (existing.length) {
      this.playedHoleId = existing[0].id;
      const data = await this.supabaseService.getShotsForPlayedHole(this.playedHoleId!);
      this.shots = data ?? [];
    }
  }

  getPenaltyStrokes(p: GolfShot['penalty']): number {
    switch (p) {
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

  penaltyDescription(): string {
    switch (this.penaltyType) {
      case 'stroke_only':
        return 'One penalty stroke (e.g. general breach where you don’t replay).';
      case 'stroke_and_distance':
        return 'Stroke and distance — replay from previous spot (+2 total to your score for this procedure).';
      case 'drop':
        return 'One penalty stroke, then drop within one club-length (or rule-appropriate relief).';
      case 'unplayable':
        return 'One penalty stroke for taking an unplayable lie.';
      default:
        return '';
    }
  }

  cancel(): void {
    this.router.navigate([`/golf-shot/${this.holeNumber}/newShot`], {
      state: {
        userId: this.userId,
        golfBagId: this.golfBagId,
        holeId: this.holeId,
        roundId: this.roundId,
      },
    });
  }

  async savePenalty(): Promise<void> {
    if (!this.golferClubs.length) {
      this.notificationService.showError('No clubs available.');
      return;
    }
    this.saving = true;
    try {
      const club = this.golferClubs[0];
      const penaltyStrokes = this.getPenaltyStrokes(this.penaltyType);
      const shot: GolfShot = {
        hole_id: '',
        club_id: club.id,
        club_name: `${club.number} ${club.category}`.trim(),
        distance: 0,
        shot_type: 'Penalty',
        lie: 'Fairway',
        result: 'Fairway',
        result_location: 'Fairway',
        landing_lateral: 'Center',
        result_direction: 'On line',
        stroke_number: 0,
        penalty: this.penaltyType,
        penalty_strokes: penaltyStrokes,
      };

      const ph = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
      let playedHoleId = ph?.data?.[0]?.id as string | undefined;

      if (!playedHoleId) {
        const initialStrokes = 1 + penaltyStrokes;
        const { data: created, error } = await this.supabaseService.createPlayedHole({
          round_id: this.roundId,
          hole_id: this.holeId,
          strokes: initialStrokes,
        });
        if (error || !created?.length) {
          this.notificationService.showError(this.notificationService.getErrorMessage(error) || 'Could not start hole.');
          return;
        }
        playedHoleId = created[0].id;
        this.shots = [];
      }

      const nextStroke = (this.shots?.length ?? 0) + 1;
      shot.hole_id = playedHoleId!;
      shot.stroke_number = nextStroke;

      const inserted = await this.supabaseService.addGolfShot(shot);
      if (!inserted) {
        this.notificationService.showError('Could not save penalty stroke.');
        return;
      }

      await this.loadPlayedHoleAndShots();
      const data = await this.supabaseService.getShotsForPlayedHole(playedHoleId!);
      this.shots = data ?? [];
      const totalStrokes = this.shots.reduce((sum, s) => sum + 1 + (s.penalty_strokes || 0), 0);
      await this.supabaseService.updatePlayedHoleStrokes(playedHoleId!, totalStrokes);

      this.notificationService.showSuccess('Penalty stroke recorded.');
      this.cancel();
    } catch (e) {
      this.notificationService.showError(this.notificationService.getErrorMessage(e));
    } finally {
      this.saving = false;
    }
  }
}
