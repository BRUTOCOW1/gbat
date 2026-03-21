import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { Router } from '@angular/router';
import { GolfBag } from '../../shared/models/golf-bag.model';
import { NotificationService } from '../../shared/services/notification.service';

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
    private cdRef: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {}

  async ngOnInit() {
    const user = await this.supabaseService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    // Fetch the user's bags
    const { data: bags, error } = await this.supabaseService.getGolfBagsByUser(user.id);
    if (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading golf bags: ${errorMsg}`);
      return;
    }
    if (bags) {
      this.golfBags = bags;
      // Initialize clubs array for each bag
      this.golfBags.forEach(bag => {
        this.clubsByBag[bag.golfbag_id] = [];
      });
      if (this.golfBags.length === 0) {
        this.notificationService.showInfo('No golf bags found. Create one to get started!');
      }
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
    if (data) {
      const clubIds = data.map((c) => c.club_id);
      if (clubIds.length) {
        const { data: clubs, error: clubsErr } = await this.supabaseService.getClubsFromIds(clubIds);
        if (clubsErr) {
          const errorMsg = this.notificationService.getErrorMessage(clubsErr);
          this.notificationService.showError(`Error loading club details: ${errorMsg}`);
          return;
        }
        if (clubs) {
          this.clubsByBag[bagId] = clubs;
        }
      } else {
        this.clubsByBag[bagId] = [];
        this.notificationService.showInfo('This bag has no clubs. Add some clubs to get started!');
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
  
  navigateToAddClub() {
    this.router.navigate(['/add-club']);
  }
}
