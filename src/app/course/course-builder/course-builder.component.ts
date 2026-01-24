import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { GolfCourse } from '../../shared/models/golf-course.model';
import { GolfHole } from '../../shared/models/golf-course.model';
import { NotificationService } from '../../shared/services/notification.service';

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

  constructor(
    private supabaseService: SupabaseService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  get totalPar(): number {
    return this.holes.reduce((sum, hole) => sum + (hole.par || 0), 0);
  }

  get holeCount(): number {
    return this.holes.length;
  }

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
    this.updateCoursePar();
  }

  add18Holes() {
    if (this.holes.length > 0) {
      if (!confirm('This will add 18 holes. Existing holes will be kept. Continue?')) {
        return;
      }
    }
    
    const startNumber = this.holes.length + 1;
    for (let i = 0; i < 18; i++) {
      const holeNumber = startNumber + i;
      this.holes.push({
        id: crypto.randomUUID(),
        course_id: '',
        hole_number: holeNumber,
        par: 4,
        tee_box_black: 400,
        handicap: 0
      });
    }
    this.updateCoursePar();
  }

  removeHole(index: number) {
    this.holes.splice(index, 1);
    // Renumber holes
    this.holes.forEach((hole, i) => {
      hole.hole_number = i + 1;
    });
    this.updateCoursePar();
  }

  updateCoursePar() {
    this.course.par = this.totalPar;
  }

  onHoleParChange() {
    this.updateCoursePar();
  }

  validateForm(): boolean {
    if (!this.course.name || this.course.name.trim() === '') {
      this.errorMessage = 'Course name is required';
      this.notificationService.showWarning('Course name is required');
      return false;
    }

    if (!this.course.location || this.course.location.trim() === '') {
      this.errorMessage = 'Course location is required';
      this.notificationService.showWarning('Course location is required');
      return false;
    }

    if (this.holes.length === 0) {
      this.errorMessage = 'Please add at least one hole';
      this.notificationService.showWarning('Please add at least one hole to the course.');
      return false;
    }

    // Validate each hole has required fields
    for (let i = 0; i < this.holes.length; i++) {
      const hole = this.holes[i];
      if (!hole.par || hole.par < 3 || hole.par > 5) {
        this.errorMessage = `Hole ${i + 1} must have a valid par (3-5)`;
        this.notificationService.showWarning(`Hole ${i + 1} must have a valid par (3-5)`);
        return false;
      }
    }

    return true;
  }

  async submitCourse() {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.validateForm()) {
      return;
    }

    this.saving = true;

    try {
      const newCourse = await this.supabaseService.insertGolfCourseWithHoles(this.course, this.holes);
      this.successMessage = 'Course created successfully!';
      this.notificationService.showSuccess(`Course "${newCourse.name}" created successfully!`);
      
      // Reset form and navigate after a delay
      setTimeout(() => {
        this.resetForm();
        // Redirect to new-round so user can select the newly created course
        this.router.navigate(['/new-round']);
      }, 2000);
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.errorMessage = errorMsg;
      this.notificationService.showError(`Failed to create course: ${errorMsg}`);
    } finally {
      this.saving = false;
    }
  }

  resetForm() {
    this.course = {
      name: '',
      location: '',
      rating: 0,
      slope: 0,
      par: 0
    };
    this.holes = [];
    this.successMessage = '';
    this.errorMessage = '';
  }
}
