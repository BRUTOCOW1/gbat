import { Router } from '@angular/router';

import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  profile: any = null; // Store the current user's profile
  user: any = null; // Store the current authenticated user
  isLoading = false;

  constructor(private supabaseService: SupabaseService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    this.user = await this.supabaseService.getCurrentUser();
    if (this.user) {
      await this.loadProfile();
    }
  }

  async loadProfile(): Promise<void> {
    this.isLoading = true;
    try {
      const profile = await this.supabaseService.getProfileById(this.user.id);
      this.profile = profile;
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async createProfile(): Promise<void> {
    if (!this.user) {
      console.error('No authenticated user found');
      return;
    }

    try {
      this.isLoading = true;
      const { data, error } = await this.supabaseService.createProfile({
        id: this.user.id,
        name: this.user.email.split('@')[0], // Default name from email
        email: this.user.email,
        height: 0,
        weight: 0,
        sex: 'Other', // Default values for height, weight, and sex
      });

      if (error) {
        console.error('Error creating profile:', error.message);
      } else {
        console.log('Profile created successfully:', data);
        alert('Profile created successfully!');
        await this.loadProfile(); // Reload profile after creation
      }
    } catch (error) {
      console.error('Unexpected error creating profile:', error);
    } finally {
      this.isLoading = false;
    }
  }


  navigateTo(section: string): void {
    this.router.navigate([`/${section}`]);
  }
}
