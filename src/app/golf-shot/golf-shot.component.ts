import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
@Component({
  selector: 'app-golf-shot',
  templateUrl: './golf-shot.component.html',
  styleUrl: './golf-shot.component.css'
})

export class GolfShotComponent {
  golfShotForm: FormGroup;

  constructor(private fb: FormBuilder) {
    // Initialize the form with form controls and their validators
    this.golfShotForm = this.fb.group({
      club: ['', Validators.required],
      distance: ['', [Validators.required, Validators.min(0)]],
      shotType: ['', Validators.required],
      wind: [''],
      lie: ['', Validators.required],
      notes: ['']
    });
  }

  onSubmit() {
    if (this.golfShotForm.valid) {
      console.log('Form Submitted:', this.golfShotForm.value);
      // Handle form submission, e.g., send data to server or display it
    } else {
      console.log('Form is invalid');
    }
  }

}