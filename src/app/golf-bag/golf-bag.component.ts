import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../supabase.service';
import { GolfBag } from '../models/golf-bag.model'; // Import the GolfBag interface
import { User } from '../models/user.model';
import { Router } from '@angular/router';
@Component({
  selector: 'app-golf-bag',
  templateUrl: './golf-bag.component.html',
  styleUrls: ['./golf-bag.component.css'],
})
export class GolfBagComponent implements OnInit {
  golfBagForm: FormGroup;
  users: User[] = []; // List of users
  golfBags: GolfBag[] = []; // List of golf bags
  selectedBagId: string | null = null; // ID of the selected golf bag
  loading = false;
  userId: string | null = null;

  constructor(private fb: FormBuilder, private supabaseService: SupabaseService, private router: Router) {
    // Initialize the form group with validation rules
    this.golfBagForm = this.fb.group({
      name: ['', Validators.required],
      userId: ['', Validators.required],
    });
  }

  async ngOnInit() {
    // Fetch the authenticated user's ID
    const user = await this.supabaseService.getCurrentUser();
    if (user) {
      this.userId = user.id;
      this.loadGolfBags();
    } else {
      console.warn('No user is authenticated.');
    }
  }



  redirectToCreateBag() {
    this.router.navigate(['/new-bag']);
  }


  async loadGolfBags(): Promise<void> {
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
        console.log('Golf bags loaded successfully:', this.golfBags);
      }
    } catch (error) {
      console.error('Unexpected error fetching golf bags:', error);
    } finally {
      this.loading = false;
    }
  }


  selectBag(bagId: string): void {
    this.selectedBagId = bagId;
    console.log('Selected Golf Bag ID:', this.selectedBagId);
  }
  

  trackByUserId(index: number, user: User): number {
    return user.id; // Return the unique ID of the user
  }
  
  trackByBagId(index: string, bag: GolfBag): string {
    return bag.GolfBag_id; // Unique identifier for golf bags
  }
}

