import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Game } from './game';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { vi } from 'vitest';

vi.mock('cm-chessboard', () => ({ Chessboard: vi.fn().mockImplementation(function() { return { destroy: vi.fn(), enableMoveInput: vi.fn(), setPosition: vi.fn() }; }), COLOR: { white: 'w', black: 'b' }, INPUT_EVENT_TYPE: {} }));

describe('Game', () => {
  let component: Game;
  let fixture: ComponentFixture<Game>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, Game]
    }).compileComponents();

    fixture = TestBed.createComponent(Game);
    component = fixture.componentInstance;
    component.settings = { side: 'white', difficulty: 1500, timeControl: '10+0' };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
