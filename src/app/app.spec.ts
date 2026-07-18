import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from './app';

describe('App', () => {
  let app: App;

  beforeEach(() => {
    app = new App();
  });

  it('should create the app', () => {
    expect(app).toBeTruthy();
    expect(app.gameState()).toBe('setup');
  });

  it('should handle start game and update settings', () => {
    const settings = { side: 'white', difficulty: 1500, timeControl: '10+0' };
    app.handleStartGame(settings);
    
    expect(app.gameSettings()).toEqual(settings);
    expect(app.gameState()).toBe('playing');
  });

  it('should handle transition to analysis with data', () => {
    const mockData = {
      history: [{ san: 'e4' }],
      depth: 10,
      precomputedEvaluations: [{ eval: 0.5 }],
      elo: 1600
    };

    app.handleAnalyze(mockData);

    expect(app.gameHistory()).toEqual(mockData.history);
    expect(app.analysisDepth()).toBe(10);
    expect(app.precomputedEvaluations()).toEqual(mockData.precomputedEvaluations);
    expect(app.gameElo()).toBe(1600);
    expect(app.gameState()).toBe('analysis');
  });

  it('should default gameElo to 1500 in handleAnalyze if not provided', () => {
    const mockData = {
      history: [],
      depth: 8,
      precomputedEvaluations: []
    };

    app.handleAnalyze(mockData);
    expect(app.gameElo()).toBe(1500);
  });

  it('should transition back to setup', () => {
    app.handleStartGame({ side: 'black' });
    expect(app.gameState()).toBe('playing');

    app.goBackToSetup();
    expect(app.gameState()).toBe('setup');
  });
});

