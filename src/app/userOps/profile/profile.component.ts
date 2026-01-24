import { Router } from '@angular/router';

import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  profile: any = null; // Store the current user's profile
  user: any = null; // Store the current authenticated user
  isLoading = false;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.user = await this.supabaseService.getUser();
    if (this.user) {
      await this.loadProfile();
    }
  }

  async loadProfile(): Promise<void> {
    this.isLoading = true;
    try {
      const profile = await this.supabaseService.getProfileById(this.user.id);
      this.profile = profile;
      if (!profile) {
        this.notificationService.showInfo('No profile found. Create one to get started!');
      }
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(errorMsg);
      console.error('Error loading profile:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async createProfile(): Promise<void> {
    if (!this.user) {
      this.notificationService.showError('You must be logged in to create a profile.');
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
        const errorMsg = this.notificationService.getErrorMessage(error);
        this.notificationService.showError(errorMsg);
        console.error('Error creating profile:', error.message);
      } else {
        this.notificationService.showSuccess('Profile created successfully!');
        await this.loadProfile(); // Reload profile after creation
      }
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(errorMsg);
      console.error('Unexpected error creating profile:', error);
    } finally {
      this.isLoading = false;
    }
  }


  navigateTo(section: string): void {
    this.router.navigate([`/${section}`]);
  }
}
