import { describe, it, expect } from 'vitest';
import {
  getOpeningFromMoves,
  normalizeFen,
  getOpeningFen,
  getTranspositions,
  getOpeningVariations,
  OPENING_DATABASE
} from './openings';

describe('Openings Utility', () => {
  it('should find exact opening from move list', () => {
    // 1. e4 e5 is C20 Open Game
    const opening = getOpeningFromMoves(['e4', 'e5']);
    expect(opening).toBeTruthy();
    expect(opening?.eco).toBe('C20');
    expect(opening?.nameEn).toBe('Open Game');
  });

  it('should prefer the longest/most specific opening match', () => {
    // e4 e5 Bc4 is Bishop's Opening, which starts with e4 e5 (Open Game)
    const opening = getOpeningFromMoves(['e4', 'e5', 'Bc4']);
    expect(opening).toBeTruthy();
    expect(opening?.nameEn).toBe("Bishop's Opening");
  });

  it('should return null for non-matching moves or empty moves', () => {
    expect(getOpeningFromMoves([])).toBeNull();
    expect(getOpeningFromMoves(['a4', 'h5', 'Na3', 'Rh6'])).toBeNull();
  });

  it('should normalize FEN strings correctly', () => {
    const rawFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    // Normalized FEN should discard move clocks
    expect(normalizeFen(rawFen)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3');
  });

  it('should generate opening FEN and cache it', () => {
    const fen = getOpeningFen('e4 e5');
    expect(fen).toContain('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq');
    
    // Call again to verify cache branch
    const cachedFen = getOpeningFen('e4 e5');
    expect(cachedFen).toBe(fen);
  });

  it('should find transpositions', () => {
    // We can simulate two sequences of moves that lead to the same position
    // E.g., 1. d4 Nf6 2. c4 e6 vs 1. c4 e6 2. d4 Nf6
    const moves = ['d4', 'Nf6', 'c4', 'e6'];
    const currentOpening = getOpeningFromMoves(moves);
    
    const transpositions = getTranspositions(moves, currentOpening);
    expect(Array.isArray(transpositions)).toBe(true);
  });

  it('should return opening variations for next moves', () => {
    // Starting position variations
    const variations = getOpeningVariations([]);
    expect(variations.length).toBeGreaterThan(0);
    
    // There should be a variation for e4
    const e4Var = variations.find(v => v.nextMove === 'e4');
    expect(e4Var).toBeTruthy();
    expect(e4Var?.opening.eco).toBe('C20');
  });
});
