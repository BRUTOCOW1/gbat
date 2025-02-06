import { Component, OnInit, Renderer2 } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  isDarkMode: boolean = false; // Tracks dark mode state

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private readonly supabaseService: SupabaseService,
    private renderer: Renderer2 // Renderer2 for DOM manipulation
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  // Ensure ngOnInit is implemented as required by OnInit interface
  ngOnInit(): void {
    this.loadDarkModePreference(); // Load dark mode state on component initialization
  }

  async login(): Promise<void> {
    this.errorMessage = null;

    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;

      try {
        const { user, session, error } = await this.supabaseService.signIn(email, password);

        if (error) {
          this.errorMessage = error || 'Login failed. Please check your credentials.';
        } else if (user) {
          console.log('Login successful:', user);
          await this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = 'Unexpected error occurred. Please try again.';
        }
      } catch (err) {
        console.error('An error occurred:', err);
        this.errorMessage = 'An unexpected error occurred. Please try again later.';
      }
    } else {
      this.errorMessage = 'Please fill in all required fields correctly.';
    }
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;

    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark-mode');
    } else {
      this.renderer.removeClass(document.body, 'dark-mode');
    }

    localStorage.setItem('darkMode', JSON.stringify(this.isDarkMode));
  }

  loadDarkModePreference(): void {
    const darkModePref = localStorage.getItem('darkMode');
    this.isDarkMode = darkModePref ? JSON.parse(darkModePref) : false;

    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark-mode');
    } else {
      this.renderer.removeClass(document.body, 'dark-mode');
    }
  }
}
