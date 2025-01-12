import { Component, OnInit, OnDestroy } from '@angular/core';
import { SupabaseService } from '../../supabase.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  isLoggedIn: boolean = false; // Track login state
  private authSubscription: Subscription | undefined;

  constructor(private supabaseService: SupabaseService) {}

  async ngOnInit() {
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

  async logout() {
    await this.supabaseService.signOut();
    this.isLoggedIn = false; // Update login state
  }

  ngOnDestroy() {
    // Cleanup subscription to avoid memory leaks
    this.authSubscription?.unsubscribe();
  }
}
