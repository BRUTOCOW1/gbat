import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent {
  newUser = { email: '', password: '' }; // For new user details
  errorMessage = ''; // Error message for failed registration
  successMessage = ''; // Success message for successful registration
  loading = false; // Loading state

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router
  ) {}

  async register() {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
  
    try {
      // Call the Supabase service to create the user
      const { data, error } = await this.supabaseService.createUser(
        this.newUser.email,
        this.newUser.password
      );
  
      if (error) {
        console.error('Supabase error:', error);
        this.errorMessage = error.message;
      } else if (data.user) {
        console.log('User successfully created:', data.user);
        this.successMessage = 'Account created successfully! Redirecting...';
        setTimeout(() => this.router.navigate(['/login']), 3000); // Redirect after 3 seconds
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      this.errorMessage = 'An unexpected error occurred. Please try again later.';
    } finally {
      this.loading = false;
    }
  }
  
}