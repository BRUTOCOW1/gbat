import { Component, OnInit, Input } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { GolfClub } from '../models/golf-club.model';
@Component({
  selector: 'app-golf-clubs',
  templateUrl: './golf-club.component.html',
  styleUrls: ['./golf-club.component.css'],
})
export class GolfClubComponent implements OnInit {
  @Input() golfBagId!: string; // The GolfBag ID to manage clubs
  clubs: GolfClub[] = [];
  newClub = { name: '', first: '', last: '', loft: ''}; // For adding a new club
  loading = false;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit() {
    this.loadClubs();
  }

  async loadClubs() {
    this.loading = true;
    try {
      const { data, error } = await this.supabaseService.getClubsByBag(this.golfBagId);
      if (error) {
        console.error('Error fetching clubs:', error);
      } else {
        this.clubs = data || [];
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      this.loading = false;
    }
  }


  async addClub() {
    const { name, first, last, loft } = this.newClub;
    if (!name || !first || !last || !loft) {
      alert('Please fill in all fields for the new club.');
      return;
    }
    try {
      const { data, error } = await this.supabaseService.addClubToBag({
        golf_bag_id: this.golfBagId,
        first,
        last,
        loft,
      });
      if (error) {
        console.error('Error adding club:', error);
      } else {
        this.clubs.push(data[0]); // Add the new club to the list
        this.newClub = { name: '', first: '', last: '', loft: '' }; // Reset form
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }
  async removeClub(id: string) {
    try {
      const { error } = await this.supabaseService.removeClub(id);
      if (error) {
        console.error('Error removing club:', error);
      } else {
        this.clubs = this.clubs.filter((club) => club.id !== id); // Update the local list
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }
}
