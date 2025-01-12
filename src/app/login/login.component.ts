import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  email = ''; // User email for login
  password = ''; // User password for login
  errorMessage = ''; // Error message to display on login failure
  loading = false; // To indicate the login process

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router
  ) {}

  ngOnInit() {
    // Any initialization logic for the login component can go here
  }

  async login() {
    this.loading = true; // Start loading state
    this.errorMessage = ''; // Clear previous error messages

    try {
      const { error } = await this.supabaseService.signIn(this.email, this.password);
      if (error) {
        this.errorMessage = error.message; // Display error message
      } else {
        await this.router.navigate(['/golf-component']); // Redirect on successful login
      }
    } catch (err) {
      console.error('An unexpected error occurred during login:', err);
      this.errorMessage = 'An unexpected error occurred. Please try again later.';
    } finally {
      this.loading = false; // End loading state
    }
  }
}
