import { Component, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  isLoggedIn: boolean = false; // Track login state
  private authSubscription: Subscription | undefined;
  isDarkMode: boolean = false;
  constructor(private supabaseService: SupabaseService, private renderer: Renderer2, private router: Router ) {}

  
  
  ngOnInit(): void {
    const storedMode = localStorage.getItem('darkMode');
    this.isDarkMode = storedMode === 'true';
    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark-mode');
    }
    this.isLoggedIn2();
    this.isLoggedIn = this.isLoggedIn; // Update login state

  }
  async isLoggedIn2() : Promise<boolean>{
    const user = await this.supabaseService.getUser();

    if (!user) {
      console.warn('No user is authenticated.');
      this.router.navigate(['/login']);
      return false;
    }
    this.isLoggedIn = true;
    return true;
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
    this.isLoggedIn = false; // Update login state
  }


  ngOnDestroy() {
    // Cleanup subscription to avoid memory leaks
    this.authSubscription?.unsubscribe();
  }
}
