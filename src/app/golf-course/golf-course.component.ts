import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { GolfCourse, GolfHole } from '../models/golf-course.model';

@Component({
  selector: 'app-golf-course',
  templateUrl: './golf-course.component.html',
  styleUrls: ['./golf-course.component.css']
})
export class GolfCourseComponent implements OnInit {
  searchQuery: string = '';
  courses: GolfCourse[] = [];
  selectedCourse: GolfCourse | null = null;
  selectedHole: GolfHole | null = null; // Tracks selected hole details

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit(): void {}

  async searchCourses() {
    if (this.searchQuery.trim() === '') return;
    this.courses = await this.supabaseService.searchGolfCourses(this.searchQuery);
  }

  async selectCourse(courseId: string) {
    this.selectedCourse = await this.supabaseService.getGolfCourseById(courseId);
    
    if (this.selectedCourse) {
      // Fetch holes for the selected course
      this.selectedCourse.holes = await this.supabaseService.getGolfHolesByCourseId(courseId);
    }
  }

  toggleHoleDetails(hole_number: number) {
    if (this.selectedCourse) {
      this.selectedHole = this.selectedCourse.holes.find(hole => hole.hole_number === hole_number) || null;
    }
  }
}
