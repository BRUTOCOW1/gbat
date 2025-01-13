import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { GolfBag } from './models/golf-bag.model';
import { User } from './models/user.model';
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
async getUsers(): Promise<User[] | null> {
  try {
    const response = await this.supabase.from('users_view').select('*');
    
    // Check for errors in the response
    if (response.error) {
      console.error('Error fetching users:', response.error.message);
      return null;
    }

    // Access the `data` property, which contains the rows
    console.log('Users fetched successfully:', response.data);
    return response.data; // `response.data` is the array of users
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}


async createGolfBag(bag: { user_id: string; name: string }): Promise<any> {
  return await this.supabase
    .from('golfbag')
    .insert(bag)
    .select('*'); // Returns the inserted record
}

async getProfile(): Promise<any> {
  const { data, error } = await this.supabase
    .from('profile')
    .select('id')
    .single(); // Fetch the current user's profile
  if (error) {
    console.error('Error fetching profile:', error.message);
    return null;
  }
  return data;
}

async createProfile(profile: {
  id: string;
  name: string;
  email: string;
  height: number;
  weight: number;
  sex: string;
}): Promise<any> {
  return await this.supabase
    .from('profile')
    .insert(profile)
    .select('*'); // Return the inserted profile
}

async getProfileById(userId: string): Promise<any> {
  const { data, error } = await this.supabase
    .from('profile')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error.message);
    return null;
  }

  return data;
}

async getCurrentUser(): Promise<any> {
  const { data, error } = await this.supabase.auth.getUser();
  if (error) {
    console.error('Error fetching current user:', error.message);
    return null;
  }

  return data?.user;
}


  // Fetch golf bags by user (optional if needed for displaying a list)
  async getGolfBagsByUser(userId: string): Promise<{ data: GolfBag[] | null; error: any }> {
    return await this.supabase
      .from('golfbag')
      .select('*')
      .eq('user_id', userId); // Filter by user_id
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
