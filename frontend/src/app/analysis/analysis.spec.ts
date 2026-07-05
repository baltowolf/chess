import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Analysis } from './analysis';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { vi } from 'vitest';

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

describe('Analysis Component', () => {
  let component: Analysis;
  let fixture: ComponentFixture<Analysis>;
  let mockWsInstance: any;

  beforeEach(async () => {
    mockWsInstance = {
      send: vi.fn(),
      close: vi.fn()
    };

    (window as any).WebSocket = class {
      send = mockWsInstance.send;
      close = mockWsInstance.close;
      readyState = 1;
      onopen: any;
      onmessage: any;
      onerror: any;
      constructor() {
        mockWsInstance.onopen = (cb: any) => this.onopen = cb;
        mockWsInstance.onmessage = (cb: any) => this.onmessage = cb;
        mockWsInstance.onerror = (cb: any) => this.onerror = cb;
        mockWsInstance.instance = this;
      }
    };

    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, LucideAngularModule, Analysis]
    }).compileComponents();

    fixture = TestBed.createComponent(Analysis);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch explanation on start', () => {
    component.history = [{ san: 'e4', fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' }];
    fixture.detectChanges(); // Triggers ngOnInit

    expect(component.isLoading).toBe(true);

    // Simulate websocket connection open
    if (mockWsInstance.instance.onopen) {
      mockWsInstance.instance.onopen();
    }

    expect(mockWsInstance.send).toHaveBeenCalled();
    const sentData = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
    expect(sentData.type).toBe('ANALYZE_MOVE');
    expect(sentData.move).toBe('e4');
  });

  it('should update explanation on websocket message', () => {
    component.history = [{ san: 'e4', fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' }];
    fixture.detectChanges();

    component.isLoading = true;
    component.explanation = '';

    if (mockWsInstance.instance.onmessage) {
      mockWsInstance.instance.onmessage({
        data: JSON.stringify({
          type: 'ANALYSIS_RESULT',
          explanation: 'Good move controlling the center.'
        })
      });
    }

    expect(component.isLoading).toBe(false);
    expect(component.explanation).toBe('Good move controlling the center.');
  });
});
