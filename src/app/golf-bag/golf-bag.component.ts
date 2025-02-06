import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../supabase.service';
import { GolfBag } from '../models/golf-bag.model'; 
import { GolfClub } from '../models/golf-club.model';
import { User } from '../models/user.model';
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
  loading = false;
  userId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private router: Router,
    private cdRef: ChangeDetectorRef // ✅ Inject ChangeDetectorRef
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
    } else {
      console.warn('No user is authenticated.');
    }
  }

  async loadGolfBags() {
    if (!this.userId) {
      console.error('User ID is null. Cannot load golf bags.');
      return;
    }
  
    this.loading = true;
    try {
      const { data, error } = await this.supabaseService.getGolfBagsByUser(this.userId);
      if (error) {
        console.error('Error fetching golf bags:', error);
      } else {
        this.golfBags = data || [];
        console.log('Loaded golf bags:', this.golfBags);
  
        // ✅ Ensure `clubsByBag` is initialized for each bag
        this.golfBags.forEach(bag => {
          if (!this.clubsByBag[bag.golfbag_id]) {
            this.clubsByBag[bag.golfbag_id] = []; // ✅ Initialize to prevent errors
          }
        });
  
        // ✅ Force Angular to update the UI
        this.cdRef.detectChanges();
      }
    } catch (error) {
      console.error('Unexpected error fetching golf bags:', error);
    } finally {
      this.loading = false;
    }
  }
  
  async selectBag(bagId: string | undefined) {
    if (!bagId) {
      console.warn("Selected bag has no ID.");
      return;
    }
  
    this.selectedBagId = this.selectedBagId === bagId ? null : bagId; // Toggle selection

    const userId = this.userId ?? '';
    const { data, error } = await this.supabaseService.getClubsByBagId(bagId, userId);
    
    if (error) {
      console.error('Error fetching clubs:', error);
    } else {
      
      const clubIds = (data || []).map(club => club.club_id);
      
      if (clubIds.length > 0) {
        const { data: clubData, error } = await this.supabaseService.getClubsFromIds(clubIds);
        if (error) {
          console.error('Error fetching clubs by IDs:', error);
        } else {
          this.clubsByBag[bagId] = clubData || [];
        }
      } else {
        console.log(`No clubs found for bag ${bagId}.`);
      }
    }

    this.cdRef.detectChanges();
  }
  
  
  navigateToAddClubs(bagId: string | undefined) {
    if (!bagId) {
      console.error('Bag ID is undefined.');
      return;
    }
    this.router.navigate(['/golf-club-component'], { state: { bagId } });
  }

  redirectToCreateBag() {
    this.router.navigate(['/new-bag']);
  }
  trackByBagId(index: number, bag: GolfBag): string {
    return bag.golfbag_id;
  }
  getClubsByType(bagId: string, type: string) {
    console.log("pengus")
    return this.clubsByBag[bagId].filter(club => club.category === type);
  }
  
  
}
