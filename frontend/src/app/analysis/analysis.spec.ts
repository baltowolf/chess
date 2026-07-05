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
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
