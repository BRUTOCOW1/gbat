import { Component, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  isLoggedIn: boolean = false; // Track login state
  private authSubscription: Subscription | undefined;
  isDarkMode: boolean = false;
  constructor(private supabaseService: SupabaseService, private renderer: Renderer2 ) {}

  async ngOnInit() {
    this.loadDarkModePreference(); // Load dark mode state on component initialization

    // Check the current session on component load
    const session = await this.supabaseService.getSession();
    this.isLoggedIn = !!session;

    // Listen for auth state changes
    this.authSubscription = this.supabaseService.authState$.subscribe(
      (isLoggedIn) => {
        this.isLoggedIn = isLoggedIn;
      }
    );
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;

    // Add or remove the 'dark-mode' class on <body>
    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark-mode');
    } else {
      this.renderer.removeClass(document.body, 'dark-mode');
    }

    // Save the preference to localStorage
    localStorage.setItem('darkMode', JSON.stringify(this.isDarkMode));
  }

  loadDarkModePreference(): void {
    const darkModePref = localStorage.getItem('darkMode');
    this.isDarkMode = darkModePref ? JSON.parse(darkModePref) : false;

    // Apply the 'dark-mode' class based on the preference
    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark-mode');
    } else {
      this.renderer.removeClass(document.body, 'dark-mode');
    }
  }

  async logout() {
    await this.supabaseService.signOut();
    this.isLoggedIn = false; // Update login state
  }

  ngOnDestroy() {
    // Cleanup subscription to avoid memory leaks
    this.authSubscription?.unsubscribe();
  }
}
