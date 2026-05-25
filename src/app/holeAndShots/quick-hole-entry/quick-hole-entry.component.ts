import { Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../../shared/services/notification.service';
import {
  getRoundHoleRange,
  isHoleInRound,
} from '../../shared/round-holes.utils';
import {
  buildQuickStrokeDrafts,
  clampQuickStrokeCount,
  quickDraftToGolfShot,
  quickStrokeCountBounds,
  QuickGolferClub,
  QuickStrokeDraft,
} from '../hole-quick-entry.utils';

const SHOT_CONTEXT_KEY = 'gbat-shot-context';

interface ShotNavContext {
  userId?: string;
  golfBagId?: string;
  holeId?: string;
  roundId?: string;
}

interface GolferClubRow extends QuickGolferClub {}

@Component({
  selector: 'app-quick-hole-entry',
  templateUrl: './quick-hole-entry.component.html',
  styleUrls: ['./quick-hole-entry.component.css'],
})
export class QuickHoleEntryComponent implements OnInit {
  holeNumber = 1;
  userId = '';
  roundId = '';
  golfBagId = '';
  holeId = '';
  minHoleNumber = 1;
  maxHoleNumber = 18;

  golferClubs: GolferClubRow[] = [];
  strokeCount = 4;
  drafts: QuickStrokeDraft[] = [];
  existingShotCount = 0;
  saving = false;
  ready = false;

  readonly strokeBounds = quickStrokeCountBounds();

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
    this.hydrateNavContext();

    if (!this.userId || !this.golfBagId || !this.holeId || !this.roundId) {
      this.notificationService.showWarning('Missing round context. Start from your round.');
      this.router.navigate(['/dashboard']);
      return;
    }

    await this.loadRoundHoleLimit();

    if (!isHoleInRound(this.holeNumber, this.roundHoleScope)) {
      this.notificationService.showWarning(`Hole ${this.holeNumber} is not part of this round.`);
      this.router.navigate([`/golf-round/${this.roundId}`]);
      return;
    }

    await this.loadClubs();
    if (!this.golferClubs.length) {
      this.notificationService.showError('No clubs in this bag. Add clubs before logging a hole.');
      this.router.navigate(['/golf-bags']);
      return;
    }

    await this.checkExistingShots();
    this.rebuildDrafts();
    this.ready = true;
  }

  private roundHoleScope = {
    holesPlanned: null as number | null,
    holesStart: 1,
    courseHoleCount: 18,
  };

  onStrokeCountChange(): void {
    this.strokeCount = clampQuickStrokeCount(this.strokeCount);
    this.rebuildDrafts();
  }

  incrementStrokes(): void {
    if (this.strokeCount < this.strokeBounds.max) {
      this.strokeCount++;
      this.rebuildDrafts();
    }
  }

  decrementStrokes(): void {
    if (this.strokeCount > this.strokeBounds.min) {
      this.strokeCount--;
      this.rebuildDrafts();
    }
  }

  rebuildDrafts(): void {
    this.drafts = buildQuickStrokeDrafts(this.strokeCount, this.golferClubs);
  }

  selectedClubForDraft(draft: QuickStrokeDraft): GolferClubRow | undefined {
    return this.golferClubs.find((c) => c.id === draft.club_id);
  }

  selectClubForDraft(draft: QuickStrokeDraft, club: GolferClubRow): void {
    draft.club_id = club.id;
    draft.club_name = `${club.number} ${club.category}`.trim();
    requestAnimationFrame(() => {
      document
        .getElementById(`club-chip-${draft.stroke_number}-${club.id}`)
        ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }

  canPrevClub(draft: QuickStrokeDraft): boolean {
    const i = this.golferClubs.findIndex((c) => c.id === draft.club_id);
    return i > 0;
  }

  canNextClub(draft: QuickStrokeDraft): boolean {
    const i = this.golferClubs.findIndex((c) => c.id === draft.club_id);
    return i >= 0 && i < this.golferClubs.length - 1;
  }

  clubSliderPrev(draft: QuickStrokeDraft): void {
    const i = this.golferClubs.findIndex((c) => c.id === draft.club_id);
    if (i > 0) {
      this.selectClubForDraft(draft, this.golferClubs[i - 1]);
    }
  }

  clubSliderNext(draft: QuickStrokeDraft): void {
    const i = this.golferClubs.findIndex((c) => c.id === draft.club_id);
    if (i >= 0 && i < this.golferClubs.length - 1) {
      this.selectClubForDraft(draft, this.golferClubs[i + 1]);
    }
  }

  async saveHole(): Promise<void> {
    if (this.existingShotCount > 0) {
      this.notificationService.showWarning('This hole already has shots. Open the hole to edit or add more.');
      this.goToHoleView();
      return;
    }
    if (!this.drafts.length) {
      this.notificationService.showError('Add at least one shot.');
      return;
    }

    this.saving = true;
    try {
      const ph = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
      let playedHoleId = ph?.data?.[0]?.id as string | undefined;

      if (playedHoleId) {
        const existing = await this.supabaseService.getShotsForPlayedHole(playedHoleId);
        if (existing?.length) {
          this.existingShotCount = existing.length;
          this.notificationService.showWarning('This hole already has shots saved.');
          this.goToHoleView();
          return;
        }
      }

      if (!playedHoleId) {
        const { data: created, error } = await this.supabaseService.createPlayedHole({
          round_id: this.roundId,
          hole_id: this.holeId,
          strokes: this.drafts.length,
        });
        if (error || !created?.length) {
          const errorMsg = this.notificationService.getErrorMessage(error);
          this.notificationService.showError(errorMsg || 'Unable to start this hole.');
          return;
        }
        playedHoleId = created[0].id;
      }

      for (const draft of this.drafts) {
        const shot = quickDraftToGolfShot(draft, playedHoleId!);
        const inserted = await this.supabaseService.addGolfShot(shot);
        if (!inserted) {
          this.notificationService.showError(`Could not save shot ${draft.stroke_number}.`);
          return;
        }
      }

      await this.supabaseService.updatePlayedHoleStrokes(playedHoleId!, this.drafts.length);

      this.notificationService.showSuccess(`Hole ${this.holeNumber} saved!`);
      await this.advanceAfterHoleComplete();
    } catch (err) {
      const errorMsg = this.notificationService.getErrorMessage(err);
      this.notificationService.showError(errorMsg);
      console.error('Quick hole save failed:', err);
    } finally {
      this.saving = false;
    }
  }

  private async advanceAfterHoleComplete(): Promise<void> {
    const nextHole = this.holeNumber + 1;
    if (nextHole > this.maxHoleNumber) {
      this.notificationService.showSuccess('Round complete! Great round!');
      this.router.navigate([`/round-summary/${this.roundId}`]);
      return;
    }

    let nextHoleId: string | undefined;
    try {
      const roundRes = await this.supabaseService.getGolfRoundById(this.roundId);
      const courseId = roundRes.data?.[0]?.course_id as string | undefined;
      if (courseId) {
        const holeResp = await this.supabaseService.getGolfHoleDetails(courseId, nextHole);
        nextHoleId = holeResp.data?.[0]?.id;
      }
    } catch {
      /* navigate anyway; quick entry will resolve holeId */
    }

    this.router.navigate([`/golf-hole/${nextHole}/quick`], {
      state: {
        roundId: this.roundId,
        userId: this.userId,
        golfBagId: this.golfBagId,
        holeId: nextHoleId,
      },
    });
  }

  goToHoleView(): void {
    this.persistShotNavContext();
    this.router.navigate([`/golf-hole/${this.holeNumber}`], {
      state: { roundId: this.roundId, userId: this.userId, golfBagId: this.golfBagId },
    });
  }

  cancel(): void {
    this.router.navigate([`/golf-round/${this.roundId}`]);
  }

  private async checkExistingShots(): Promise<void> {
    const ph = await this.supabaseService.getPlayedHole(this.roundId, this.holeId);
    const playedHoleId = ph?.data?.[0]?.id as string | undefined;
    if (!playedHoleId) {
      this.existingShotCount = 0;
      return;
    }
    const shots = await this.supabaseService.getShotsForPlayedHole(playedHoleId);
    this.existingShotCount = shots?.length ?? 0;
  }

  private async loadRoundHoleLimit(): Promise<void> {
    try {
      const roundRes = await this.supabaseService.getGolfRoundById(this.roundId);
      const round = roundRes.data?.[0];
      if (!round) {
        return;
      }
      const courseId = round.course_id as string | undefined;
      let courseHoleCount = 18;
      if (courseId) {
        const holes = await this.supabaseService.getGolfHolesByCourseId(courseId);
        if (holes.length > 0) {
          courseHoleCount = holes.length;
        }
      }
      this.roundHoleScope = {
        holesPlanned: (round.holes_planned as number | null | undefined) ?? null,
        holesStart: (round.holes_start as number | undefined) ?? 1,
        courseHoleCount,
      };
      const range = getRoundHoleRange(this.roundHoleScope);
      this.minHoleNumber = range.start;
      this.maxHoleNumber = range.end;

      if (!this.holeId && courseId) {
        const holeResp = await this.supabaseService.getGolfHoleDetails(courseId, this.holeNumber);
        const hole = holeResp.data?.[0];
        if (hole?.id) {
          this.holeId = hole.id;
        }
      }
    } catch {
      /* keep defaults */
    }
  }

  private async loadClubs(): Promise<void> {
    const { data, error } = await this.supabaseService.getClubsByBagId(this.golfBagId, this.userId);
    if (error || !data?.length) {
      return;
    }
    const clubIds = data.map((c) => c.club_id);
    const { data: clubs, error: clubsErr } = await this.supabaseService.getClubsFromIds(clubIds);
    if (clubsErr) {
      return;
    }
    this.golferClubs = this.sortGolferClubsForDisplay(
      data.map((gc) => {
        const match = (clubs || []).find((club) => club.id === gc.club_id);
        return match
          ? {
              id: gc.id,
              club_id: gc.club_id,
              number: match.number,
              category: match.category,
            }
          : {
              id: gc.id,
              club_id: gc.club_id,
              number: 'Unknown',
              category: 'Unknown',
            };
      })
    );
  }

  private sortGolferClubsForDisplay(clubs: GolferClubRow[]): GolferClubRow[] {
    return [...clubs].sort((a, b) => {
      const [ta, sa] = this.clubBagSortComponents(a);
      const [tb, sb] = this.clubBagSortComponents(b);
      if (ta !== tb) {
        return ta - tb;
      }
      if (sa !== sb) {
        return sa - sb;
      }
      const n = (a.number || '').localeCompare(b.number || '', undefined, { numeric: true });
      if (n !== 0) {
        return n;
      }
      return (a.category || '').localeCompare(b.category || '');
    });
  }

  private clubBagSortComponents(c: GolferClubRow): [number, number] {
    const cat = (c.category || '').toLowerCase();
    const numRaw = (c.number || '').trim();
    const num = numRaw.toLowerCase().replace(/\s+/g, '');

    if (cat.includes('putter') || num.includes('putter')) {
      return [80, 0];
    }
    if (cat.includes('driver') || num.includes('driver')) {
      return [0, 0];
    }
    if (cat.includes('wood') || cat.includes('fairway')) {
      const n = parseInt(numRaw.replace(/[^0-9]/g, ''), 10);
      return [5, Number.isNaN(n) ? 99 : n];
    }
    if (cat.includes('hybrid')) {
      const n = parseInt(numRaw.replace(/[^0-9]/g, ''), 10);
      return [10, Number.isNaN(n) ? 99 : n];
    }
    if (cat.includes('iron')) {
      const n = parseInt(numRaw.replace(/[^0-9]/g, ''), 10);
      return [20, Number.isNaN(n) ? 99 : n];
    }
    if (cat.includes('wedge') || cat.includes('pitching') || cat.includes('gap') || cat.includes('sand') || cat.includes('lob')) {
      return [40, parseInt(num.replace(/\D/g, ''), 10) || 99];
    }
    return [70, 0];
  }

  private hydrateNavContext(): void {
    try {
      const raw = sessionStorage.getItem(SHOT_CONTEXT_KEY);
      if (raw) {
        const c = JSON.parse(raw) as ShotNavContext;
        if (!this.userId && c.userId) {
          this.userId = c.userId;
        }
        if (!this.golfBagId && c.golfBagId) {
          this.golfBagId = c.golfBagId;
        }
        if (!this.holeId && c.holeId) {
          this.holeId = c.holeId;
        }
        if (!this.roundId && c.roundId) {
          this.roundId = c.roundId;
        }
      }
    } catch {
      /* ignore */
    }
    const pick = (o: Record<string, unknown>): Record<string, unknown> => {
      if (!o || typeof o !== 'object') {
        return {};
      }
      const inner = o['state'];
      return (inner && typeof inner === 'object' ? inner : o) as Record<string, unknown>;
    };
    for (const src of [
      pick(this.location.getState() as Record<string, unknown>),
      pick(window.history.state as Record<string, unknown>),
    ]) {
      if (!this.userId && typeof src['userId'] === 'string') {
        this.userId = src['userId'];
      }
      if (!this.golfBagId && typeof src['golfBagId'] === 'string') {
        this.golfBagId = src['golfBagId'];
      }
      if (!this.holeId && typeof src['holeId'] === 'string') {
        this.holeId = src['holeId'];
      }
      if (!this.roundId && typeof src['roundId'] === 'string') {
        this.roundId = src['roundId'];
      }
    }
    this.persistShotNavContext();
  }

  private persistShotNavContext(): void {
    if (!this.userId || !this.golfBagId || !this.roundId) {
      return;
    }
    try {
      sessionStorage.setItem(
        SHOT_CONTEXT_KEY,
        JSON.stringify({
          userId: this.userId,
          golfBagId: this.golfBagId,
          holeId: this.holeId,
          roundId: this.roundId,
        })
      );
    } catch {
      /* ignore */
    }
  }
}
