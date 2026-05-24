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

export interface ClubCategoryGroup {
  category: string;
  clubs: BagClubRow[];
}

type PanelMode = 'add' | 'swap';

const CATEGORY_ORDER = ['DRIVER', 'FAIRWAY WOOD', 'HYBRID', 'IRON', 'WEDGE', 'PUTTER'];

@Component({
  selector: 'app-golf-bag',
  templateUrl: './golf-bag.component.html',
  styleUrls: ['./golf-bag.component.css'],
})
export class GolfBagComponent implements OnInit {
  golfBags: GolfBag[] = [];
  selectedBagId: string | null = null;
  clubsByBag: { [bagId: string]: BagClubRow[] } = {};

  clubStats: { [golferClubId: string]: GolferClubUsageStats | undefined } = {};
  statsLoading = false;
  clubsLoading = false;
  pageLoading = true;
  bagDeleting = false;
  removingClubId: string | null = null;

  /** Inline catalog panel for add / swap */
  panelOpen = false;
  panelMode: PanelMode = 'add';
  swapTarget: BagClubRow | null = null;
  catalogClubs: GolfClub[] = [];
  catalogSearch = '';
  catalogCategoryFilter = '';
  catalogTierFilter: '' | CatalogTier = '';
  selectedCatalogIds = new Set<string>();
  catalogLoading = false;
  panelSaving = false;

