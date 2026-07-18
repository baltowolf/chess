import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Game } from './game';

vi.mock('cm-chessboard', () => ({
  Chessboard: vi.fn().mockImplementation(function() {
    return {
      destroy: vi.fn(),
      enableMoveInput: vi.fn(),
      setPosition: vi.fn()
    };
  }),
  COLOR: { white: 'w', black: 'b' },
  INPUT_EVENT_TYPE: {}
}));

describe('Game', () => {
  let component: Game;
  let cdrMock: any;
  let ngZoneMock: any;
  let mockWebSocket: any;

  beforeEach(() => {
    cdrMock = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    ngZoneMock = {
      run: (fn: any) => fn(),
      runOutsideAngular: (fn: any) => fn()
    };

    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      onmessage: null,
      onopen: null,
      onerror: null,
      onclose: null,
      readyState: 1 // OPEN
    };

    const MockWebSocket = function(this: any) {
      return mockWebSocket;
    };
    (MockWebSocket as any).OPEN = 1;
    vi.stubGlobal('WebSocket', MockWebSocket);

    component = new Game(cdrMock, ngZoneMock);
    component.settings = { side: 'white', difficulty: 1500, timeControl: '10+0' };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize timers based on settings', () => {
    component.settings = { side: 'white', difficulty: 1500, timeControl: '5+3' };
    component.ngOnInit();
    expect(component.playerTime).toBe(300);
    expect(component.engineTime).toBe(300);
    expect(component.increment).toBe(3);
  });

  it('should default to 10 minutes if no timeControl provided', () => {
    component.settings = { side: 'white', difficulty: 1500 };
    component.ngOnInit();
    expect(component.playerTime).toBe(600);
    expect(component.engineTime).toBe(600);
    expect(component.increment).toBe(0);
  });

  it('should format time correctly', () => {
    expect(component.formatTime(300)).toBe('5:00');
    expect(component.formatTime(65)).toBe('1:05');
    expect(component.formatTime(15)).toBe('0:15');
    expect(component.formatTime(0)).toBe('0:00');
  });

  it('should update state to game over on resign', () => {
    component.resign();
    expect(component.resigned).toBe(true);
    expect(component.cachedIsGameOver).toBe(true);
  });

  it('should correctly determine turns after moves', () => {
    component.ngOnInit(); // Sets initial states
    expect(component.cachedIsPlayerTurn).toBe(true); // White's turn initially, player is white

    component.makeAMove({ from: 'e2', to: 'e4' }, false);
    expect(component.cachedIsPlayerTurn).toBe(false);
    expect(component.cachedIsEngineTurn).toBe(true);

    component.makeAMove({ from: 'e7', to: 'e5' }, true);
    expect(component.cachedIsPlayerTurn).toBe(true);
    expect(component.cachedIsEngineTurn).toBe(false);
  });

  it('should detect checkmate', () => {
    // Scholar's mate
    component.game.load('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
    component.makeAMove({ from: 'h5', to: 'f7' }, false);
    expect(component.cachedIsCheckmate).toBe(true);
    expect(component.cachedIsGameOver).toBe(true);
  });

  describe('Tournament Mode', () => {
    beforeEach(() => {
      component.settings = { side: 'white', difficulty: 1500, timeControl: '10+0', tournamentMode: true };
      component.ngOnInit();
    });

    it('should disable engineOverlayEnabled on initialization', () => {
      expect(component.engineOverlayEnabled).toBe(false);
    });

    it('should prevent toggling engine overlay', () => {
      component.engineOverlayEnabled = false;
      component.toggleEngineOverlay();
      expect(component.engineOverlayEnabled).toBe(false);
    });

    it('should prevent undoMove from executing', () => {
      component.moveHistory = [{ from: 'e2', to: 'e4', san: 'e4', fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' }];
      component.undoMove();
      expect(component.moveHistory.length).toBe(1); // Length is unchanged
    });

    it('should not request evaluations after a move is made', () => {
      mockWebSocket.send.mockClear();
      component.makeAMove({ from: 'e2', to: 'e4' }, false);
      
      const calls = mockWebSocket.send.mock.calls;
      const evaluateCall = calls.find((c: any) => JSON.parse(c[0]).type === 'EVALUATE_MOVE');
      expect(evaluateCall).toBeUndefined();
    });
  });
});

