import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Game } from './game';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { vi } from 'vitest';

vi.mock('cm-chessboard', () => ({
  Chessboard: vi.fn().mockImplementation(function() {
    return {
      destroy: vi.fn(),
      enableMoveInput: vi.fn(),
      setPosition: vi.fn(),
      props: { style: { cssClass: 'default' } }
    };
  }),
  COLOR: { white: 'w', black: 'b' },
  INPUT_EVENT_TYPE: {}
}));

describe('Game Component', () => {
  let component: Game;
  let fixture: ComponentFixture<Game>;

  beforeEach(async () => {
    // Mock WebSocket globally for this test suite
    (window as any).WebSocket = class {
      readyState = 1;
      send = vi.fn();
      close = vi.fn();
    };

    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, Game]
    }).compileComponents();

    fixture = TestBed.createComponent(Game);
    component = fixture.componentInstance;
  });

  it('should initialize with correct time control', () => {
    component.settings = { side: 'white', difficulty: 1500, timeControl: '10+0' };
    fixture.detectChanges();
    component.ngOnInit();

    expect(component.playerTime).toBe(600);
    expect(component.engineTime).toBe(600);
    expect(component.increment).toBe(0);
    expect(component.cachedIsPlayerTurn).toBe(true);
    expect(component.cachedIsEngineTurn).toBe(false);
  });

  it('should toggle cached turns on makeAMove', () => {
    component.settings = { side: 'white', difficulty: 1500, timeControl: '10+0' };
    fixture.detectChanges();
    component.ngOnInit();

    expect(component.cachedIsPlayerTurn).toBe(true);

    // Player plays e4
    component.makeAMove({ from: 'e2', to: 'e4' }, false);

    expect(component.cachedIsPlayerTurn).toBe(false);
    expect(component.cachedIsEngineTurn).toBe(true);
  });

  it('should trigger game over on resign', () => {
    component.settings = { side: 'white', difficulty: 1500, timeControl: '10+0' };
    fixture.detectChanges();
    component.ngOnInit();

    component.resign();

    expect(component.resigned).toBe(true);
    expect(component.cachedIsGameOver).toBe(true);
  });
});
