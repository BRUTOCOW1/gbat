import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.css'
})
export class BlogComponent implements OnInit {
  title = 'Ben Brutocao Blog!';

  data: any;

  constructor(
    private supabaseService: SupabaseService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.fetchData();
  }

  async fetchData(): Promise<void> {
    try {
      const entries = await this.supabaseService.getBlogPosts();
      if (entries) {
        this.data = entries;
        if (entries.length === 0) {
          this.notificationService.showInfo('No blog posts found.');
        }
      } else {
        this.notificationService.showWarning('Unable to load blog posts.');
      }
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading blog: ${errorMsg}`);
      console.error('Error fetching data:', error);
    }
  }
}