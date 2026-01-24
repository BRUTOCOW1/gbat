import { Component } from '@angular/core';
import { debounceTime, Subject } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { GolfDataService } from '../../services/golf-data.service';
import { GolfCourse } from '../../shared/models/golf-course.model';
import { GolfHole } from '../../shared/models/golf-course.model';

@Component({
  selector: 'app-golf-course',
  templateUrl: './golf-course.component.html',
  styleUrls: ['./golf-course.component.css']
})
export class GolfCourseComponent {
  searchQuery = '';
  courses: GolfCourse[] = [];
  externalCourses: any[] = []; // Results from external API
  selectedCourse: GolfCourse | null = null;
  selectedHole: GolfHole | null = null;
  loading = false;
  searchMode: 'local' | 'online' = 'local';

  private searchSubject = new Subject<string>();

  constructor(
    private supabaseService: SupabaseService,
    private golfDataService: GolfDataService
  ) {
    // Debounce the search
    this.searchSubject.pipe(debounceTime(300)).subscribe(query => {
      this.performSearch(query);
    });
  }

  onSearchChange() {
    this.searchSubject.next(this.searchQuery);
  }

  setSearchMode(mode: 'local' | 'online') {
    this.searchMode = mode;
    this.performSearch(this.searchQuery);
  }

  async performSearch(query: string) {
    if (!query) {
      this.courses = [];
      this.externalCourses = [];
      return;
    }

    this.loading = true;
    this.selectedCourse = null;
    this.selectedHole = null;

    if (this.searchMode === 'local') {
      this.courses = await this.supabaseService.searchGolfCourses(query);
      this.externalCourses = [];
    } else {
      this.golfDataService.searchExternalCourses(query).subscribe({
        next: (results) => {
          this.externalCourses = results;
          this.courses = [];
          this.loading = false;
        },
        error: (err) => {
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
    const holes = await this.supabaseService.getGolfHolesByCourseId(course.id);
    this.selectedCourse = { ...course, holes };
    this.selectedHole = null;
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
          alert('Course imported successfully!');

          // Switch to local mode and show the new course
          this.searchMode = 'local';
          this.searchQuery = newCourse.name;
          this.performSearch(newCourse.name);
        } catch (err) {
          console.error('Import failed', err);
          alert('Failed to import course.');
        }
      }
      this.loading = false;
    });
  }
}
