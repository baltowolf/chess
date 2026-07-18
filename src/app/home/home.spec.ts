import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Home } from './home';

describe('Home', () => {
  let component: Home;

  beforeEach(() => {
    component = new Home();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set activeTab', () => {
    expect(component.activeTab).toBe('play');
    component.activeTab = 'import';
    expect(component.activeTab).toBe('import');
  });

  it('should get and set side', () => {
    expect(component.side).toBe('white');
    component.setSide('black');
    expect(component.side).toBe('black');
  });

  it('should convert skill level to Elo and back', () => {
    expect(component.getEloForSkillLevel(1)).toBe(800);
    expect(component.getEloForSkillLevel(8)).toBe(1500);
    expect(component.getEloForSkillLevel(20)).toBe(3200);

    expect(component.getSkillLevelForElo(800)).toBe(1);
    expect(component.getSkillLevelForElo(1500)).toBe(8);
    expect(component.getSkillLevelForElo(3200)).toBe(20);
  });

  it('should sync difficulty and skill level', () => {
    component.skillLevel = 8;
    component.onSkillLevelChange();
    expect(component.difficulty).toBe(1500);

    component.difficulty = 800;
    component.onDifficultyChange();
    expect(component.skillLevel).toBe(1);
  });

  it('should load sample PGN', () => {
    component.loadSamplePgn();
    expect(component.pgnText).toContain('Paul Morphy');
    expect(component.pgnError).toBe('');
  });

  it('should emit startGame event with selected settings', () => {
    let emittedData: any = null;
    component.startGame.subscribe((data) => {
      emittedData = data;
    });

    component.side = 'white';
    component.difficulty = 1500;
    component.skillLevel = 8;
    component.timeControl = '10+0';
    component.tournamentMode = false;

    component.handleStart();

    expect(emittedData).toEqual({
      difficulty: 1500,
      skillLevel: 8,
      side: 'white',
      timeControl: '10+0',
      tournamentMode: false
    });
  });

  it('should emit startGame event with tournamentMode enabled', () => {
    let emittedData: any = null;
    component.startGame.subscribe((data) => {
      emittedData = data;
    });

    component.side = 'black';
    component.difficulty = 1800;
    component.skillLevel = 11;
    component.timeControl = '5+3';
    component.tournamentMode = true;

    component.handleStart();

    expect(emittedData).toEqual({
      difficulty: 1800,
      skillLevel: 11,
      side: 'black',
      timeControl: '5+3',
      tournamentMode: true
    });
  });

  it('should resolve random side to white or black on handleStart', () => {
    let emittedData: any = null;
    component.startGame.subscribe((data) => {
      emittedData = data;
    });

    component.side = 'random';
    component.handleStart();

    expect(emittedData.side).toMatch(/white|black/);
  });

  it('should validate PGN on importPgn', () => {
    component.pgnText = '';
    component.importPgn();
    expect(component.pgnError).toBe('Please paste a valid PGN string.');
  });

  it('should parse valid PGN and emit analyzeGame', () => {
    let emittedData: any = null;
    component.analyzeGame.subscribe((data) => {
      emittedData = data;
    });

    component.loadSamplePgn();
    component.importPgn();

    expect(component.pgnError).toBe('');
    expect(emittedData).toBeTruthy();
    expect(emittedData.history.length).toBeGreaterThan(0);
    expect(emittedData.history[0].san).toBe('e4');
  });

  it('should display error for invalid PGN', () => {
    component.pgnText = 'invalid-pgn-text-random';
    component.importPgn();
    expect(component.pgnError).toContain('Error parsing PGN');
  });
});

