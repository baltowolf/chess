import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chess } from 'chess.js';
import { getWebSocketUrl } from '../../utils/config';
import { chessAudio } from './audio';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game.html',
})
export class Game implements OnInit, OnDestroy, AfterViewInit {
  @Input() settings: any;
  @Output() goBack = new EventEmitter<void>();
  @Output() analyze = new EventEmitter<{ history: any[], depth: number, precomputedEvaluations: any[], elo?: number }>();

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;
  @ViewChild('historyContainer', { static: false }) historyContainer!: ElementRef;

  game = new Chess();
  moveHistory: any[] = [];
  resigned = false;
  timeOut = false;
  timeOutSide = '';
  ws: WebSocket | null = null;

  boardTheme = 'default';
  showSettings = false;
  analysisDepth = 8;

  chessboard: any;
  INPUT_EVENT_TYPE: any;
  highlightMarkerType: any;

  // Cache evaluations for real-time analysis
  precomputedEvaluations: any[] = [];

  // Timers
  playerTime = 0;
  engineTime = 0;
  initialTime = 0;
  increment = 0;
  timerInterval: any;

  // Cached state for template binding performance
  // chess.js methods are too expensive for Angular change detection
  cachedIsPlayerTurn = false;
  cachedIsEngineTurn = false;
  cachedIsGameOver = false;
  cachedIsCheckmate = false;
  cachedIsDraw = false;

  ngOnInit() {
    this.parseTimeControl();
    this.updateCachedState(); // Initialize state
    
    // Default position evaluation
    this.precomputedEvaluations[0] = { eval: 0.33 };

    this.ws = new WebSocket(getWebSocketUrl());

    this.ws.onopen = () => {
      console.log('Connected to chess engine');
      if (
        this.settings.side === 'black' &&
        this.game.moveNumber() === 1 &&
        this.game.turn() === 'w'
      ) {
        this.requestEngineMove(this.game.fen());
      }
    };

    this.ws.onmessage = (event) => {
      this.ngZone.run(() => {
        const data = JSON.parse(event.data);
        if (data.type === 'ENGINE_MOVE') {
          const engineMove = data.move;

          const from = engineMove.substring(0, 2);
          const to = engineMove.substring(2, 4);

          const moveObj: { from: string; to: string; promotion?: string } = { from, to };
          if (engineMove.length > 4) {
            moveObj.promotion = engineMove.substring(4, 5);
          }

          this.makeAMove(moveObj, true);
        } else if (data.type === 'EVALUATION_RESULT') {
          this.precomputedEvaluations[data.index] = data.evaluation;
        }
        this.cdr.detectChanges();
      });
    };

    this.ngZone.runOutsideAngular(() => {
      this.startTimer();
    });
  }

