import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GolfShotComponent } from './golf-shot.component';

describe('GolfShotComponent', () => {
  let component: GolfShotComponent;
  let fixture: ComponentFixture<GolfShotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GolfShotComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GolfShotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
