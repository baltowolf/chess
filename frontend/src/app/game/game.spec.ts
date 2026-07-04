import * as cmChessboard from 'cm-chessboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Game } from './game';

vi.mock('cm-chessboard', () => ({
  Chessboard: vi.fn().mockImplementation(function() {
    return { destroy: vi.fn(), enableMoveInput: vi.fn(), setPosition: vi.fn(), props: { style: { cssClass: '' } } };
  }),
  COLOR: { white: 'w', black: 'b' },
  INPUT_EVENT_TYPE: {}
}));

describe('Game', () => {
  let component: Game;
  let fixture: ComponentFixture<Game>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Game],
    }).compileComponents();

    fixture = TestBed.createComponent(Game);
    component = fixture.componentInstance;
    component.settings = { side: 'white', difficulty: 1500, timeControl: '10+0' };
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    if (component.timerInterval) {
      clearInterval(component.timerInterval);
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should parse time control correctly', () => {
    component.settings.timeControl = '5+3';
    component.parseTimeControl();
    expect(component.playerTime).toBe(300);
    expect(component.engineTime).toBe(300);
    expect(component.increment).toBe(3);
  });

  it('should add increment on move', () => {
    component.settings.timeControl = '5+3';
    component.parseTimeControl();
    component.moveHistory = [{}]; // mock a move
    component.makeAMove({ from: 'e2', to: 'e4' }, false);
    expect(component.playerTime).toBe(303);
  });

  it('should handle timeout', async () => {
    component.settings.timeControl = '0+0';
    component.parseTimeControl();
    component.playerTime = 1;

    // Instead of fakeAsync, let's just trigger the logic
    // The timer is started in ngOnInit, but we can clear it and simulate
    clearInterval(component.timerInterval);

    // mock isPlayerTurn
    vi.spyOn(component, 'isPlayerTurn').mockReturnValue(true);

    // call the interval callback logic directly if possible, or wait
    component.startTimer();

    await new Promise(resolve => setTimeout(resolve, 1100));

    expect(component.timeOut).toBe(true);
    expect(component.timeOutSide).toBe('Player');
  });
});
