import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Router } from '@angular/router';
import { GolfBag } from '../models/golf-bag.model';
import { GolferClub } from '../models/golfer-club-model';

interface GolfClub {
  id: string;
  maker: string;
  set: string;
  number: string;
  loft: number;
  lie_angle: number;
  club_offset: number;
  length: number;
  category: string;
}

@Component({
  selector: 'app-golf-club',
  templateUrl: './golf-club.component.html',
  styleUrls: ['./golf-club.component.css'],
})
export class GolfClubComponent implements OnInit {

  userId: string | null = null;
  currentBagId!: string;

  selectedClubs: GolfClub[] = [];
  selectedClub: GolfClub | null = null;

  golfClubs: GolfClub[] = [];
  groupedGolfClubs: { [maker: string]: { [set: string]: GolfClub[] } } = {};

  expandedMakers: { [maker: string]: boolean } = {};
  expandedSets: { [maker: string]: { [set: string]: boolean } } = {};

  searchMaker: string = '';
  searchCategory: string = '';

  constructor(private supabaseService: SupabaseService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    try {
      const user = await this.supabaseService.getCurrentUser();
      this.currentBagId = history.state.bagId;
      if (user) {
        this.userId = user.id;
      }

      if (!this.userId) {
        return;
      }

      await this.loadGolfClubs();
    } catch (error) {
      console.error('Error fetching golf clubs:', error);
    }
  }

  async loadGolfClubs(): Promise<void> {
    const { data, error } = await this.supabaseService.getAllClubs();
    if (!error) {
      this.golfClubs = data || [];
      this.groupGolfClubs();
    }
  }
  

  async searchClubs(): Promise<void> {
    const { data, error } = await this.supabaseService.searchClubs(this.searchMaker, this.searchCategory);
    if (!error) {
      this.golfClubs = data || [];
      this.groupGolfClubs();
    }
  }

 

  groupGolfClubs(): void {
    this.groupedGolfClubs = {};

    this.golfClubs.forEach((club) => {
      if (!this.groupedGolfClubs[club.maker]) {
        this.groupedGolfClubs[club.maker] = {};
        this.expandedMakers[club.maker] = false;
      }

      if (!this.groupedGolfClubs[club.maker][club.set]) {
        this.groupedGolfClubs[club.maker][club.set] = [];
        this.expandedSets[club.maker] = { ...this.expandedSets[club.maker], [club.set]: false };
      }

      this.groupedGolfClubs[club.maker][club.set].push(club);
    });
  }

  getMakers(): string[] {
    return Object.keys(this.groupedGolfClubs);
  }

  getSets(maker: string): string[] {
    return Object.keys(this.groupedGolfClubs[maker] || {});
  }

  toggleMaker(maker: string): void {
    this.expandedMakers[maker] = !this.expandedMakers[maker];
  }

  toggleSet(maker: string, set: string): void {
    this.expandedSets[maker][set] = !this.expandedSets[maker][set];
  }



  isClubSelected(club: GolfClub): boolean {
    return this.selectedClubs.some(selected => selected.id === club.id);
  }
  


  selectClub(golfclub: GolfClub): void {
    this.toggleClub(golfclub);
    this.selectedClub = golfclub;
  }
  
  toggleClub(club: GolfClub): void {
    // Loop through selectedClubs to see if club is already selected
    for (let i = 0; i < this.selectedClubs.length; i++) {
      if (club.id === this.selectedClubs[i].id) {
        // If found, remove the club from the selection
        this.selectedClubs.splice(i, 1);
        return;
      }
    }
    // Otherwise, add the club to the selection
    this.selectedClubs.push(club);
  }
  async addClubsToBag(): Promise<void> {
    const user = await this.supabaseService.getCurrentUser();
    if (!user || !user.id) {
      console.error('No authenticated user found');
      return; // Exit early if no user is authenticated
    }
    var golf_club:GolfClub;

    const golfer_id = user.id; // The authenticated user's ID
    for (var golf_club_idx = 0; golf_club_idx < this.selectedClubs?.length; golf_club_idx++) {
      golf_club = this.selectedClubs[golf_club_idx];
      const club_id = golf_club.id;
      const cur_bag_id = this.currentBagId;

      try { 
        // Call the Supabase service to create the golf bag
        const { data, error } = await this.supabaseService.createGolferClub({
          golfer_id, // Include the authenticated user's ID
          club_id,    // Include the golf bag name
          cur_bag_id
        });
  
        // Handle response
        if (error) {
          console.error('Error creating golf bag:', error.message);
        } else if (data && data.length > 0) {
          console.log('Created Golf Club:', data[0]);
        } else {
          console.warn('No data returned from Supabase for the created golf bag.');
        }
      } catch (error) {
        console.error('Unexpected error while creating golf bag:', error);
    }
      
      // var basement: GolferClub {
      //   rounds: 0;

      // }
      // this.supabaseService.createGolferClub()

    }
      
  }
  
  closePanel(event: Event): void {
    event.stopPropagation();
    this.selectedClub = null;
  }

}
