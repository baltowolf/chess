import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Analysis } from './analysis';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { vi } from 'vitest';

vi.mock('cm-chessboard', () => ({ Chessboard: vi.fn().mockImplementation(function() { return { destroy: vi.fn(), enableMoveInput: vi.fn(), setPosition: vi.fn() }; }), COLOR: { white: 'w', black: 'b' }, INPUT_EVENT_TYPE: {} }));

describe('Analysis', () => {
  let component: Analysis;
  let fixture: ComponentFixture<Analysis>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, LucideAngularModule, Analysis]
    }).compileComponents();

    fixture = TestBed.createComponent(Analysis);
    component = fixture.componentInstance;
    component.history = [
      { san: 'e4', fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' },
      { san: 'e5', fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
    ];
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize to the last move', () => {
    component.ngOnInit();
    expect(component.currentMoveIndex).toBe(1);
  });

  it('should navigate history correctly', () => {
    component.ngOnInit();
    expect(component.currentMoveIndex).toBe(1);

    component.goToPrev();
    expect(component.currentMoveIndex).toBe(0);

    component.goToPrev();
    expect(component.currentMoveIndex).toBe(-1);

    component.goToPrev();
    expect(component.currentMoveIndex).toBe(-1); // min boundary

    component.goToNext();
    expect(component.currentMoveIndex).toBe(0);

    component.goToEnd();
    expect(component.currentMoveIndex).toBe(1);

    component.goToStart();
    expect(component.currentMoveIndex).toBe(-1);
  });

  it('should determine correct fen and move details', () => {
    component.ngOnInit(); // index = 1 (e5)

    expect(component.getCurrentFen()).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(component.getPreviousFen()).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(component.getMoveNumber()).toBe(1);
    expect(component.getIsWhiteToMove()).toBe(true); // e5 is black's move (index 1)
  });
});
