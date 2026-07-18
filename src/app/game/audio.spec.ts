import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChessAudio } from './audio';

describe('ChessAudio', () => {
  let audio: ChessAudio;
  let mockOscillator: any;
  let mockGain: any;
  let mockAudioContext: any;

  beforeEach(() => {
    mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };

    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    };

    mockAudioContext = {
      currentTime: 10,
      state: 'suspended',
      resume: vi.fn(),
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGain),
      destination: {}
    };

    const MockAudioContext = function(this: any) {
      return mockAudioContext;
    };
    vi.stubGlobal('AudioContext', MockAudioContext);
    audio = new ChessAudio();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should play move sound effects', () => {
    audio.playMove();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
    expect(mockOscillator.stop).toHaveBeenCalled();
  });

  it('should play capture sound effects', () => {
    audio.playCapture();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
  });

  it('should play check sound effects', () => {
    audio.playCheck();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
  });

  it('should play blunder alert sound effects', () => {
    audio.playBlunderAlert();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
  });
});
