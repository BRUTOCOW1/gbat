
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-round',
  templateUrl: './round.component.html',
  styleUrl: './round.component.css'
})
export class RoundComponent implements OnInit {
  golfForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.golfForm = this.fb.group({
      date: ['', Validators.required],
      courseName: ['', Validators.required],
      totalStrokes: ['', [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
  }

  onSubmit(): void {
    if (this.golfForm.valid) {
      const formData = this.golfForm.value;
      console.log('Golf Round Submitted:', formData);
      // Handle form submission logic here
    } else {
      console.log('Form is not valid');
    }
  }
}
