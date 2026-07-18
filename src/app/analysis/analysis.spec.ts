import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Analysis } from './analysis';

describe('Analysis', () => {
  let component: Analysis;
  let cdrMock: any;
  let ngZoneMock: any;
  let sanitizerMock: any;

  beforeEach(() => {
    cdrMock = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    ngZoneMock = { run: (fn: any) => fn(), runOutsideAngular: (fn: any) => fn() };
    sanitizerMock = { bypassSecurityTrustHtml: (val: string) => val };

    component = new Analysis(cdrMock, ngZoneMock, sanitizerMock);
    component.ArrowTypeExt = {
      success: 'success',
      secondary: 'secondary',
      danger: 'danger',
      warning: 'warning'
    };
    
    // Stub requestFullAnalysis to prevent network/WS activity
    vi.spyOn(component, 'requestFullAnalysis').mockImplementation(() => {});
    // Stub updateBoard to prevent DOM/Chessboard interaction in basic tests
    vi.spyOn(component, 'updateBoard').mockImplementation(() => {});

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
    expect(component.requestFullAnalysis).toHaveBeenCalled();
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

  it('should determine correct FEN and move details', () => {
    component.ngOnInit(); // index = 1 (e5)

    expect(component.getCurrentFen()).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(component.getPreviousFen()).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(component.getMoveNumber()).toBe(1);
    expect(component.getIsWhiteToMove()).toBe(false); // e5 is black's move (index 1)
  });

  it('should handle goToStart when history is empty', () => {
    component.history = [];
    component.ngOnInit();
    expect(component.currentMoveIndex).toBe(-1);
    expect(component.getCurrentFen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('should change depth and clear evaluations', () => {
    component.evaluations = [{ eval: 0.1 }];
    component.explanation = 'old explanation';
    
    component.onDepthChange();
    
    expect(component.precomputedEvaluations).toEqual([]);
    expect(component.evaluations).toEqual([]);
    expect(component.explanation).toBe('');
    expect(component.requestFullAnalysis).toHaveBeenCalled();
  });

  it('should return correct move classifications based on eval shifts', () => {
    component.evaluations = [
      { eval: '0.3' }, // start (white)
      { eval: '-1.8' }, // black blunder or white blunder? wait, move index 0 is white's move. eval shift: -1.8 - 0.3 = -2.1. White loss: 2.1 (blunder)
      { eval: '-1.0' }, // move 1 is black's move. before: -1.8. after: -1.0. eval shift: -1.0 - (-1.8) = +0.8. Black loss: -0.8. no loss
    ];

    // White blunder
    expect(component.getMoveClassification(0)).toBe('blunder');
  });

  it('should handle keyboard navigation if not in an input field', () => {
    component.currentMoveIndex = 0;
    
    // Left arrow
    component.handleKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn(), target: { tagName: 'DIV' } } as any);
    expect(component.currentMoveIndex).toBe(-1);

    // Right arrow
    component.handleKeyDown({ key: 'ArrowRight', preventDefault: vi.fn(), target: { tagName: 'DIV' } } as any);
    expect(component.currentMoveIndex).toBe(0);
  });

  it('should NOT handle keyboard navigation if focused on input or textarea', () => {
    component.currentMoveIndex = 0;
    
    component.handleKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn(), target: { tagName: 'INPUT' } } as any);
    expect(component.currentMoveIndex).toBe(0); // unchanged

    component.handleKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn(), target: { tagName: 'TEXTAREA' } } as any);
    expect(component.currentMoveIndex).toBe(0); // unchanged
  });

  it('should parse and highlight coordinates correctly in both English and Russian', () => {
    const textHtml = '<div>Ход е4 ведет к центру, а d5 контратакует. Также проверим с5 и ф3 и х6.</div>';
    const highlighted = component.highlightCoordinatesInHtml(textHtml);
    expect(highlighted).toContain('href="#square-e4"');
    expect(highlighted).toContain('href="#square-d5"');
    expect(highlighted).toContain('href="#square-c5"');
    expect(highlighted).toContain('href="#square-f3"');
    expect(highlighted).toContain('href="#square-h6"');
  });

  it('should handle PV move preview toggle and checking if active', () => {
    const pv = { move: 'e2e4', san: 'e4' };
    component.currentMoveIndex = -1; // starting position
    
    expect(component.isPvPreviewed(pv)).toBe(false);

    // Turn on preview
    component.previewPvMove(pv);
    expect(component.previewFen).toBeTruthy();
    expect(component.previewArrow).toEqual({ from: 'e2', to: 'e4', color: 'success' });
    expect(component.isPvPreviewed(pv)).toBe(true);

    // Turn off preview by calling it again
    component.previewPvMove(pv);
    expect(component.previewFen).toBeNull();
    expect(component.previewArrow).toBeNull();
    expect(component.isPvPreviewed(pv)).toBe(false);
  });

  it('should background prefetch error explanations and cache them', async () => {
    // Mock fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ explanation: 'This is a blunder analysis.' })
    } as any);

    component.history = [
      { san: 'e4', fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' },
      { san: 'g5', fenAfter: 'rnbqkbnr/pppppp1p/8/6p1/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
    ];
    component.evaluations = [
      { eval: '0.3' }, // start
      { eval: '0.3' }, // e4
      { eval: '3.0' }  // g5 is a blunder for black (eval goes from 0.3 to 3.0, white winning)
    ];

    component.explanationCache.clear();
    await component.prefetchErrorExplanations();

    // Check that we attempted to prefetch the error move
    expect(fetchSpy).toHaveBeenCalled();
    expect(component.explanationCache.size).toBeGreaterThanOrEqual(1);

    fetchSpy.mockRestore();
  });
});

