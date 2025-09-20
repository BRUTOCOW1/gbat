import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GolfBagComponent } from './golf-bag.component';

describe('GolfBagComponent', () => {
  let component: GolfBagComponent;
  let fixture: ComponentFixture<GolfBagComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GolfBagComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GolfBagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
