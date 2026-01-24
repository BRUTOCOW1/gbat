import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.css'
})
export class BlogComponent implements OnInit {
  title = 'Ben Brutocao Blog!';

  data: any;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit(): void {
    this.fetchData();
  }

  async fetchData(): Promise<void> {
    try {
      const entries = await this.supabaseService.getBlogPosts();
      if (entries) {
        this.data = entries;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Handle error as needed
    }
  }
}