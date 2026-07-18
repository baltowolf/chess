import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWebSocketUrl, AI_CONFIG } from './config';

describe('Config', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    vi.stubGlobal('location', {
      protocol: 'http:',
      host: 'localhost:3000'
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return ws protocol for http', () => {
    expect(getWebSocketUrl()).toBe('ws://localhost:3000/ws-chess');
  });

  it('should return wss protocol for https', () => {
    vi.stubGlobal('location', {
      protocol: 'https:',
      host: 'chess-academy.org'
    });
    expect(getWebSocketUrl()).toBe('wss://chess-academy.org/ws-chess');
  });

  it('should have correct AI_CONFIG values', () => {
    expect(AI_CONFIG.API_MODEL).toBe('gemini-2.5-flash');
    expect(AI_CONFIG.API_URL).toContain('generativelanguage.googleapis.com');
  });
});