  parseTimeControl() {
    // e.g., "10+0", "5+3"
    if (this.settings && this.settings.timeControl) {
      const parts = this.settings.timeControl.split('+');
      const minutes = parseInt(parts[0], 10);
      const inc = parseInt(parts[1], 10);

      const seconds = minutes * 60;
      this.playerTime = seconds;
      this.engineTime = seconds;
      this.initialTime = seconds;
      this.increment = isNaN(inc) ? 0 : inc;
    } else {
      this.playerTime = 600;
      this.engineTime = 600;
      this.initialTime = 600;
      this.increment = 0;
    }
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      // ⚡ Bolt: Removed ngZone.run() to prevent global Angular change detection on every tick.
      // We rely on local this.cdr.detectChanges() for better performance.
      if (this.cachedIsGameOver || this.timeOut) {
        clearInterval(this.timerInterval);
        return;
      }

      // Check whose turn it is and decrement
      if (this.cachedIsPlayerTurn) {
        this.playerTime--;
        if (this.playerTime <= 0) {
          this.playerTime = 0;
          this.timeOut = true;
          this.timeOutSide = 'Player';
          this.updateCachedState();
          clearInterval(this.timerInterval);
        }
      } else if (this.cachedIsEngineTurn) {
        this.engineTime--;
        if (this.engineTime <= 0) {
          this.engineTime = 0;
          this.timeOut = true;
          this.timeOutSide = 'Engine';
          this.updateCachedState();
          clearInterval(this.timerInterval);
        }
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }

  async ngAfterViewInit() {
    // Dynamically import cm-chessboard
    const { Chessboard, COLOR, INPUT_EVENT_TYPE } = await import('cm-chessboard');
    const { Markers } = await import('cm-chessboard/src/extensions/markers/Markers.js');
    this.INPUT_EVENT_TYPE = INPUT_EVENT_TYPE;
    this.highlightMarkerType = { class: "marker-highlight", slice: "markerSquare" };

    this.chessboard = new Chessboard(this.boardContainer.nativeElement, {
      position: this.game.fen(),
      assetsUrl: '/assets/',
      orientation: this.settings && this.settings.side === 'white' ? COLOR.white : COLOR.black,
      style: {
        cssClass: this.boardTheme,
        animationDuration: 300,
      },
      extensions: [{ class: Markers }],
    });

    this.chessboard.enableMoveInput((event: any) => {
      if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
        if (!this.cachedIsPlayerTurn) {
          return false; // prevent starting move if not player's turn
        }
        return true;
      }
      if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
        if (!this.cachedIsPlayerTurn) {
          return false; // prevent move visually
        }

        const move = { from: event.squareFrom, to: event.squareTo, promotion: 'q' };

        return this.ngZone.run(() => {
          // Let's validate the move with chess.js
          try {
            const result = this.makeAMove(move, false);

            if (result) {
              return true; // valid move
            }
          } catch {
            return false;
          }
          return false; // invalid move
        });
      }
      return true;
    });
  }

  ngOnDestroy() {
    if (this.ws) {
      this.ws.close();
    }
    if (this.chessboard) {
      this.chessboard.destroy();
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  requestEngineMove(currentFen: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'REQUEST_MOVE',
          fen: currentFen,
          difficulty: this.settings ? this.settings.difficulty : 1500,
        }),
      );
    }
  }

  updateCachedState() {
    // Calling chess.js methods in angular templates causes massive performance issues
    // because change detection evaluates them constantly.
    // By caching them here when a move happens, we keep performance snappy.

    const over = this.resigned || this.timeOut || this.game.isGameOver();
    this.cachedIsGameOver = over;
    this.cachedIsCheckmate = this.game.isCheckmate();
    this.cachedIsDraw = this.game.isDraw();

    if (over) {
      this.cachedIsPlayerTurn = false;
      this.cachedIsEngineTurn = false;
    } else {
      const turnW = this.game.turn() === 'w';
      const playerW = this.settings && this.settings.side === 'white';

      this.cachedIsPlayerTurn = (turnW && playerW) || (!turnW && !playerW);
      this.cachedIsEngineTurn = !this.cachedIsPlayerTurn;
    }
  }

  makeAMove(move: any, isEngine: boolean = false) {
    try {
      const result = this.game.move(move);
      const fenAfter = this.game.fen();
      this.moveHistory.push({ ...result, fenAfter });

      // Request evaluation for this move if we aren't game over
      const currentIndex = this.moveHistory.length; // because DEFAULT_POSITION is index 0 in analysis
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
           type: 'EVALUATE_MOVE',
           fen: fenAfter,
           index: currentIndex,
           depth: this.analysisDepth
        }));
      }

      this.updateCachedState();

      // Play audio feedback
      if (this.cachedIsCheckmate || this.game.isCheck()) {
        chessAudio.playCheck();
      } else if (result.captured) {
        chessAudio.playCapture();
      } else {
        chessAudio.playMove();
      }

      // Add increment
      if (this.moveHistory.length > (this.settings && this.settings.side === 'black' ? 1 : 0)) {
        if (isEngine) {
          this.engineTime += this.increment;
        } else {
          this.playerTime += this.increment;
        }
      }

      if (this.chessboard) {
        this.chessboard.setPosition(this.game.fen(), isEngine);
        if (this.highlightMarkerType) {
          this.chessboard.removeMarkers(this.highlightMarkerType);
          this.chessboard.addMarker(this.highlightMarkerType, result.from);
          this.chessboard.addMarker(this.highlightMarkerType, result.to);
        }
      }

      if (!isEngine && !this.cachedIsGameOver) {
        this.requestEngineMove(this.game.fen());
      }

      this.cdr.detectChanges();
      this.scrollToBottom();

      return result;
    } catch {
      return null;
    }
  }

  getGameResult(): string {
    if (!this.cachedIsGameOver) {
      return '*';
    }
    if (this.resigned) {
      const playerW = this.settings && this.settings.side === 'white';
      return playerW ? '0-1' : '1-0';
    }
    if (this.timeOut) {
      return this.timeOutSide === 'Player' 
        ? (this.settings.side === 'white' ? '0-1' : '1-0')
        : (this.settings.side === 'white' ? '1-0' : '0-1');
    }
    if (this.cachedIsCheckmate) {
      const turnW = this.game.turn() === 'w';
      return turnW ? '0-1' : '1-0';
    }
    if (this.cachedIsDraw) {
      return '½-½';
    }
    return '*';
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.historyContainer) {
        const el = this.historyContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  resign() {
    this.resigned = true;
    this.updateCachedState();
  }

  // ⚡ Bolt: trackBy function for moveHistory *ngFor loop to improve rendering performance
  trackMove(index: number, move: any) {
    // If move has a fenAfter it's unique, otherwise fallback to index
    return move.fenAfter || index;
  }

  onThemeChange() {
    if (this.chessboard) {
      this.chessboard.props.style.cssClass = this.boardTheme;
      const svg = this.boardContainer.nativeElement.querySelector('svg');
      if (svg) {
        let classes = svg.getAttribute('class') || '';
        classes = classes.replace(/default|green|blue|chess-club|chessboard-js|black-and-white/g, '').trim();
        svg.setAttribute('class', classes + ' ' + this.boardTheme);
      }
    }
  }
}
