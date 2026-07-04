import * as cmChessboard from 'cm-chessboard';
vi.mock('cm-chessboard', () => ({ Chessboard: vi.fn().mockImplementation(function() { return { destroy: vi.fn(), enableMoveInput: vi.fn(), setPosition: vi.fn() }; }), COLOR: { white: 'w', black: 'b' }, INPUT_EVENT_TYPE: {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Game } from './game';

describe('Game', () => {
  let component: Game;
  let fixture: ComponentFixture<Game>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Game],
    }).compileComponents();

    fixture = TestBed.createComponent(Game);
    component = fixture.componentInstance;
    component.settings = { side: 'white', difficulty: 1500, timeControl: '10+0' }; // Provide default mock settings
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