  expandedClubId: string | null = null;

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
      this.notificationService.showError(
        `Error loading golf bags: ${this.notificationService.getErrorMessage(error)}`
      );
      return;
    }

    if (!bags?.length) {
      this.notificationService.showInfo('No golf bags found. Create one to get started!');
      this.cdRef.detectChanges();
      return;
    }

    this.golfBags = bags;
    for (const bag of this.golfBags) {
      this.clubsByBag[bag.golfbag_id] = [];
    }

    const paramId = this.route.snapshot.paramMap.get('id');
    const initialId =
      paramId && this.golfBags.some((b) => b.golfbag_id === paramId)
        ? paramId
        : this.golfBags[0].golfbag_id;

    await this.selectBag(initialId, false);
    this.cdRef.detectChanges();
  }

  get selectedBag(): GolfBag | undefined {
    return this.golfBags.find((b) => b.golfbag_id === this.selectedBagId);
  }

  get selectedClubs(): BagClubRow[] {
    return this.selectedBagId ? this.clubsByBag[this.selectedBagId] || [] : [];
  }

  get groupedClubs(): ClubCategoryGroup[] {
    return this.groupClubsByCategory(this.selectedClubs);
  }

  get filteredCatalog(): GolfClub[] {
    const inBag = new Set(this.selectedClubs.map((c) => c.id));
    let list = this.catalogClubs.filter((c) => !inBag.has(c.id));

    if (this.panelMode === 'swap' && this.swapTarget) {
      list = list.filter((c) => c.id !== this.swapTarget!.id);
    }

    if (this.catalogCategoryFilter) {
      const cat = this.catalogCategoryFilter.toUpperCase();
      list = list.filter((c) => (c.category || '').toUpperCase() === cat);
    }

    if (this.catalogTierFilter) {
      list = list.filter((c) => catalogTierForClub(c) === this.catalogTierFilter);
    }

    if (this.catalogSearch.trim()) {
      const q = this.catalogSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.maker?.toLowerCase().includes(q) ||
          c.set?.toLowerCase().includes(q) ||
          c.number?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q)
      );
    }

    return list;
  }

  clubCountForBag(bagId: string): number {
    return this.clubsByBag[bagId]?.length ?? 0;
  }

  async selectBag(bagId: string, updateUrl = true) {
    if (this.selectedBagId === bagId && this.selectedClubs.length > 0) return;

    this.selectedBagId = bagId;
    this.expandedClubId = null;
    this.closePanel();

    if (updateUrl) {
      this.router.navigate(['/golf-bag', bagId], { replaceUrl: true });
    }

    await this.loadClubsForBag(bagId);
  }

  async loadClubsForBag(bagId: string) {
    const user = await this.supabaseService.getUser();
    if (!user) return;

    this.clubsLoading = true;
    this.cdRef.detectChanges();

    const { data, error } = await this.supabaseService.getClubsByBagId(bagId, user.id);
    if (error) {
      this.clubsLoading = false;
      this.notificationService.showError(
        `Error loading clubs: ${this.notificationService.getErrorMessage(error)}`
      );
      this.cdRef.detectChanges();
      return;
    }

    if (!data?.length) {
      this.clubsByBag[bagId] = [];
      this.clubsLoading = false;
      this.cdRef.detectChanges();
      return;
    }

    const clubIds = data.map((c) => c.club_id);
    const { data: clubs, error: clubsErr } = await this.supabaseService.getClubsFromIds(clubIds);
    if (clubsErr) {
      this.clubsLoading = false;
      this.notificationService.showError(
        `Error loading club details: ${this.notificationService.getErrorMessage(clubsErr)}`
      );
      this.cdRef.detectChanges();
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

    this.clubsLoading = false;
    await this.loadStatsForBag(this.clubsByBag[bagId]);
    this.cdRef.detectChanges();
  }

  async loadStatsForBag(clubs: BagClubRow[]) {
    if (!clubs.length) return;

    this.statsLoading = true;
    this.cdRef.detectChanges();

    const results = await Promise.all(
      clubs.map(async (c) => ({
        id: c.golferClubId,
        stats: await this.supabaseService.getGolferClubUsageStats(c.golferClubId),
      }))
    );

    for (const { id, stats } of results) {
      this.clubStats[id] = stats;
    }

    this.statsLoading = false;
    this.cdRef.detectChanges();
  }

  toggleClubExpand(golferClubId: string, event?: Event) {
    event?.stopPropagation();
    this.expandedClubId = this.expandedClubId === golferClubId ? null : golferClubId;
  }

  async openAddPanel() {
    this.panelMode = 'add';
    this.swapTarget = null;
    this.selectedCatalogIds.clear();
    this.catalogSearch = '';
    this.catalogCategoryFilter = '';
    this.catalogTierFilter = '';
    this.panelOpen = true;
    await this.ensureCatalogLoaded();
  }

  async openSwapPanel(club: BagClubRow, event?: Event) {
    event?.stopPropagation();
    this.panelMode = 'swap';
    this.swapTarget = club;
    this.selectedCatalogIds.clear();
    this.catalogSearch = '';
    this.catalogCategoryFilter = (club.category || '').toUpperCase();
    this.catalogTierFilter = '';
    this.panelOpen = true;
    await this.ensureCatalogLoaded();
  }

  closePanel() {
    this.panelOpen = false;
    this.swapTarget = null;
    this.selectedCatalogIds.clear();
    this.panelSaving = false;
  }

  async ensureCatalogLoaded() {
    if (this.catalogClubs.length) return;

    this.catalogLoading = true;
    this.cdRef.detectChanges();

    const { data, error } = await this.supabaseService.getAllClubs();
    this.catalogLoading = false;

    if (error) {
      this.notificationService.showError(
        `Error loading catalog: ${this.notificationService.getErrorMessage(error)}`
      );
      return;
    }

    this.catalogClubs = data || [];
    this.cdRef.detectChanges();
  }

  toggleCatalogSelection(clubId: string) {
    if (this.panelMode === 'swap') {
      this.selectedCatalogIds.clear();
      this.selectedCatalogIds.add(clubId);
      return;
    }

    if (this.selectedCatalogIds.has(clubId)) {
      this.selectedCatalogIds.delete(clubId);
    } else {
      this.selectedCatalogIds.add(clubId);
    }
  }

  async confirmPanelAction() {
    if (this.panelMode === 'swap') {
      await this.executeSwap();
    } else {
      await this.executeAdd();
    }
  }

  async executeAdd() {
    if (!this.selectedBagId || this.selectedCatalogIds.size === 0) return;

    const user = await this.supabaseService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.panelSaving = true;
    this.cdRef.detectChanges();

    let added = 0;
    let failed = 0;

    for (const clubId of this.selectedCatalogIds) {
      const { error } = await this.supabaseService.createGolferClub({
        golfer_id: user.id,
        club_id: clubId,
        cur_bag_id: this.selectedBagId,
      });
      if (error) failed++;
      else added++;
    }

    this.panelSaving = false;

    if (added > 0) {
      this.notificationService.showSuccess(
        added === 1 ? 'Club added to bag.' : `${added} clubs added to bag.`
      );
      this.closePanel();
      await this.loadClubsForBag(this.selectedBagId);
    } else {
      this.notificationService.showError('Could not add clubs. They may already be in this bag.');
    }

    if (failed > 0 && added > 0) {
      this.notificationService.showWarning(`${failed} club(s) could not be added.`);
    }

    this.cdRef.detectChanges();
  }

  async executeSwap() {
    if (!this.selectedBagId || !this.swapTarget || this.selectedCatalogIds.size !== 1) return;

    const newClubId = [...this.selectedCatalogIds][0];
    const user = await this.supabaseService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.panelSaving = true;
    this.cdRef.detectChanges();

    const { error: delErr } = await this.supabaseService.removeGolferClub(this.swapTarget.golferClubId);
    if (delErr) {
      this.panelSaving = false;
      this.notificationService.showError(
        `Could not remove old club: ${this.notificationService.getErrorMessage(delErr)}`
      );
      this.cdRef.detectChanges();
      return;
    }

    const { error: addErr } = await this.supabaseService.createGolferClub({
      golfer_id: user.id,
      club_id: newClubId,
      cur_bag_id: this.selectedBagId,
    });

    this.panelSaving = false;

    if (addErr) {
      this.notificationService.showError(
        `Could not add replacement club: ${this.notificationService.getErrorMessage(addErr)}`
      );
      await this.loadClubsForBag(this.selectedBagId);
      this.cdRef.detectChanges();
      return;
    }

    delete this.clubStats[this.swapTarget.golferClubId];
    this.notificationService.showSuccess('Club swapped.');
    this.closePanel();
    await this.loadClubsForBag(this.selectedBagId);
    this.cdRef.detectChanges();
  }

  async removeClub(club: BagClubRow, event?: Event) {
    event?.stopPropagation();
    if (this.removingClubId) return;

    const label = [club.maker, club.number].filter(Boolean).join(' ') || 'this club';
    const hasShots = (this.clubStats[club.golferClubId]?.totalShots ?? 0) > 0;
    const message = hasShots
      ? `Remove ${label} from this bag? Past round data for this club will be kept, but it won't appear in this bag anymore.`
      : `Remove ${label} from this bag?`;

    if (!confirm(message)) return;

    const user = await this.supabaseService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.removingClubId = club.golferClubId;
    this.cdRef.detectChanges();

    const { error } = await this.supabaseService.removeGolferClubFromBag(
      club.golferClubId,
      user.id
    );
    this.removingClubId = null;

    if (error) {
      const msg = this.notificationService.getErrorMessage(error).toLowerCase();
      if (msg.includes('foreign key') || msg.includes('violates') || msg.includes('23503')) {
        this.notificationService.showError(
          'This club has logged shots and cannot be removed. Use Swap to replace it with a different club.'
        );
      } else {
        this.notificationService.showError(
          `Could not remove club: ${this.notificationService.getErrorMessage(error)}`
        );
      }
      this.cdRef.detectChanges();
      return;
    }

    delete this.clubStats[club.golferClubId];
    if (this.expandedClubId === club.golferClubId) {
      this.expandedClubId = null;
    }
    if (this.selectedBagId) {
      await this.loadClubsForBag(this.selectedBagId);
    }
    this.notificationService.showSuccess(`${label} removed from bag.`);
    this.cdRef.detectChanges();
  }

  isRemovingClub(golferClubId: string): boolean {
    return this.removingClubId === golferClubId;
  }

  async deleteBag() {
    const bag = this.selectedBag;
    if (!bag || this.bagDeleting) return;

    const clubCount = this.selectedClubs.length;
    const message =
      clubCount > 0
        ? `Delete "${bag.name}" and remove all ${clubCount} club(s) from it? This cannot be undone.`
        : `Delete "${bag.name}"? This cannot be undone.`;
    if (!confirm(message)) return;

    const user = await this.supabaseService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.bagDeleting = true;
    this.cdRef.detectChanges();

    const { error } = await this.supabaseService.deleteGolfBag(bag.golfbag_id, user.id);
    this.bagDeleting = false;

    if (error) {
      this.notificationService.showError(
        `Could not delete bag: ${this.notificationService.getErrorMessage(error)}`
      );
      this.cdRef.detectChanges();
      return;
    }

    for (const club of this.clubsByBag[bag.golfbag_id] || []) {
      delete this.clubStats[club.golferClubId];
    }
    delete this.clubsByBag[bag.golfbag_id];
    this.golfBags = this.golfBags.filter((b) => b.golfbag_id !== bag.golfbag_id);
    this.closePanel();

    if (this.golfBags.length === 0) {
      this.selectedBagId = null;
      this.router.navigate(['/golf-bags'], { replaceUrl: true });
    } else {
      await this.selectBag(this.golfBags[0].golfbag_id);
    }

    this.notificationService.showSuccess(`"${bag.name}" deleted.`);
    this.cdRef.detectChanges();
  }

  formatLastUsed(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatShortDate(iso: string | null): string {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  navigateTocreateBag() {
    this.router.navigate(['/new-bag']);
  }

  navigateToAddClub(bagId?: string) {
    const queryParams = bagId ? { bagId } : undefined;
    this.router.navigate(['/add-club'], { queryParams });
  }

  navigateToAddClubFromPanel() {
    const bagId = this.selectedBagId ?? undefined;
    this.closePanel();
    this.navigateToAddClub(bagId);
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

  categoryLabel(category: string): string {
    return category.charAt(0) + category.slice(1).toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  }

  private groupClubsByCategory(clubs: BagClubRow[]): ClubCategoryGroup[] {
    const sorted = this.sortClubs(clubs);
    const groups: ClubCategoryGroup[] = [];

    for (const club of sorted) {
      const cat = (club.category || 'Other').toUpperCase();
      const last = groups[groups.length - 1];
      if (!last || last.category !== cat) {
        groups.push({ category: cat, clubs: [club] });
      } else {
        last.clubs.push(club);
      }
    }

    return groups;
  }

  private sortClubs(clubs: BagClubRow[]): BagClubRow[] {
    return [...clubs].sort((a, b) => {
      const ca = (a.category || '').toUpperCase();
      const cb = (b.category || '').toUpperCase();
      const oa = CATEGORY_ORDER.indexOf(ca);
      const ob = CATEGORY_ORDER.indexOf(cb);
      const ia = oa >= 0 ? oa : 99;
      const ib = ob >= 0 ? ob : 99;
      if (ia !== ib) return ia - ib;

      const loftA = parseFloat(a.loft) || 0;
      const loftB = parseFloat(b.loft) || 0;
      if (ca === 'DRIVER' || ca === 'FAIRWAY WOOD') return loftB - loftA;
      return loftA - loftB;
    });
  }
}
