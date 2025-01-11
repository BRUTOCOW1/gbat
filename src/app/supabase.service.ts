import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GolfBag } from './models/golf-bag.model';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      'https://.supabase.co', // Replace with your Supabase URL
      '..' // Replace with your Supabase Anon Key
    );
  }

  // Fetch users from the `users` table
  async getUsers() {
    return await this.supabase.from('users').select('id, name');
  }

  // Create a new golf bag
  async createGolfBag(bag: { name: string; user_id: string }): Promise<{ data: GolfBag[] | null; error: any }> {
    return await this.supabase.from('golfbag').insert(bag).select('*');
  }
  

  // Fetch golf bags by user (optional if needed for displaying a list)
  async getGolfBagsByUser(userId: string) {
    return await this.supabase.from('golfbag').select('*').eq('user_id', userId);
  }
  async getClubsByBag(golfBagId: string) {
    return await this.supabase
      .from('golfclub')
      .select('*')
      .eq('golfbag_id', golfBagId);
  }
  async addClubToBag(club: { 
    golf_bag_id: string;
    first: string;
    last: string;
    loft: string;
  }) {
    return await this.supabase.from('golfclub').insert(club).select('*');
  }
  
  async removeClub(clubId: string) {
    return await this.supabase.from('golfclub').delete().eq('golfclub_id', clubId);
  }
  async getGolfBags() {
    return await this.supabase.from('golfbag').select('*');
  }
  
  
}
