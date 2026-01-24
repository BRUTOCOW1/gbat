import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../shared/services/notification.service';
import { GolfHole } from '../../shared/models/golf-course.model';

@Component({
  selector: 'app-new-round',
  templateUrl: './new-round.component.html',
  styleUrls: ['./new-round.component.css'],
})
export class NewRoundComponent implements OnInit {
  newRoundForm: FormGroup;
  golfBags: any[] = [];
  golfCourses: any[] = [];
  userId: string | null = null;
  loading = false;
  selectedCourse: any = null;
  courseHoles: GolfHole[] = [];
  availableTees: { key: string; label: string; totalYards: number }[] = [];
  loadingCourseDetails = false;

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private router: Router,
    private notificationService: NotificationService
  ) {
    this.newRoundForm = this.fb.group({
      date_played: [new Date().toISOString().split('T')[0], Validators.required],
      tee_time: [''],
      course_id: ['', Validators.required],
      golfbag_id: ['', Validators.required],
      tee_box: ['']
    });
  }

  async ngOnInit() {
    const user = await this.supabaseService.getUser();
    if (user) {
      this.userId = user.id;
      await this.loadGolfBags();
      await this.loadGolfCourses();
    } else {
      this.notificationService.showWarning('Please log in to start a new round.');
      this.router.navigate(['/']);
    }
  }

  async loadGolfBags() {
    if (!this.userId) return;
    const { data, error } = await this.supabaseService.getGolfBagsByUser(this.userId);
    if (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading golf bags: ${errorMsg}`);
      return;
    }
    if (data) {
      this.golfBags = data;
      if (this.golfBags.length === 0) {
        this.notificationService.showInfo('No golf bags found. Create a bag first!');
      }
    }
  }

  async loadGolfCourses() {
    // Load all available courses for selection
    const { data, error } = await this.supabaseService.getAllGolfCourses();
    if (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading courses: ${errorMsg}`);
      return;
    }
    if (data) {
      this.golfCourses = data;
      if (this.golfCourses.length === 0) {
        this.notificationService.showInfo('No courses found. Create a course first!');
      }
    }
  }

  async onCourseSelected() {
    const courseId = this.newRoundForm.get('course_id')?.value;
    if (!courseId) {
      this.selectedCourse = null;
      this.courseHoles = [];
      this.availableTees = [];
      this.newRoundForm.patchValue({ tee_box: '' });
      return;
    }

    // Find the selected course
    this.selectedCourse = this.golfCourses.find(c => c.id === courseId);
    
    // Load course holes to determine available tees
    this.loadingCourseDetails = true;
    try {
      this.courseHoles = await this.supabaseService.getGolfHolesByCourseId(courseId);
      if (this.courseHoles.length === 0) {
        this.notificationService.showWarning('This course has no holes defined. You may need to add hole information first.');
      }
      this.determineAvailableTees();
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Error loading course details: ${errorMsg}`);
      this.courseHoles = [];
      this.availableTees = [];
    } finally {
      this.loadingCourseDetails = false;
    }
  }

  private determineAvailableTees() {
    const teeMap = new Map<string, { label: string; totalYards: number; count: number }>();
    
    // Check each hole for available tee boxes
    this.courseHoles.forEach(hole => {
      if (hole.tee_box_black) {
        const existing = teeMap.get('black') || { label: 'Black', totalYards: 0, count: 0 };
        existing.totalYards += hole.tee_box_black;
        existing.count++;
        teeMap.set('black', existing);
      }
      if (hole.tee_box_blue) {
        const existing = teeMap.get('blue') || { label: 'Blue', totalYards: 0, count: 0 };
        existing.totalYards += hole.tee_box_blue;
        existing.count++;
        teeMap.set('blue', existing);
      }
      if (hole.tee_box_white) {
        const existing = teeMap.get('white') || { label: 'White', totalYards: 0, count: 0 };
        existing.totalYards += hole.tee_box_white;
        existing.count++;
        teeMap.set('white', existing);
      }
      if (hole.tee_box_red) {
        const existing = teeMap.get('red') || { label: 'Red', totalYards: 0, count: 0 };
        existing.totalYards += hole.tee_box_red;
        existing.count++;
        teeMap.set('red', existing);
      }
    });

    // Convert to array and only include tees that have data for all holes
    this.availableTees = Array.from(teeMap.entries())
      .filter(([_, data]) => data.count === this.courseHoles.length)
      .map(([key, data]) => ({
        key,
        label: data.label,
        totalYards: data.totalYards
      }))
      .sort((a, b) => b.totalYards - a.totalYards); // Sort by yardage (longest first)

    // If no tees are available for all holes, show partial tees
    if (this.availableTees.length === 0) {
      this.availableTees = Array.from(teeMap.entries())
        .map(([key, data]) => ({
          key,
          label: data.label,
          totalYards: data.totalYards
        }))
        .sort((a, b) => b.totalYards - a.totalYards);
    }

    // Update validation: require tee_box only if tees are available
    const teeBoxControl = this.newRoundForm.get('tee_box');
    if (this.availableTees.length > 0) {
      teeBoxControl?.setValidators([Validators.required]);
    } else {
      teeBoxControl?.clearValidators();
    }
    teeBoxControl?.updateValueAndValidity();

    // Reset tee selection if current selection is not available
    const currentTee = this.newRoundForm.get('tee_box')?.value;
    if (currentTee && !this.availableTees.find(t => t.key === currentTee)) {
      this.newRoundForm.patchValue({ tee_box: '' });
    }
  }

  get coursePar(): number {
    if (!this.courseHoles.length) return 0;
    return this.courseHoles.reduce((sum, hole) => sum + (hole.par || 0), 0);
  }

  get selectedTeeInfo() {
    const teeBox = this.newRoundForm.get('tee_box')?.value;
    return this.availableTees.find(t => t.key === teeBox);
  }

  async submitRound() {
    if (this.newRoundForm.invalid) {
      this.notificationService.showWarning('Please fill in all required fields.');
      // Mark all fields as touched to show validation errors
      Object.keys(this.newRoundForm.controls).forEach(key => {
        this.newRoundForm.get(key)?.markAsTouched();
      });
      return;
    }
    if (!this.userId) {
      this.notificationService.showError('You must be logged in to start a round.');
      return;
    }
  
    this.loading = true;
    const formValues = this.newRoundForm.value;
  
    const roundData = {
      user_id: this.userId,
      date_played: formValues.date_played,
      tee_time: formValues.tee_time || null,
      golfbag_id: formValues.golfbag_id,
      course_id: formValues.course_id,
      tee_box: formValues.tee_box || null,
    };
  
    try {
      const { data: roundInsert, error } = await this.supabaseService.createGolfRound(roundData);
      if (error || !roundInsert?.length) {
        const errorMsg = this.notificationService.getErrorMessage(error);
        this.notificationService.showError(`Failed to create round: ${errorMsg}`);
        console.error('Error creating round:', error);
        return;
      }
  
      const roundId = roundInsert[0].id;
      this.notificationService.showSuccess('Round started! Let\'s play!');
  
      // ✅ go straight to hole 1; create played_golf_hole later (on first shot)
      this.router.navigate([`/golf-hole/1`], {
        state: {
          roundId,
          userId: this.userId,
          golfBagId: formValues.golfbag_id,
          courseId: formValues.course_id,
          teeBox: formValues.tee_box,
        }
      });
    } catch (error) {
      const errorMsg = this.notificationService.getErrorMessage(error);
      this.notificationService.showError(`Unexpected error: ${errorMsg}`);
    } finally {
      this.loading = false;
    }
  }
  
  
}




// import { Component, OnInit } from '@angular/core';
// import { FormBuilder, FormGroup, Validators } from '@angular/forms';
// import { SupabaseService } from '../../services/supabase.service';
// import { Router } from '@angular/router';

// @Component({
//   selector: 'app-new-round',
//   templateUrl: './new-round.component.html',
//   styleUrls: ['./new-round.component.css'],
// })
// export class NewRoundComponent implements OnInit {
//   newRoundForm: FormGroup;
//   golfBags: any[] = [];
//   golfCourses: any[] = [];
//   userId: string | null = null;
//   selectedGolfBagId: string | null = null;
//   loading = false;

//   constructor(
//     private fb: FormBuilder,
//     private supabaseService: SupabaseService,
//     private router: Router
//   ) {
//     this.newRoundForm = this.fb.group({
//       date_played: [new Date().toISOString().split('T')[0], Validators.required],
//       course_id: ['', Validators.required],
//     });
//   }

//   async ngOnInit() {
//     const user = await this.supabaseService.getCurrentUser();
//     if (user) {
//       this.userId = user.id;
//       await this.loadGolfBags();
//       await this.loadGolfCourses();
//     } else {
//       console.warn('No user is authenticated.');
//       this.router.navigate(['/']);
//     }
//   }

//   async loadGolfBags() {
//     if (!this.userId) return;
//     const { data, error } = await this.supabaseService.getGolfBagsByUser(this.userId);
//     if (!error && data) {
//       this.golfBags = data;
//     }
//   }

//   async loadGolfCourses() {
//     const { data, error } = await this.supabaseService.getAllGolfCourses();
//     if (!error && data) {
//       this.golfCourses = data;
//     }
//   }

//   async submitRound() {
//     if (this.newRoundForm.invalid || !this.selectedGolfBagId) return;
  
//     const roundData = {
//       user_id: this.userId!,
//       golf_bag_id: this.selectedGolfBagId,
//       ...this.newRoundForm.value,
//     };
  
//     const { data, error } = await this.supabaseService.createGolfRound(roundData);
  
//     if (!error && data && data.length > 0) {
//       const newRoundId = data[0].id;
  
//       this.router.navigate([`/golf-hole/${newRoundId}`], {
//         state: { userId: this.userId, golfBagId: this.selectedGolfBagId }
//       });
//     } else {
//       console.error('Error creating round:', error);
//     }
//   }
  
  
// }
