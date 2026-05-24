import { Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { GolfShot } from '../../shared/models/golf-shot.model';
import { NotificationService } from '../../shared/services/notification.service';

const SHOT_CONTEXT_KEY = 'gbat-shot-context';

interface ShotNavContext {
  userId?: string;
  golfBagId?: string;
  holeId?: string;
  roundId?: string;
}

function mergeNavState(...sources: unknown[]): ShotNavContext {
  const out: ShotNavContext = {};
  for (const src of sources) {
    if (!src || typeof src !== 'object') {
      continue;
    }
    const o = src as Record<string, unknown>;
    const inner = o['state'];
    const pick = (inner && typeof inner === 'object' ? inner : o) as Record<string, unknown>;
    if (!out.userId && typeof pick['userId'] === 'string') {
      out.userId = pick['userId'];
    }
    if (!out.golfBagId && typeof pick['golfBagId'] === 'string') {
      out.golfBagId = pick['golfBagId'];
    }
    if (!out.holeId && typeof pick['holeId'] === 'string') {
      out.holeId = pick['holeId'];
    }
    if (!out.roundId && typeof pick['roundId'] === 'string') {
      out.roundId = pick['roundId'];
    }
  }
  return out;
}

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
    private location: Location,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    const hn = this.route.snapshot.paramMap.get('holeNumber');
    this.holeNumber = hn ? parseInt(hn, 10) : 1;

    const fromLocation = this.location.getState();
    const fromHistory = typeof history !== 'undefined' ? history.state : {};
    let stored: ShotNavContext = {};
    try {
      const raw = sessionStorage.getItem(SHOT_CONTEXT_KEY);
      if (raw) {
        stored = JSON.parse(raw) as ShotNavContext;
      }
    } catch {
      /* ignore */
    }

    const merged = mergeNavState(fromLocation, fromHistory, stored);
    this.userId = merged.userId ?? '';
    this.golfBagId = merged.golfBagId ?? '';
    this.holeId = merged.holeId ?? '';
    this.roundId = merged.roundId ?? '';

    if (!this.userId || !this.golfBagId || !this.holeId || !this.roundId) {
      this.notificationService.showWarning('Missing round context. Open this screen from the hole or add-shot page.');
      this.router.navigate(['/dashboard']);
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
