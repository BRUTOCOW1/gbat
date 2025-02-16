import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { Router } from '@angular/router';
import { GolfBag } from '../models/golf-bag.model';

@Component({
  selector: 'app-golf-bag',
  templateUrl: './golf-bag.component.html',
  styleUrls: ['./golf-bag.component.css']
})
export class GolfBagComponent implements OnInit {
  golfBags: GolfBag[] = [];
  selectedBagId: string | null = null;
  clubsByBag: { [bagId: string]: any[] } = {};

  // Tracks whether each club is expanded
  clubExpanded: { [clubId: string]: boolean } = {};

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdRef: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const user = await this.supabaseService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    // Fetch the user's bags
    const { data: bags, error } = await this.supabaseService.getGolfBagsByUser(user.id);
    if (!error && bags) {
      this.golfBags = bags;
      // Initialize clubs array for each bag
      this.golfBags.forEach(bag => {
        this.clubsByBag[bag.golfbag_id] = [];
      });
    }
  }

  async selectBag(bagId: string, event?: Event) {
    if (event) event.stopPropagation();

    // Toggle selection
    this.selectedBagId = (this.selectedBagId === bagId) ? null : bagId;
    // If newly selected, load clubs
    if (this.selectedBagId) {
      await this.loadClubsForBag(this.selectedBagId);
    }
  }

  async loadClubsForBag(bagId: string) {
    const user = await this.supabaseService.getUser();
    if (!user) return;

    const { data, error } = await this.supabaseService.getClubsByBagId(bagId, user.id);
    if (!error && data) {
      const clubIds = data.map((c) => c.club_id);
      if (clubIds.length) {
        const { data: clubs, error: clubsErr } = await this.supabaseService.getClubsFromIds(clubIds);
        if (!clubsErr && clubs) {
          this.clubsByBag[bagId] = clubs;
        }
      } else {
        this.clubsByBag[bagId] = [];
      }
    }
    this.cdRef.detectChanges();
  }

  toggleClubDetails(clubId: string, event?: Event) {
    if (event) event.stopPropagation();
    this.clubExpanded[clubId] = !this.clubExpanded[clubId];
  }

  navigateToAddClubs(bagId: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/add-clubs'], { state: { bagId } });
  }

  navigateTocreateBag() {
    this.router.navigate(['/new-bag']);
  }
}
