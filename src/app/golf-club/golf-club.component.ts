import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Router } from '@angular/router';

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

  selectClub(club: GolfClub): void {
    this.selectedClub = club;
  }

  closePanel(event: Event): void {
    event.stopPropagation();
    this.selectedClub = null;
  }

  redirectToCreateClub(): void {
    this.router.navigate(['/new-club']);
  }
}
