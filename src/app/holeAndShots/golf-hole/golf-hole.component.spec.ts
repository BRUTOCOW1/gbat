import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GolfHoleComponent } from './golf-hole.component';

describe('GolfHoleComponent', () => {
  let component: GolfHoleComponent;
  let fixture: ComponentFixture<GolfHoleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GolfHoleComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GolfHoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
