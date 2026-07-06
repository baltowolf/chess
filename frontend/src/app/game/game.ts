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

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class Game implements OnInit, OnDestroy, AfterViewInit {
  @Input() settings: any;
  @Output() goBack = new EventEmitter<void>();
  @Output() analyze = new EventEmitter<any[]>();

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;

  game = new Chess();
  moveHistory: any[] = [];
  resigned = false;
  timeOut = false;
  timeOutSide = '';
  ws: WebSocket | null = null;

  boardTheme = 'default';
  showSettings = false;

  chessboard: any;
  INPUT_EVENT_TYPE: any;

  // Timers
  playerTime = 0;
  engineTime = 0;
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
      this.increment = isNaN(inc) ? 0 : inc;
    } else {
      this.playerTime = 600;
      this.engineTime = 600;
      this.increment = 0;
    }
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.ngZone.run(() => {
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
      });
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
    this.INPUT_EVENT_TYPE = INPUT_EVENT_TYPE;

    this.chessboard = new Chessboard(this.boardContainer.nativeElement, {
      position: this.game.fen(),
      assetsUrl: '/assets/',
      orientation: this.settings && this.settings.side === 'white' ? COLOR.white : COLOR.black,
      style: {
        cssClass: this.boardTheme,
        animationDuration: 300,
      },
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
      this.moveHistory.push({ ...result, fenAfter: this.game.fen() });

      this.updateCachedState();

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
      }

      if (!isEngine && !this.cachedIsGameOver) {
        this.requestEngineMove(this.game.fen());
      }

      this.cdr.detectChanges();

      return result;
    } catch {
      return null;
    }
  }

  resign() {
    this.resigned = true;
    this.updateCachedState();
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
