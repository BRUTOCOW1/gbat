import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SupabaseService } from '../../services/supabase.service';
import { GolfClub } from '../../shared/models/golf-club.model';
import { NotificationService } from '../../shared/services/notification.service';

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
  
  // Search filter
  searchTerm: string = '';

  // Current bag ID (passed from route or state)
  currentBagId: string | null = null;
  
  // View mode: 'nested' or 'list'
  viewMode: 'nested' | 'list' = 'list';

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private http: HttpClient,
    private notificationService: NotificationService
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
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading clubs: ${errorMsg}`);
      console.error('Error fetching golf clubs:', error);
      return;
    }
    this.allClubs = data || [];
    if (this.allClubs.length === 0) {
      this.notificationService.showInfo('No clubs found. Seed the database to get started!');
    }

    // 2) Apply any initial filter (optional)
    this.applyFilter();
  }

  applyFilter() {
    let filtered = [...this.allClubs];
    
    // Apply category filter
    if (this.categoryFilter) {
      filtered = filtered.filter(
        c => c.category?.toUpperCase() === this.categoryFilter.toUpperCase()
      );
    }
    
    // Apply search filter
    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.maker?.toLowerCase().includes(searchLower) ||
        c.set?.toLowerCase().includes(searchLower) ||
        c.number?.toLowerCase().includes(searchLower) ||
        c.category?.toLowerCase().includes(searchLower)
      );
    }
    
    this.filteredClubs = filtered;
    this.groupClubs();
  }
  
  onSearchChange() {
    this.applyFilter();
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
      this.notificationService.showWarning('No bag selected. Please navigate with a bagId or create a bag first.');
      return;
    }
    if (this.selectedClubIds.size === 0) {
      this.notificationService.showWarning('Please select at least one club to add.');
      return;
    }
    const user = await this.supabaseService.getUser();
    if (!user) {
      this.notificationService.showError('You must be logged in to add clubs.');
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
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    // Clear selection
    this.selectedClubIds.clear();
    
    if (failCount === 0) {
      this.notificationService.showSuccess(`Successfully added ${successCount} club(s) to your bag!`);
    } else if (successCount > 0) {
      this.notificationService.showWarning(`Added ${successCount} club(s), but ${failCount} failed. Please try again.`);
    } else {
      this.notificationService.showError('Failed to add clubs. Please try again.');
    }
  }

  async seedDatabase() {
    if (!confirm('This will add popular clubs to the database. Continue?')) return;

    this.http.get<GolfClub[]>('assets/club_catalog.json').subscribe(async (clubs) => {
      if (clubs && clubs.length > 0) {
        try {
          const { error } = await this.supabaseService.upsertClubs(clubs);
          if (error) {
            const errorMsg = this.notificationService.getErrorMessage(error);
            this.notificationService.showError(`Failed to seed database: ${errorMsg}`);
            console.error('Seeding failed', error);
          } else {
            this.notificationService.showSuccess(`Database seeded successfully! Added ${clubs.length} clubs.`);
            this.ngOnInit(); // Reload list
          }
        } catch (error) {
          const errorMsg = this.notificationService.getErrorMessage(error);
          this.notificationService.showError(`Unexpected error: ${errorMsg}`);
        }
      } else {
        this.notificationService.showError('No clubs found in catalog file.');
      }
    }, (error) => {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading club catalog: ${errorMsg}`);
    });
  }
  
  toggleViewMode() {
    this.viewMode = this.viewMode === 'nested' ? 'list' : 'nested';
  }
  
  navigateToAddClub() {
    this.router.navigate(['/add-club']);
  }
}

