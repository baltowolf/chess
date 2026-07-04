import * as cmChessboard from 'cm-chessboard';
vi.mock('cm-chessboard', () => ({ Chessboard: vi.fn().mockImplementation(function() { return { destroy: vi.fn(), enableMoveInput: vi.fn(), setPosition: vi.fn() }; }), COLOR: { white: 'w', black: 'b' }, INPUT_EVENT_TYPE: {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Analysis } from './analysis';

describe('Analysis', () => {
  let component: Analysis;
  let fixture: ComponentFixture<Analysis>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Analysis],
    }).compileComponents();

    fixture = TestBed.createComponent(Analysis);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
