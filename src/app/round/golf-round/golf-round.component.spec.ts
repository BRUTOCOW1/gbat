import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GolfRoundComponent } from './golf-round.component';

describe('GolfRoundComponent', () => {
  let component: GolfRoundComponent;
  let fixture: ComponentFixture<GolfRoundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GolfRoundComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GolfRoundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
