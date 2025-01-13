import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private fb: FormBuilder, private router: Router) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {}

  async onSubmit(): Promise<void> {
    if (this.registerForm.valid) {
      const { username, email, password } = this.registerForm.value;

      try {
        // Simulate a registration service (replace with real service call)
        const response = await this.simulateRegistration({
          username,
          email,
          password,
        });

        if (response.success) {
          this.successMessage = 'Registration successful! Redirecting...';
          this.errorMessage = null;

          // Simulate a delay and redirect to the login page
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        } else {
          this.successMessage = null;
          this.errorMessage = response.message || 'An error occurred during registration.';
        }
      } catch (error) {
        this.successMessage = null;
        this.errorMessage = 'Unexpected error occurred. Please try again.';
        console.error('Registration error:', error);
      }
    }
  }

  // Simulate a backend registration service
  private simulateRegistration(user: { username: string; email: string; password: string }): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (user.email === 'existing@example.com') {
          resolve({ success: false, message: 'Email already in use.' });
        } else {
          resolve({ success: true });
        }
      }, 1000); // Simulate 1-second backend delay
    });
  }
}
