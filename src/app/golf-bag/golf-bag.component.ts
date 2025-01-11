import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../supabase.service';
import { GolfBag } from '../models/golf-bag.model'; // Import the GolfBag interface

@Component({
  selector: 'app-golf-bag',
  templateUrl: './golf-bag.component.html',
  styleUrls: ['./golf-bag.component.css'],
})
export class GolfBagComponent implements OnInit {
  golfBagForm: FormGroup;
  users: any[] = []; // List of users
  golfBags: GolfBag[] = []; // List of golf bags
  selectedBagId: string | null = null; // ID of the selected golf bag
  loading = false;

  constructor(private fb: FormBuilder, private supabaseService: SupabaseService) {
    this.golfBagForm = this.fb.group({
      name: ['', Validators.required],
      userId: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.loadUsers();
    this.loadGolfBags();
  }

  async loadUsers() {
    this.loading = true;
    try {
      const { data, error } = await this.supabaseService.getUsers();
      if (error) {
        console.error('Error fetching users:', error);
      } else {
        this.users = data || [];
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      this.loading = false;
    }
  }

  async loadGolfBags() {
    this.loading = true;
    try {
      const { data, error } = await this.supabaseService.getGolfBags();
      if (error) {
        console.error('Error fetching golf bags:', error);
      } else {
        this.golfBags = data || [];
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      this.loading = false;
    }
  }

  async onSubmit() {
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
        } else {
          console.warn('No data returned from Supabase for the created golf bag.');
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      }
    }
  }
  selectBag(event: Event) {
    const target = event.target as HTMLSelectElement;
    const bagId = target?.value;
  
    if (bagId) {
      this.selectedBagId = bagId;
      console.log('Selected Bag ID:', this.selectedBagId);
    } else {
      console.warn('No bag selected.');
    }
  }
  
}
