import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { GolfBag } from './models/golf-bag.model';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private authStateSubject = new BehaviorSubject<boolean>(false);
  authState$ = this.authStateSubject.asObservable();
  
  constructor() {
    this.supabase = createClient(
      'https://mgpgbijsyiwkappxedfu.supabase.co', // Replace with your Supabase URL
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncGdiaWpzeWl3a2FwcHhlZGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyMDY4NDQsImV4cCI6MjA1MTc4Mjg0NH0.IkpfzHy9xE00p7GjbSyhg30H_5hZ7_4zHFJoXhBTdmY' // Replace with your Supabase Anon Key
    );
    this.initializeAuthListener();
  }
  async createUser(email: string, password: string) {
    const result = await this.supabase.auth.signUp({ email, password });
    console.log('Supabase auth.signUp response:', result);
    return result;
  }
  
  // Create a new user (Sign Up)
  // async createUser(email: string, password: string) {
  //   const { data, error } = await this.supabase.auth.signUp({
  //     email,
  //     password,
  //   });

  //   return { user: data.user, session: data.session, error };
  // }
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { user: data.user, session: data.session, error };
  }

  async getUser() {
    const { data, error } = await this.supabase.auth.getUser();
    if (error) {
      console.error('Error fetching user:', error.message);
      return null; // Handle errors gracefully
    }
    return data.user; // Return the user object if available
  }
  

// Get the current session
async getSession() {
  const { data, error } = await this.supabase.auth.getSession();
  if (error) {
    console.error('Error fetching session:', error);
    return null;
  }
  return data.session;
}

// Listen for auth state changes
private initializeAuthListener() {
  this.supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session);

    // Update the auth state
    this.authStateSubject.next(!!session);
  });
}

// Sign out the current user
async signOut() {
  const { error } = await this.supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
  } else {
    this.authStateSubject.next(false); // Update the state to logged out
  }
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
