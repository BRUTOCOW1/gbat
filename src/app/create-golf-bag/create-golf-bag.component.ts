import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';
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
  profileId: string | null = null; // ID of the current user's profile

  constructor(private fb: FormBuilder, private supabaseService: SupabaseService, private router: Router) {
    // Initialize the form group with validation rules
    this.golfBagForm = this.fb.group({
      name: ['', Validators.required],
    });
  }


  async ngOnInit(): Promise<void> {
    // Fetch the current user's profile ID
    const profile = await this.supabaseService.getProfile();
    if (profile) {
      this.profileId = profile.id;
    } else {
      console.error('Profile not found');
    }
  }



  async onSubmit(): Promise<void> {
    console.log('Submitting Create Golf Bag Form...');
    
    if (this.golfBagForm.valid) {
      const user = await this.supabaseService.getCurrentUser();
      if (!user || !user.id) {
        console.error('No authenticated user found');
        return;
      }
  
      const user_id = user.id;
      const { name } = this.golfBagForm.value;
  
      try {
        const { data, error } = await this.supabaseService.createGolfBag({ user_id, name });
  
        if (error) {
          console.error('Error creating golf bag:', error.message);
        } else if (data && data.length > 0) {
          alert('Golf Bag created successfully!');
          this.golfBagForm.reset();
  
          // ✅ Redirect to "Add Clubs" with the new bag ID
          this.router.navigate(['/add-clubs'], { state: { bagId: data[0].id } });
        } else {
          console.warn('No data returned from Supabase for the created golf bag.');
        }
      } catch (error) {
        console.error('Unexpected error while creating golf bag:', error);
      }
    } else {
      console.warn('Form is invalid. Please fill out all required fields.');
    }
  }
  
  

  trackByUserId(index: number, user: User): string {
    return user.id; // Return the unique ID of the user
  }
  

}
