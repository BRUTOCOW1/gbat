import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent {
  registerForm: FormGroup;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  async onSubmit(): Promise<void> {
    if (this.registerForm.valid) {
      const { username, email, password } = this.registerForm.value;
  
      try {
        const { data, error } = await this.supabaseService.createUser(email, password);
  
        if (error) {
          this.successMessage = null;
          const errorMsg = this.notificationService.getErrorMessage(error);
          this.errorMessage = errorMsg;
          this.notificationService.showError(errorMsg);
        } else if (data && data.user) {
          // Only proceed if data.user is not null
          const profile = {
            id: data.user.id, // Access safely after null check
            name: username,
            email: email,
            height: 0,
            weight: 0,
            sex: 'Male',
          };
  
          const profileResponse = await this.supabaseService.createProfile(profile);
  
          if (profileResponse.error) {
            console.error('Error creating profile:', profileResponse.error.message);
            const errorMsg = 'Registration successful, but profile creation failed.';
            this.errorMessage = errorMsg;
            this.notificationService.showWarning(errorMsg);
          } else {
            this.successMessage = 'Registration successful! Redirecting...';
            this.errorMessage = null;
            this.notificationService.showSuccess('Registration successful! Redirecting to login...');
  
            // Redirect to the login page after a delay
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 2000);
          }
        } else {
          this.successMessage = null;
          const errorMsg = 'Unexpected error: User data is null.';
          this.errorMessage = errorMsg;
          this.notificationService.showError(errorMsg);
        }
      } catch (error) {
        this.successMessage = null;
        const errorMsg = this.notificationService.getErrorMessage(error);
        this.errorMessage = errorMsg;
        this.notificationService.showError(errorMsg);
        console.error('Registration error:', error);
      }
    } else {
      const errorMsg = 'Please fill in all required fields correctly.';
      this.errorMessage = errorMsg;
      this.notificationService.showWarning(errorMsg);
    }
  }
  
}
