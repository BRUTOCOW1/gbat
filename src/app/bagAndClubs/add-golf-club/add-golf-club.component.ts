import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../../shared/services/notification.service';
import { GolfClub } from '../../shared/models/golf-club.model';

@Component({
  selector: 'app-add-golf-club',
  templateUrl: './add-golf-club.component.html',
  styleUrls: ['./add-golf-club.component.css']
})
export class AddGolfClubComponent implements OnInit {
  clubForm: FormGroup;
  isSubmitting = false;

  // Common categories for dropdown
  categories = ['DRIVER', 'FAIRWAY WOOD', 'HYBRID', 'IRON', 'WEDGE', 'PUTTER'];

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private router: Router,
    private notificationService: NotificationService
  ) {
    this.clubForm = this.fb.group({
      maker: ['', Validators.required],
      set: ['', Validators.required],
      number: ['', Validators.required],
      category: ['', Validators.required],
      loft: ['', Validators.required],
      length: ['', Validators.required],
      lie_angle: [''],
      club_offset: [''],
      bounce: ['']
    });
  }

  ngOnInit(): void {
    // Component initialization
  }

  async onSubmit(): Promise<void> {
    if (this.clubForm.invalid) {
      this.notificationService.showWarning('Please fill in all required fields.');
      return;
    }

    this.isSubmitting = true;

    try {
      const formValue = this.clubForm.value;
      
      // Create club object matching the GolfClub interface
      const newClub: GolfClub = {
        id: crypto.randomUUID(), // Generate UUID for new club
        maker: formValue.maker.trim(),
        set: formValue.set.trim(),
        number: formValue.number.trim(),
        category: formValue.category,
        loft: formValue.loft.toString(),
        length: formValue.length.toString(),
        lie_angle: formValue.lie_angle ? formValue.lie_angle.toString() : undefined,
        club_offset: formValue.club_offset ? formValue.club_offset.toString() : undefined,
        bounce: formValue.bounce ? formValue.bounce.toString() : undefined
      };

      // Use upsertClubs - it will handle insert/update
      const { data, error } = await this.supabaseService.upsertClubs([newClub]);
      
      if (error) {
        const errorMsg = this.notificationService.getErrorMessage(error);
        this.notificationService.showError(`Failed to add club: ${errorMsg}`);
        console.error('Error adding club:', error);
      } else {
        this.notificationService.showSuccess('Club added successfully!');
        this.clubForm.reset();
        // Optionally navigate back or to clubs list
        setTimeout(() => {
          this.router.navigate(['/golf-clubs']);
        }, 1500);
      }
    } catch (error: any) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Unexpected error: ${errorMsg}`);
      console.error('Unexpected error:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/golf-clubs']);
  }
}
