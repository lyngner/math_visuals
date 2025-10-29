import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SortingComponent } from './sorting.component';

describe('SortingComponent', () => {
  let component: SortingComponent;
  let fixture: ComponentFixture<SortingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [SortingComponent],
}).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SortingComponent);
    component = fixture.componentInstance;
    component.config = {
      direction: 'horizontal',
      randomized: true,
      items: {},
      order: [],
    };

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
