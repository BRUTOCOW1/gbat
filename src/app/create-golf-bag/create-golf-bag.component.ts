import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../supabase.service';
import { GolfBag } from '../models/golf-bag.model'; // Import the GolfBag interface
import { User } from '../models/user.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-create-golf-bag',
  templateUrl: './create-golf-bag.component.html',
  styleUrl: './create-golf-bag.component.css'
})
export class CreateGolfBagComponent implements OnInit {
  golfBagForm: FormGroup;
  users: User[] = []; // List of users
  golfBags: GolfBag[] = []; // List of golf bags
  selectedBagId: string | null = null; // ID of the selected golf bag
  loading = false;

  constructor(private fb: FormBuilder, private supabaseService: SupabaseService) {
    // Initialize the form group with validation rules
    this.golfBagForm = this.fb.group({
      name: ['', Validators.required],
      userId: ['', Validators.required],
    });
  }


  ngOnInit(): void {
    this.loadUsers();
    this.loadGolfBags();
  }

  async loadUsers(): Promise<void> {
    this.loading = true;
    const users = await this.supabaseService.getUsers();
    if (users) {
      this.users = users; // Assign fetched users
    } else {
      console.warn('No users found.');
    }

  }

  async loadGolfBags(): Promise<void> {
    this.loading = true;
    try {
      const { data, error } = await this.supabaseService.getGolfBags();
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

  async onSubmit(): Promise<void> {
    if (this.golfBagForm.valid) {
      const { name, userId } = this.golfBagForm.value;
      try {
        const { data, error } = await this.supabaseService.createGolfBag({
          name,
          user_id: userId,
        });
        if (error) {
          console.error('Error creating golf bag:', error);
        } else if (data && data.length > 0) {
          alert('Golf Bag created successfully!');
          this.golfBags.push(data[0]); // Add the new bag to the list
          this.golfBagForm.reset(); // Reset the form after successful submission
        } else {
          console.warn('No data returned from Supabase for the created golf bag.');
        }
      } catch (error) {
        console.error('Unexpected error while creating golf bag:', error);
      }
    }
  }
  selectBag(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const bagId = target?.value;

    if (bagId) {
      this.selectedBagId = bagId;
      console.log('Selected Bag ID:', this.selectedBagId);
    } else {
      console.warn('No bag selected.');
    }
  }
  trackByUserId(index: number, user: User): number {
    return user.id; // Return the unique ID of the user
  }
  
  trackByBagId(index: string, bag: GolfBag): string {
    return bag.GolfBag_id; // Unique identifier for golf bags
  }

}
