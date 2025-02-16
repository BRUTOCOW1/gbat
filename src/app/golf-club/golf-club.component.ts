import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { GolfClub } from '../models/golf-club.model';

interface NestedClubs {
  maker: string;
  sets: {
    [setName: string]: {
      [category: string]: GolfClub[];
    };
  };
}

@Component({
  selector: 'app-golf-club',
  templateUrl: './golf-club.component.html',
  styleUrls: ['./golf-club.component.css']
})
export class GolfClubComponent implements OnInit {
  allClubs: GolfClub[] = [];
  filteredClubs: GolfClub[] = [];
  nestedClubs: NestedClubs[] = [];

  // Collapsed expansions by default
  makerOpen: { [maker: string]: boolean } = {};
  setOpen: { [maker: string]: { [setName: string]: boolean } } = {};
  categoryOpen: { [maker: string]: { [setName: string]: { [category: string]: boolean } } } = {};

  // Multi-selection
  selectedClubIds: Set<string> = new Set();

  // Optional category filter
  categoryFilter: string = '';

  // Current bag ID (passed from route or state)
  currentBagId: string | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    // Optionally retrieve bagId from navigation state
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras.state) {
      this.currentBagId = nav.extras.state['bagId'] || null;
    }
  }

  async ngOnInit() {
    // 1) Load clubs from Supabase
    const { data, error } = await this.supabaseService.getAllClubs();
    if (error) {
      console.error('Error fetching golf clubs:', error);
      return;
    }
    this.allClubs = data || [];

    // 2) Apply any initial filter (optional)
    this.applyFilter();
  }

  applyFilter() {
    if (this.categoryFilter) {
      this.filteredClubs = this.allClubs.filter(
        c => c.category?.toUpperCase() === this.categoryFilter.toUpperCase()
      );
    } else {
      this.filteredClubs = [...this.allClubs];
    }
    this.groupClubs();
  }

  // Group clubs by maker -> set -> category
  groupClubs() {
    const grouped: { [maker: string]: { [setName: string]: { [category: string]: GolfClub[] } } } = {};

    this.filteredClubs.forEach(club => {
      const maker = club.maker || 'Unknown Maker';
      const setName = club.set || 'Default Set';
      const category = club.category || 'Misc';

      if (!grouped[maker]) {
        grouped[maker] = {};
      }
      if (!grouped[maker][setName]) {
        grouped[maker][setName] = {};
      }
      if (!grouped[maker][setName][category]) {
        grouped[maker][setName][category] = [];
      }
      grouped[maker][setName][category].push(club);
    });

    // Convert to an array
    this.nestedClubs = Object.keys(grouped).map(maker => ({
      maker,
      sets: grouped[maker]
    }));
  }

  // Expand/collapse maker
  toggleMaker(maker: string) {
    this.makerOpen[maker] = !this.makerOpen[maker];
  }

  // Expand/collapse set
  toggleSet(maker: string, setName: string) {
    if (!this.setOpen[maker]) {
      this.setOpen[maker] = {};
    }
    this.setOpen[maker][setName] = !this.setOpen[maker][setName];
  }

  // Expand/collapse category
  toggleCategory(maker: string, setName: string, category: string) {
    if (!this.categoryOpen[maker]) {
      this.categoryOpen[maker] = {};
    }
    if (!this.categoryOpen[maker][setName]) {
      this.categoryOpen[maker][setName] = {};
    }
    this.categoryOpen[maker][setName][category] = !this.categoryOpen[maker][setName][category];
  }

  // Toggle selection for a club
  toggleClubSelection(clubId: string, event: Event) {
    event.stopPropagation(); // Prevent toggling expansions
    if (this.selectedClubIds.has(clubId)) {
      this.selectedClubIds.delete(clubId);
    } else {
      this.selectedClubIds.add(clubId);
    }
  }

  // Bulk add selected clubs to the bag
  async addSelectedClubsToBag() {
    if (!this.currentBagId) {
      alert('No bag selected. Please navigate with a bagId or create a bag first.');
      return;
    }
    const user = await this.supabaseService.getUser();
    if (!user) {
      alert('Not logged in. Redirecting...');
      this.router.navigate(['/login']);
      return;
    }

    const results = [];
    for (const clubId of this.selectedClubIds) {
      try {
        const { data, error } = await this.supabaseService.createGolferClub({
          golfer_id: user.id,
          club_id: clubId,
          cur_bag_id: this.currentBagId
        });
        if (error) {
          console.error(`Error adding club ${clubId}:`, error);
          results.push({ clubId, success: false });
        } else {
          results.push({ clubId, success: true });
        }
      } catch (err) {
        console.error(`Unexpected error for club ${clubId}:`, err);
        results.push({ clubId, success: false });
      }
    }
    // Clear selection
    this.selectedClubIds.clear();
    alert('Selected clubs added to bag. Check console for any errors.');
  }
}
