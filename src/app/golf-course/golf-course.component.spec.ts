import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GolfCourseComponent } from './golf-course.component';

describe('GolfCourseComponent', () => {
  let component: GolfCourseComponent;
  let fixture: ComponentFixture<GolfCourseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GolfCourseComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GolfCourseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
