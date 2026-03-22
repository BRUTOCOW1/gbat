import { Component, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  isLoggedIn: boolean = false;
  private authSubscription: Subscription | undefined;
  isDarkMode: boolean = false;
  constructor(private supabaseService: SupabaseService, private renderer: Renderer2) {}

  ngOnInit(): void {
    const storedMode = localStorage.getItem('darkMode');
    this.isDarkMode = storedMode === 'true';
    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark-mode');
    }
    void this.syncLoginState();
    this.authSubscription = this.supabaseService.authState$
      .pipe(skip(1))
      .subscribe(() => void this.syncLoginState());
  }

  /** Reflect session in the navbar without redirecting — public routes must stay reachable (e.g. /register). */
  private async syncLoginState(): Promise<void> {
    const user = await this.supabaseService.getUser();
    this.isLoggedIn = !!user;
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark-mode');
    } else {
      this.renderer.removeClass(document.body, 'dark-mode');
    }
    localStorage.setItem('darkMode', String(this.isDarkMode));
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
    this.isLoggedIn = false;
  }


  ngOnDestroy() {
    // Cleanup subscription to avoid memory leaks
    this.authSubscription?.unsubscribe();
  }
}
