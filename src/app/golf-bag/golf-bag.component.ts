import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';
import { GolfBag } from '../models/golf-bag.model';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-golf-bag',
  templateUrl: './golf-bag.component.html',
  styleUrls: ['./golf-bag.component.css'],
})
export class GolfBagComponent implements OnInit {
  golfBagForm: FormGroup;
  golfBags: GolfBag[] = [];
  selectedBagId: string | null = null;
  clubsByBag: { [bagId: string]: any[] } = {};
  expandedClubs: { [bagId: string]: { [clubNumber: string]: boolean } } = {}; // Tracks expanded state per bag and club number
  loading = false;
  userId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private router: Router,
    private cdRef: ChangeDetectorRef
  ) {
    this.golfBagForm = this.fb.group({
      name: ['', Validators.required],
    });
  }

  async ngOnInit() {
    const user = await this.supabaseService.getCurrentUser();
    if (user) {
      this.userId = user.id;
      await this.loadGolfBags();
  
      // ✅ Redirect to create-golf-bag if no bags exist
      if (this.golfBags.length === 0) {
        this.router.navigate(['/new-bag']);
      }
    } else {
      console.warn('No user is authenticated.');
      this.router.navigate(['/login']);
    }
  }
  

  async loadGolfBags() {
    if (!this.userId) return;

    this.loading = true;
    try {
      const { data, error } = await this.supabaseService.getGolfBagsByUser(this.userId);
      if (!error && data) {
        this.golfBags = data;
        this.golfBags.forEach((bag) => {
          this.clubsByBag[bag.golfbag_id] = [];
          this.expandedClubs[bag.golfbag_id] = {}; // Initialize expansion tracking for each bag
        });
      } else {
        console.error('Error fetching golf bags:', error);
      }
      this.cdRef.detectChanges();
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      this.loading = false;
    }
  }

  async selectBag(bagId: string | undefined, event?: Event) {
    if (event) event.stopPropagation(); // Prevents accidental deselection
  
    if (!bagId) return;
  
    this.selectedBagId = this.selectedBagId === bagId ? null : bagId;
  
    if (this.selectedBagId) {
      await this.loadClubsForBag(bagId); // ✅ Load clubs when a bag is selected
    }
  
    this.cdRef.detectChanges();
  }
  
  /** Fetch all clubs in the selected bag */
  async loadClubsForBag(bagId: string) {
    console.log("sad")
    if (!this.userId) return;
  
    const { data, error } = await this.supabaseService.getClubsByBagId(bagId, this.userId);
  
    console.log(data);
    if (!error && data) {
      const clubIds = data.map((club) => club.club_id);
      
      if (clubIds.length > 0) {
        const { data: clubData, error } = await this.supabaseService.getClubsFromIds(clubIds);
        
        if (!error && clubData) {
          this.clubsByBag[bagId] = clubData; // ✅ Store clubs for this bag
        }
      }
    }
  }
  

  toggleClubDetails(bagId: string, clubNumber: string, event: Event) {
    event.stopPropagation(); // Prevents closing the bag when toggling a club
    this.expandedClubs[bagId][clubNumber] = !this.expandedClubs[bagId][clubNumber];
  }

  getClubsByType(bagId: string, type: string) {
    return this.clubsByBag[bagId]?.filter((club) => club.category === type) || [];
  }

  private groupClubsByNumber(clubs: any[]) {
    const groupedClubs: { [number: string]: any } = {};

    clubs.forEach((club) => {
      if (!groupedClubs[club.number]) {
        groupedClubs[club.number] = {
          number: club.number,
          category: club.category,
          clubs: [],
          stats: { hits: 0, avgDistance: 0 }, // Default stats
        };
      }
      groupedClubs[club.number].clubs.push({ maker: club.maker, set: club.set });
    });

    return Object.values(groupedClubs);
  }

  navigateToAddClubs(bagId: string, event: Event) {
    event.stopPropagation(); // Prevents bag deselection on click
    this.router.navigate(['/add-clubs'], { state: { bagId } });
  }
  
  navigateTocreateBag() {
    this.router.navigate(['/new-bag']);
  }
}
