import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-golf-shot',
  templateUrl: './golf-shot.component.html',
  styleUrls: ['./golf-shot.component.css'],
})
export class GolfShotComponent {
  golfShotForm: FormGroup;
  clubOptions: string[] = []; // Dynamic options for specific clubs

  constructor(private fb: FormBuilder) {
    this.golfShotForm = this.fb.group({
      club: ['', Validators.required],
      specificClub: [''], // Optional field for specific club selection
      distance: ['', [Validators.required, Validators.min(1)]],
      shotType: ['', Validators.required],
      wind: [''],
      lie: ['', Validators.required],
      notes: [''],
    });
  }

  onSubmit() {
    if (this.golfShotForm.valid) {
      console.log('Form Data:', this.golfShotForm.value);
      alert('Golf shot saved successfully!');
      this.golfShotForm.reset();
      this.clubOptions = []; // Clear specific club options after submission
    }
  }

  resetForm() {
    this.golfShotForm.reset();
    this.clubOptions = []; // Clear specific club options on reset
  }

  updateClubOptions() {
    const selectedClub = this.golfShotForm.get('club')?.value;

    switch (selectedClub) {
      case 'iron':
        this.clubOptions = ['3 Iron', '4 Iron', '5 Iron', '6 Iron', '7 Iron', '8 Iron', '9 Iron'];
        break;
      case 'wedge':
        this.clubOptions = ['Pitching Wedge', 'Gap Wedge', 'Sand Wedge', 'Lob Wedge'];
        break;
      default:
        this.clubOptions = []; // Clear options for clubs that don't need specifics
    }

    // Reset the specific club selection if the main club changes
    this.golfShotForm.get('specificClub')?.reset();
  }
}
