import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';
import { Router } from '@angular/router';

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

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    this.newRoundForm = this.fb.group({
      date_played: [new Date().toISOString().split('T')[0], Validators.required],
      course_id: ['', Validators.required],
      golfbag_id: ['', Validators.required]  // ✅ Add this field
    });
  }

  async ngOnInit() {
    const user = await this.supabaseService.getUser();
    if (user) {
      this.userId = user.id;
      await this.loadGolfBags();
      await this.loadGolfCourses();
    } else {
      console.warn('No user is authenticated.');
      this.router.navigate(['/']);
    }
  }

  async loadGolfBags() {
    if (!this.userId) return;
    const { data, error } = await this.supabaseService.getGolfBagsByUser(this.userId);
    if (!error && data) {
      this.golfBags = data;
    }
  }

  async loadGolfCourses() {
    const { data, error } = await this.supabaseService.getAllGolfCourses();
    if (!error && data) {
      this.golfCourses = data;
    }
  }

  async submitRound() {
    if (this.newRoundForm.invalid || !this.userId) return;
  
    const formValues = this.newRoundForm.value;
  
    const roundData = {
      user_id: this.userId,
      date_played: formValues.date_played,
      golfbag_id: formValues.golfbag_id,
      course_id: formValues.course_id,
    };
  
    const { data: roundInsert, error } = await this.supabaseService.createGolfRound(roundData);
  
    if (error || !roundInsert?.length) {
      console.error('Error creating round:', error);
      return;
    }
  
    const roundId = roundInsert[0].id;
  
    // 🔁 Get all 18 holes for the course
    const holes = await this.supabaseService.getGolfHolesByCourseId(formValues.course_id);
    if (!holes?.length) {
      console.warn('No holes found for course.');
      return;
    }
  
    // ⛳ Insert one played_golf_hole row per hole
    for (const hole of holes) {
      await this.supabaseService.createPlayedHole({
        round_id: roundId,
        hole_id: hole.id!,
        strokes: 0,
      });
    }
  
    // ✅ Navigate to hole 1
    this.router.navigate([`/golf-hole/1`], {
      state: {
        roundId,
        userId: this.userId,
        golfBagId: formValues.golfbag_id,
        courseId: formValues.course_id,
      }
    });
  }
  
}




// import { Component, OnInit } from '@angular/core';
// import { FormBuilder, FormGroup, Validators } from '@angular/forms';
// import { SupabaseService } from '../services/supabase.service';
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
