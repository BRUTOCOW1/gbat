import { Component, OnInit } from '@angular/core';
import { debounceTime, Subject } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { GolfDataService } from '../../services/golf-data.service';
import { GolfCourse } from '../../shared/models/golf-course.model';
import { GolfHole } from '../../shared/models/golf-course.model';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-golf-course',
  templateUrl: './golf-course.component.html',
  styleUrls: ['./golf-course.component.css']
})
export class GolfCourseComponent implements OnInit {
  searchQuery = '';
  courses: GolfCourse[] = [];
  externalCourses: any[] = []; // Results from external API
  selectedCourse: GolfCourse | null = null;
  selectedHole: GolfHole | null = null;
  loading = false;
  searchMode: 'local' | 'online' = 'local';
  userId: string | null = null;

  private searchSubject = new Subject<string>();

  constructor(
    private supabaseService: SupabaseService,
    private golfDataService: GolfDataService,
    private notificationService: NotificationService
  ) {
    // Debounce the search
    this.searchSubject.pipe(debounceTime(300)).subscribe(query => {
      this.performSearch(query);
    });
  }

  async ngOnInit() {
    const user = await this.supabaseService.getUser();
    if (user) {
      this.userId = user.id;
      await this.loadMyCourses();
    }
  }

  async loadMyCourses() {
    if (!this.userId) return;
    this.loading = true;
    try {
      this.courses = await this.supabaseService.getGolfCoursesByUser(this.userId);
      if (this.courses.length === 0) {
        this.notificationService.showInfo('You haven\'t played any courses yet. Start a round to add courses to "My Courses"!');
      }
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading your courses: ${errorMsg}`);
    } finally {
      this.loading = false;
    }
  }

  onSearchChange() {
    this.searchSubject.next(this.searchQuery);
  }

  async setSearchMode(mode: 'local' | 'online') {
    this.searchMode = mode;
    if (mode === 'local' && !this.searchQuery) {
      await this.loadMyCourses();
    } else {
      this.performSearch(this.searchQuery);
    }
  }

  async performSearch(query: string) {
    this.loading = true;
    this.selectedCourse = null;
    this.selectedHole = null;

    if (this.searchMode === 'local') {
      if (!query) {
        // If no query, show all courses the user has played
        await this.loadMyCourses();
      } else {
        // Filter user's courses by search query
        const myCourses = await this.supabaseService.getGolfCoursesByUser(this.userId!);
        this.courses = myCourses.filter(course => 
          course.name.toLowerCase().includes(query.toLowerCase()) ||
          course.location?.toLowerCase().includes(query.toLowerCase())
        );
      }
      this.externalCourses = [];
    } else {
      if (!query) {
        this.externalCourses = [];
        this.courses = [];
        this.loading = false;
        return;
      }
      this.golfDataService.searchExternalCourses(query).subscribe({
        next: (results) => {
          this.externalCourses = results;
          this.courses = [];
          this.loading = false;
        },
        error: (err) => {
          const errorMsg = this.notificationService.getErrorMessage(err);
          this.notificationService.showError(`External search failed: ${errorMsg}`);
          console.error('External search failed', err);
          this.loading = false;
        }
      });
      // Return early since subscribe handles loading=false
      return;
    }
    this.loading = false;
  }

  // Legacy method wrapper if needed, or just use performSearch
  searchCourses(query: string) {
    this.performSearch(query);
  }

  async selectCourse(course: GolfCourse) {
    try {
      const holes = await this.supabaseService.getGolfHolesByCourseId(course.id);
      this.selectedCourse = { ...course, holes };
      this.selectedHole = null;
      if (holes.length === 0) {
        this.notificationService.showWarning('This course has no holes defined.');
      }
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading course details: ${errorMsg}`);
    }
  }

  toggleHoleDetails(hole: GolfHole) {
    this.selectedHole =
      this.selectedHole?.hole_number === hole.hole_number ? null : hole;
  }

  importCourse(externalCourse: any) {
    if (!confirm(`Import ${externalCourse.course_name}?`)) return;

    this.loading = true;
    this.golfDataService.getExternalCourseDetails(externalCourse.course_id).subscribe(async (details) => {
      if (details) {
        try {
          // Ensure holes don't have course_id yet, insertGolfCourseWithHoles handles it
          const holes = details.holes || [];
          const courseData = { ...details };
          delete courseData.holes;

          const newCourse = await this.supabaseService.insertGolfCourseWithHoles(courseData, holes);
          this.notificationService.showSuccess(`Course "${newCourse.name}" imported successfully!`);

          // Switch to local mode and show the new course
          this.searchMode = 'local';
          this.searchQuery = newCourse.name;
          this.performSearch(newCourse.name);
        } catch (err) {
          const errorMsg = this.notificationService.getErrorMessage(err);
          this.notificationService.showError(`Failed to import course: ${errorMsg}`);
          console.error('Import failed', err);
        }
      } else {
        this.notificationService.showError('Course details not available for import.');
      }
      this.loading = false;
    });
  }
}
