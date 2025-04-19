import { Component } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';
import { GolfCourse } from '../models/golf-course.model';
import { GolfHole } from '../models/golf-course.model';
@Component({
  selector: 'app-course-builder',
  templateUrl: './course-builder.component.html',
  styleUrls: ['./course-builder.component.css']
})
export class CourseBuilderComponent {
  course: Partial<GolfCourse> = {
    name: '',
    location: '',
    rating: 0,
    slope: 0,
    par: 0
  };

  holes: GolfHole[] = [];

  saving = false;
  successMessage = '';
  errorMessage = '';

  constructor(private supabaseService: SupabaseService) {}

  addHole() {
    const nextHoleNumber = this.holes.length + 1;
    this.holes.push({
      id: crypto.randomUUID(),
      course_id: '',
      hole_number: nextHoleNumber,
      par: 4,
      tee_box_black: 400,
      handicap: 0
    });
  }

  removeHole(index: number) {
    this.holes.splice(index, 1);
  }

  async submitCourse() {
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    await this.supabaseService.insertGolfCourseWithHoles(this.course, this.holes);
    this.successMessage = 'Course created successfully!';
    
  }
}
