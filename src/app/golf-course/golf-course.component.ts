import { Component } from '@angular/core';
import { debounceTime, Subject } from 'rxjs';
import { SupabaseService } from '../services/supabase.service';
import { GolfCourse } from '../models/golf-course.model';
import { GolfHole } from '../models/golf-course.model';
@Component({
  selector: 'app-golf-course',
  templateUrl: './golf-course.component.html',
  styleUrls: ['./golf-course.component.css']
})
export class GolfCourseComponent {
  searchQuery = '';
  courses: GolfCourse[] = [];
  selectedCourse: GolfCourse | null = null;
  selectedHole: GolfHole | null = null;
  loading = false;

  private searchSubject = new Subject<string>();

  constructor(private supabaseService: SupabaseService) {
    // Debounce the search
    this.searchSubject.pipe(debounceTime(300)).subscribe(query => {
      this.searchCourses(query);
    });
  }

  onSearchChange() {
    this.searchSubject.next(this.searchQuery);
  }

  async searchCourses(query: string) {
    this.loading = true;
    this.courses = await this.supabaseService.searchGolfCourses(query);
    this.loading = false;
    this.selectedCourse = null;
    this.selectedHole = null;
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
}
