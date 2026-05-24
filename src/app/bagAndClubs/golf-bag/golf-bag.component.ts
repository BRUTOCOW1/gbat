import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService, GolferClubUsageStats } from '../../services/supabase.service';
import { GolfBag } from '../../shared/models/golf-bag.model';
import { GolfClub } from '../../shared/models/golf-club.model';
import { NotificationService } from '../../shared/services/notification.service';
import {
  CatalogTier,
  catalogTierForClub,
  catalogTierLabel,
} from '../../shared/golf-club-tier';

/** Catalog row plus the bag membership row id (FK used by `golf_shot.club_id`). */
export interface BagClubRow extends GolfClub {
  golferClubId: string;
}

@Component({
  selector: 'app-golf-bag',
  templateUrl: './golf-bag.component.html',
  styleUrls: ['./golf-bag.component.css'],
})
export class GolfBagComponent implements OnInit {
  golfBags: GolfBag[] = [];
  selectedBagId: string | null = null;
  clubsByBag: { [bagId: string]: BagClubRow[] } = {};

  clubExpanded: { [golferClubId: string]: boolean } = {};
  clubStats: { [golferClubId: string]: GolferClubUsageStats | undefined } = {};
  statsLoading: { [golferClubId: string]: boolean } = {};

  pageLoading = true;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private route: ActivatedRoute,
    private cdRef: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {}

  async ngOnInit() {
    const user = await this.supabaseService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    const { data: bags, error } = await this.supabaseService.getGolfBagsByUser(user.id);
    this.pageLoading = false;

    if (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading golf bags: ${errorMsg}`);
      return;
    }
    if (bags) {
      this.golfBags = bags;
      this.golfBags.forEach((bag) => {
        this.clubsByBag[bag.golfbag_id] = [];
      });
      if (this.golfBags.length === 0) {
        this.notificationService.showInfo('No golf bags found. Create one to get started!');
      } else {
        const paramId = this.route.snapshot.paramMap.get('id');
        if (paramId && this.golfBags.some((b) => b.golfbag_id === paramId)) {
          this.selectedBagId = paramId;
          await this.loadClubsForBag(paramId);
        }
      }
    }
    this.cdRef.detectChanges();
  }

  async selectBag(bagId: string, event?: Event) {
    if (event) event.stopPropagation();

    this.selectedBagId = this.selectedBagId === bagId ? null : bagId;
    if (this.selectedBagId) {
      await this.loadClubsForBag(this.selectedBagId);
    }
  }

  async loadClubsForBag(bagId: string) {
    const user = await this.supabaseService.getUser();
    if (!user) {
      this.notificationService.showError('You must be logged in to view clubs.');
      return;
    }

    const { data, error } = await this.supabaseService.getClubsByBagId(bagId, user.id);
    if (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading clubs: ${errorMsg}`);
      return;
    }
    if (!data?.length) {
      this.clubsByBag[bagId] = [];
      this.notificationService.showInfo('This bag has no clubs. Add some clubs to get started!');
      this.cdRef.detectChanges();
      return;
    }

    const clubIds = data.map((c) => c.club_id);
    const { data: clubs, error: clubsErr } = await this.supabaseService.getClubsFromIds(clubIds);
    if (clubsErr) {
      const errorMsg = this.notificationService.getErrorMessage(clubsErr);
      this.notificationService.showError(`Error loading club details: ${errorMsg}`);
      return;
    }
    const byCatalogId = new Map((clubs || []).map((c) => [c.id, c]));
    this.clubsByBag[bagId] = data
      .map((gc) => {
        const row = byCatalogId.get(gc.club_id);
        if (!row) return null;
        return { ...row, golferClubId: gc.id } as BagClubRow;
      })
      .filter((x): x is BagClubRow => x != null);

    this.cdRef.detectChanges();
  }

  async toggleClubDetails(row: BagClubRow, event?: Event) {
    if (event) event.stopPropagation();
    const id = row.golferClubId;
    const next = !this.clubExpanded[id];
    this.clubExpanded[id] = next;

    if (next && this.clubStats[id] === undefined && !this.statsLoading[id]) {
      this.statsLoading[id] = true;
      this.cdRef.detectChanges();
      const stats = await this.supabaseService.getGolferClubUsageStats(id);
      this.clubStats[id] = stats;
      this.statsLoading[id] = false;
      this.cdRef.detectChanges();
    }
  }

  formatLastUsed(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  navigateToAddClubs(bagId: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/add-clubs'], { state: { bagId } });
  }

  navigateTocreateBag() {
    this.router.navigate(['/new-bag']);
  }

  navigateToAddClub() {
    this.router.navigate(['/add-club']);
  }

  tierOf(club: GolfClub): CatalogTier {
    return catalogTierForClub(club);
  }

  labelForTier(tier: CatalogTier): string {
    return catalogTierLabel(tier);
  }

  tierBadgeClass(club: GolfClub): string {
    return 'tier-badge tier-' + this.tierOf(club);
  }
}
