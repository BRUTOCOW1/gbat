import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateGolfBagComponent } from './create-golf-bag.component';

describe('CreateGolfBagComponent', () => {
  let component: CreateGolfBagComponent;
  let fixture: ComponentFixture<CreateGolfBagComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateGolfBagComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CreateGolfBagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
