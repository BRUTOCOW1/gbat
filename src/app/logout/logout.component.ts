import { Component } from '@angular/core';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-logout',
  template: `
    <button (click)="logout()">Logout</button>
  `,
})
export class LogoutComponent {
  constructor(private supabaseService: SupabaseService) {}

  async logout() {
    const error = await this.supabaseService.signOut();
  }
}
