import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { GolfClub } from '../../shared/models/golf-club.model';
import { GolfBag } from '../../shared/models/golf-bag.model'; // Import the GolfBag interface
import { User } from '../../shared/models/user.model';
import { Router } from '@angular/router';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-create-golf-bag',
  templateUrl: './create-golf-bag.component.html',
  styleUrl: './create-golf-bag.component.css'
})
export class CreateGolfBagComponent implements OnInit {
  golfBagForm: FormGroup;
  profileId: string | null = null; // ID of the current user's profile
  userId: string | null = null;
  // ---- New wizard state ----
  step: number = 1; // 1 = bag form, 2 = club selection
  newBagId: string | null = null;
  allClubs: GolfClub[] = [];
  selectedClubIds = new Set<string>();
  errorMessage: string | null = null; // Holds error messages for the form

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private router: Router,
    private notificationService: NotificationService
  ) {
    // Initialize the form group with validation rules
    this.golfBagForm = this.fb.group({
      name: ['', Validators.required],
    });
  }


  async ngOnInit(): Promise<void> {
    // Fetch the current user's profile ID
    const user = await this.supabaseService.getUser();
    if (!user) {
      console.warn('No user is authenticated.');
      this.router.navigate(['/login']);
      return;
    }
    this.userId = user.id;

    const profile = await this.supabaseService.getProfileById(this.userId!);
    if (profile) {
      this.profileId = profile.id;
    } else {
      console.error('Profile not found');
    }
  }



  async onSubmit(): Promise<void> {
    this.errorMessage = null;

    if (!this.golfBagForm.valid) {
      const errorMsg = 'Please enter a valid bag name.';
      this.errorMessage = errorMsg;
      this.notificationService.showWarning(errorMsg);
      return;
    }

    const user = await this.supabaseService.getUser();
    if (!user?.id) {
      const errorMsg = 'You must be logged in to create a bag.';
      this.errorMessage = errorMsg;
      this.notificationService.showError(errorMsg);
      return;
    }

    const { name } = this.golfBagForm.value;

    // Duplicate name check
    const { data: existingBags, error: fetchError } = await this.supabaseService.getGolfBagsByUser(user.id);
    if (fetchError) {
      const errorMsg = this.notificationService.getErrorMessage(fetchError);
      this.errorMessage = errorMsg;
      this.notificationService.showError(errorMsg);
      return;
    }
    if (existingBags?.some(b => b.name === name)) {
      const errorMsg = 'A bag with this name already exists. Please choose a different name.';
      this.errorMessage = errorMsg;
      this.notificationService.showWarning(errorMsg);
      return;
    }

    // Create the bag
    const { data, error } = await this.supabaseService.createGolfBag({ user_id: user.id, name });
    if (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.errorMessage = errorMsg;
      this.notificationService.showError(errorMsg);
      return;
    }
    if (!data || data.length === 0) {
      const errorMsg = 'Bag created but no ID returned. Please try again.';
      this.errorMessage = errorMsg;
      this.notificationService.showError(errorMsg);
      return;
    }

    // Success – navigate to the newly created bag view
    const newBagId = data[0].id;
    this.newBagId = newBagId;
    this.golfBagForm.reset();
    this.notificationService.showSuccess(`Golf bag "${name}" created successfully!`);
    this.router.navigate([`/golf-bag/${newBagId}`]);
    this.step = 2;
  }

  /** Load all clubs for selection */
  private async loadClubs(): Promise<void> {
    const { data, error } = await this.supabaseService.getAllClubs();
    if (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.errorMessage = errorMsg;
      this.notificationService.showError(errorMsg);
      this.allClubs = [];
    } else {
      this.allClubs = data ?? [];
    }
  }

  /** Toggle club selection from the UI */
  toggleClubSelection(clubId: string, checked: boolean): void {
    if (checked) {
      this.selectedClubIds.add(clubId);
    } else {
      this.selectedClubIds.delete(clubId);
    }
  }

  /** Persist selected clubs to the new bag */
  async saveClubs(): Promise<void> {
    this.errorMessage = null;
    if (!this.newBagId) {
      const errorMsg = 'No bag ID – cannot save clubs.';
      this.errorMessage = errorMsg;
      this.notificationService.showError(errorMsg);
      return;
    }
    const user = await this.supabaseService.getUser();
    if (!user?.id) {
      const errorMsg = 'You must be logged in to save clubs.';
      this.errorMessage = errorMsg;
      this.notificationService.showError(errorMsg);
      return;
    }
    const clubIds = Array.from(this.selectedClubIds);
    const promises = clubIds.map(id =>
      this.supabaseService.createGolferClub({ golfer_id: user.id, club_id: id, cur_bag_id: this.newBagId! })
    );
    const results = await Promise.allSettled(promises);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
      const errorMsg = `${failed.length} club(s) could not be saved. Please try again.`;
      this.errorMessage = errorMsg;
      this.notificationService.showError(errorMsg);
      return;
    }
    // Success
    this.notificationService.showSuccess(`Successfully added ${clubIds.length} club(s) to your bag!`);
    // Navigate to the bag view (or dashboard)
    this.router.navigate(['/golf-bag', this.newBagId]);
  }

  /** Return to previous step */
  goBack(): void {
    this.step = 1;
    this.errorMessage = null;
  }


  trackByUserId(index: number, user: User): string {
    return user.id; // Return the unique ID of the user
  }

  // Legacy navigation – keep for users who prefer the old flow
  navigateToAddClubsLegacy(): void {
    if (this.newBagId) {
      this.router.navigate(['/add-clubs'], { state: { bagId: this.newBagId } });
    }
  }


}
