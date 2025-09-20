import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GolfShotEntryComponent } from './golf-shot-entry.component';

describe('GolfShotComponent', () => {
  let component: GolfShotEntryComponent;
  let fixture: ComponentFixture<GolfShotEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GolfShotEntryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GolfShotEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
