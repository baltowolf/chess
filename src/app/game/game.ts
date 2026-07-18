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
import { getOpeningFromMoves, ChessOpening, getOpeningVariations, getTranspositions, OpeningVariation } from '../../utils/openings';
import { animateCapture } from '../../utils/animations';
import { language } from '../language';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game.html',
  host: {
    '(window:keydown)': 'handleKeyDown($event)'
  }
})
export class Game implements OnInit, OnDestroy, AfterViewInit {
  @Input() settings: any;
  @Output() goBack = new EventEmitter<void>();
  @Output() analyze = new EventEmitter<{ history: any[], depth: number, precomputedEvaluations: any[], elo?: number }>();
  lang = language;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;
  @ViewChild('historyContainer', { static: false }) historyContainer!: ElementRef;

  readonly Math = Math;
  currentMoveIndex = -1;

  game = new Chess();
  moveHistory: any[] = [];
  lastMoveTime: number = Date.now();
  currentOpening: ChessOpening | null = null;
  resigned = false;
  timeOut = false;
  timeOutSide = '';
  ws: WebSocket | null = null;

  boardTheme = 'default';
  showSettings = false;
  analysisDepth = 8;
  engineOverlayEnabled = false;
  isLastMoveBlunder = false;
  showHelpModal = false;

  chessboard: any;
  INPUT_EVENT_TYPE: any;
  highlightMarkerType: any;

  // Cache evaluations for real-time analysis
  precomputedEvaluations: any[] = [];
  activeAlert: { message: string, classification: string, subMessage: string } | null = null;
  alertTimeout: any = null;

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

  cachedMaterialState = {
    whiteScore: 39,
    blackScore: 39,
    whiteLead: 0,
    blackLead: 0,
    whiteCapturedPieces: [] as string[],
    blackCapturedPieces: [] as string[]
  };

  ngOnInit() {
    this.boardTheme = localStorage.getItem('chess_board_theme') || 'default';
    this.parseTimeControl();
    this.updateCachedState(); // Initialize state
    
    if (this.settings?.tournamentMode) {
      this.engineOverlayEnabled = false;
    }

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
          this.checkEvaluationAlert(data.index);
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
        if (!this.cachedIsPlayerTurn || this.currentMoveIndex !== this.moveHistory.length - 1) {
          return false; // prevent starting move if not player's turn or viewing previous moves
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
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
    }
  }

  toggleEngineOverlay() {
    if (this.settings?.tournamentMode) return;
    this.engineOverlayEnabled = !this.engineOverlayEnabled;
    this.cdr.detectChanges();
  }

  undoMove() {
    if (this.settings?.tournamentMode) return;
    if (this.moveHistory.length === 0) return;

    // Clear active alert / blunder highlight
    this.activeAlert = null;
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
    }
    this.isLastMoveBlunder = false;

    // Determine how many moves to undo
    // If the game is not over and it is currently the engine's turn, we only need to undo 1 move (the player's move)
    // Otherwise, we undo 2 moves (the engine's response and the player's move) so the player can try again
    const isEngineTurn = !this.cachedIsGameOver && this.game.turn() !== (this.settings?.side === 'white' ? 'w' : 'b');
    const movesToUndo = (isEngineTurn || this.moveHistory.length < 2) ? 1 : 2;

    for (let i = 0; i < movesToUndo; i++) {
      if (this.moveHistory.length > 0) {
        this.game.undo();
        this.moveHistory.pop();
        if (this.precomputedEvaluations && this.precomputedEvaluations.length > 0) {
          this.precomputedEvaluations.pop();
        }
      }
    }

    // Reset game states
    this.resigned = false;
    this.timeOut = false;
    this.updateCachedState();

    // Reset current move index to the end of the new history
    this.currentMoveIndex = this.moveHistory.length - 1;

    // Update the chessboard visual
    this.updateBoardVisual(true, true);

    // Save state / trigger detection change
    this.cdr.detectChanges();
  }

  requestEngineMove(currentFen: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'REQUEST_MOVE',
          fen: currentFen,
          difficulty: this.settings ? this.settings.difficulty : 1500,
          skillLevel: this.settings ? this.settings.skillLevel : 8,
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

    this.updateCachedMaterialState();
  }

  updateCachedMaterialState() {
    this.cachedMaterialState = this.getMaterialStateForIndex(this.moveHistory.length - 1);
  }

  getMaterialStateForIndex(index: number) {
    const fen = this.getFenForIndex(index);
    const tempGame = new Chess(fen);
    
    const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    
    // Starting counts
    const startCounts: Record<string, Record<string, number>> = {
      w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
      b: { p: 8, n: 2, b: 2, r: 2, q: 1 }
    };

    // Current counts on board
    const currentCounts: Record<string, Record<string, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
    };

    let whiteScore = 0;
    let blackScore = 0;

    const board = tempGame.board();
    for (const row of board) {
      for (const square of row) {
        if (square) {
          const color = square.color; // 'w' or 'b'
          const type = square.type;   // 'p', 'n', 'b', 'r', 'q', 'k'
          if (type !== 'k') {
            currentCounts[color][type]++;
            if (color === 'w') {
              whiteScore += values[type];
            } else {
              blackScore += values[type];
            }
          }
        }
      }
    }

    // Captured pieces list for each color
    // White captured black's pieces (so White has them)
    // Black captured white's pieces (so Black has them)
    const whiteCapturedPieces: string[] = []; // Black pieces captured by White
    const blackCapturedPieces: string[] = []; // White pieces captured by Black

    const pieceOrder = ['p', 'n', 'b', 'r', 'q'];
    
    for (const type of pieceOrder) {
      // White captured black's pieces
      const blackCapturedCount = Math.max(0, startCounts['b'][type] - currentCounts['b'][type]);
      for (let i = 0; i < blackCapturedCount; i++) {
        whiteCapturedPieces.push(type);
      }
      
      // Black captured white's pieces
      const whiteCapturedCount = Math.max(0, startCounts['w'][type] - currentCounts['w'][type]);
      for (let i = 0; i < whiteCapturedCount; i++) {
        blackCapturedPieces.push(type);
      }
    }

    // Material difference
    const diff = whiteScore - blackScore;
    
    return {
      whiteScore,
      blackScore,
      whiteLead: diff > 0 ? diff : 0,
      blackLead: diff < 0 ? -diff : 0,
      whiteCapturedPieces,
      blackCapturedPieces
    };
  }

  getMaterialStateForCurrentIndex() {
    return this.getMaterialStateForIndex(this.currentMoveIndex);
  }

  getPieceSymbol(type: string): string {
    const symbols: Record<string, string> = {
      p: '♟',
      n: '♞',
      b: '♝',
      r: '♜',
      q: '♛'
    };
    return symbols[type] || '';
  }

  getOpponentCapturedPieces(): { type: string, symbol: string, colorClass: string }[] {
    const opponentColor = this.settings && this.settings.side === 'white' ? 'b' : 'w';
    const materialState = this.getMaterialStateForCurrentIndex();
    const pieces = opponentColor === 'w' ? materialState.whiteCapturedPieces : materialState.blackCapturedPieces;
    // If opponent is White, they captured Black's pieces (dark)
    // If opponent is Black, they captured White's pieces (light)
    const colorClass = opponentColor === 'w' ? 'text-neutral-500 font-bold' : 'text-neutral-200 font-bold';
    return pieces.map(p => ({
      type: p,
      symbol: this.getPieceSymbol(p),
      colorClass
    }));
  }

  getPlayerCapturedPieces(): { type: string, symbol: string, colorClass: string }[] {
    const playerColor = this.settings && this.settings.side === 'white' ? 'w' : 'b';
    const materialState = this.getMaterialStateForCurrentIndex();
    const pieces = playerColor === 'w' ? materialState.whiteCapturedPieces : materialState.blackCapturedPieces;
    // If player is White, they captured Black's pieces (dark)
    // If player is Black, they captured White's pieces (light)
    const colorClass = playerColor === 'w' ? 'text-neutral-500 font-bold' : 'text-neutral-200 font-bold';
    return pieces.map(p => ({
      type: p,
      symbol: this.getPieceSymbol(p),
      colorClass
    }));
  }

  getOpponentLead(): number {
    const opponentColor = this.settings && this.settings.side === 'white' ? 'b' : 'w';
    const materialState = this.getMaterialStateForCurrentIndex();
    return opponentColor === 'w' ? materialState.whiteLead : materialState.blackLead;
  }

  getPlayerLead(): number {
    const playerColor = this.settings && this.settings.side === 'white' ? 'w' : 'b';
    const materialState = this.getMaterialStateForCurrentIndex();
    return playerColor === 'w' ? materialState.whiteLead : materialState.blackLead;
  }

  getCurrentEvaluationInfo() {
    const evalIndex = this.currentMoveIndex + 1;
    const evalObj = this.precomputedEvaluations[evalIndex];
    if (!evalObj) {
      return {
        type: 'none' as const,
        score: 0,
        text: '0.0',
        percentage: 50
      };
    }

    if (evalObj.mate !== undefined && evalObj.mate !== null) {
      const mate = parseInt(evalObj.mate, 10);
      const isWhiteWinning = mate > 0;
      const percentage = isWhiteWinning ? 100 : 0;
      return {
        type: 'mate' as const,
        score: mate,
        text: `M${Math.abs(mate)}`,
        percentage,
        isWhiteWinning
      };
    }

    const val = parseFloat(evalObj.eval || 0);
    // standard linear mapping: -8 to +8 pawns mapped to 5% - 95%
    let percentage = 50 + (val * 6.25);
    percentage = Math.max(5, Math.min(95, percentage));

    const text = val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);

    return {
      type: 'score' as const,
      score: val,
      text,
      percentage
    };
  }

  getEvaluationBarStyles(): { [key: string]: string } {
    const info = this.getCurrentEvaluationInfo();
    const isPlayerWhite = this.settings && this.settings.side === 'white';
    const whitePercentage = info.percentage;
    
    if (isPlayerWhite) {
      // White is on the bottom, so White's bar grows from the bottom
      return {
        height: `${whitePercentage}%`,
        backgroundColor: '#e5e5e5', // neutral-200
        bottom: '0',
        transition: 'height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)'
      };
    } else {
      // White is on top, so White's bar grows from the top
      return {
        height: `${whitePercentage}%`,
        backgroundColor: '#e5e5e5', // neutral-200
        top: '0',
        transition: 'height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)'
      };
    }
  }

  getEvaluationLabelClasses() {
    const info = this.getCurrentEvaluationInfo();
    const isPlayerWhite = this.settings && this.settings.side === 'white';
    const whiteWinning = info.percentage >= 50;
    
    if (isPlayerWhite) {
      if (whiteWinning) {
        return 'bottom-2 left-0 right-0 text-neutral-900 font-bold';
      } else {
        return 'top-2 left-0 right-0 text-neutral-300 font-medium';
      }
    } else {
      if (whiteWinning) {
        return 'top-2 left-0 right-0 text-neutral-900 font-bold';
      } else {
        return 'bottom-2 left-0 right-0 text-neutral-300 font-medium';
      }
    }
  }

  getGroupedCapturedPieces(side: 'player' | 'opponent'): { type: string, symbol: string, count: number, name: string, value: number, colorClass: string }[] {
    const isPlayer = side === 'player';
    const playerColor = this.settings && this.settings.side === 'white' ? 'w' : 'b';
    const opponentColor = playerColor === 'w' ? 'b' : 'w';
    
    const materialState = this.getMaterialStateForCurrentIndex();
    
    let pieces: string[] = [];
    let capturedColor: 'w' | 'b' = 'w';
    
    if (isPlayer) {
      pieces = playerColor === 'w' ? materialState.whiteCapturedPieces : materialState.blackCapturedPieces;
      capturedColor = playerColor === 'w' ? 'b' : 'w';
    } else {
      pieces = opponentColor === 'w' ? materialState.whiteCapturedPieces : materialState.blackCapturedPieces;
      capturedColor = opponentColor === 'w' ? 'b' : 'w';
    }

    const pieceNames: Record<string, string> = {
      p: 'Pawn',
      n: 'Knight',
      b: 'Bishop',
      r: 'Rook',
      q: 'Queen'
    };

    const pieceValues: Record<string, number> = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9
    };

    const counts: Record<string, number> = {};
    for (const p of pieces) {
      counts[p] = (counts[p] || 0) + 1;
    }

    const order = ['q', 'r', 'b', 'n', 'p'];
    
    const result: any[] = [];
    for (const type of order) {
      if (counts[type] > 0) {
        const colorClass = capturedColor === 'w' 
          ? 'bg-neutral-100 text-neutral-800 border-neutral-300' 
          : 'bg-neutral-900 text-neutral-100 border-neutral-700/60';
          
        result.push({
          type,
          symbol: this.getPieceSymbol(type),
          count: counts[type],
          name: pieceNames[type],
          value: pieceValues[type],
          colorClass
        });
      }
    }
    return result;
  }

  getOpeningVariations(): OpeningVariation[] {
    const sans = this.moveHistory.map(m => m.san);
    return getOpeningVariations(sans).slice(0, 5);
  }

  getOpeningTranspositions(): ChessOpening[] {
    const sans = this.moveHistory.map(m => m.san);
    return getTranspositions(sans, this.currentOpening).slice(0, 5);
  }

  makeAMove(move: any, isEngine: boolean = false) {
    try {
      const result = this.game.move(move);
      this.isLastMoveBlunder = false;
      const fenAfter = this.game.fen();
      const now = Date.now();
      const duration = Math.round((now - this.lastMoveTime) / 1000);
      this.lastMoveTime = now;
      this.moveHistory.push({ ...result, fenAfter, duration });
      this.currentMoveIndex = this.moveHistory.length - 1;

      // Detect opening
      const sans = this.moveHistory.map(m => m.san);
      this.currentOpening = getOpeningFromMoves(sans);

      // Request evaluation for this move if we aren't game over
      const currentIndex = this.moveHistory.length; // because DEFAULT_POSITION is index 0 in analysis
      if (!this.settings?.tournamentMode && this.ws && this.ws.readyState === WebSocket.OPEN) {
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
        if (result.captured) {
          animateCapture(this.boardContainer.nativeElement, result.to);
        }
        this.updateBoardVisual(isEngine);
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

  showAlert(message: string, classification: string, subMessage: string) {
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
    }
    this.activeAlert = { message, classification, subMessage };
    this.cdr.detectChanges();
    
    this.alertTimeout = setTimeout(() => {
      this.activeAlert = null;
      this.cdr.detectChanges();
    }, 4500); // show for 4.5 seconds
  }

  checkEvaluationAlert(moveIndex: number) {
    if (this.settings?.tournamentMode || !this.engineOverlayEnabled || moveIndex <= 0 || !this.precomputedEvaluations) return;
    
    const evalBefore = this.precomputedEvaluations[moveIndex - 1];
    const evalAfter = this.precomputedEvaluations[moveIndex];
    if (!evalBefore || !evalAfter) return;

    const parseEval = (e: any, isWhiteMove: boolean) => {
      if (e.mate !== undefined && e.mate !== null) {
        const mate = parseInt(e.mate, 10);
        if (mate === 0) return isWhiteMove ? -100 : 100;
        return mate > 0 ? 100 : -100;
      }
      return parseFloat(e.eval || 0);
    };

    const isWhite = (moveIndex - 1) % 2 === 0;
    const before = parseEval(evalBefore, isWhite);
    const after = parseEval(evalAfter, !isWhite);
    
    const evalShift = after - before; 
    const playerLoss = isWhite ? -evalShift : evalShift;
    
    if (playerLoss >= 2.0) {
      this.isLastMoveBlunder = true;
      const playedMove = this.moveHistory[moveIndex - 1];
      const moveName = playedMove ? playedMove.san : '';
      const playerStr = isWhite ? 'White' : 'Black';
      const lossCp = Math.round(playerLoss * 100);

      // Play alert sound
      chessAudio.playBlunderAlert();

      // Show visual alert toast/overlay
      this.showAlert(
        `${playerStr} Blunder: ${moveName}`,
        'blunder',
        `Centipawn loss: ${lossCp} (exceeds 200)`
      );
    }
  }

  getMoveClassification(moveIndex: number): string | null {
    if (this.settings?.tournamentMode || !this.engineOverlayEnabled || !this.precomputedEvaluations) return null;
    const evalBefore = this.precomputedEvaluations[moveIndex];
    const evalAfter = this.precomputedEvaluations[moveIndex + 1];
    if (!evalBefore || !evalAfter) return null;

    const parseEval = (e: any, isWhiteMove: boolean) => {
      if (e.mate !== undefined && e.mate !== null) {
        const mate = parseInt(e.mate, 10);
        if (mate === 0) return isWhiteMove ? -100 : 100;
        return mate > 0 ? 100 : -100;
      }
      return parseFloat(e.eval || 0);
    };

    let before = parseEval(evalBefore, moveIndex % 2 === 0);
    let after = parseEval(evalAfter, (moveIndex + 1) % 2 === 0);
    
    const isWhite = moveIndex % 2 === 0;
    const evalShift = after - before; 
    const playerLoss = isWhite ? -evalShift : evalShift;

    if (playerLoss >= 2.0) return 'blunder';
    if (playerLoss >= 1.0) return 'mistake';
    if (playerLoss >= 0.4) return 'inaccuracy';
    return null;
  }

  onThemeChange() {
    if (this.chessboard) {
      localStorage.setItem('chess_board_theme', this.boardTheme);
      this.chessboard.props.style.cssClass = this.boardTheme;
      const svg = this.boardContainer.nativeElement.querySelector('svg');
      if (svg) {
        let classes = svg.getAttribute('class') || '';
        classes = classes.replace(/default|green|blue|wood|chess-club|chessboard-js|black-and-white/g, '').trim();
        svg.setAttribute('class', classes + ' ' + this.boardTheme);
      }
    }
  }

  getFenForIndex(index: number): string {
    if (index < 0) {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    return this.moveHistory[index].fenAfter;
  }

  updateBoardVisual(animate: boolean = false, playSound: boolean = false) {
    if (!this.chessboard) return;
    
    const fen = this.getFenForIndex(this.currentMoveIndex);
    this.chessboard.setPosition(fen, animate);
    
    // Highlight the move markers
    if (this.highlightMarkerType) {
      this.chessboard.removeMarkers(this.highlightMarkerType);
      if (this.currentMoveIndex >= 0) {
        const move = this.moveHistory[this.currentMoveIndex];
        if (move && move.from && move.to) {
          this.chessboard.addMarker(this.highlightMarkerType, move.from);
          this.chessboard.addMarker(this.highlightMarkerType, move.to);
        }
      }
    }

    if (playSound && this.currentMoveIndex >= 0) {
      const move = this.moveHistory[this.currentMoveIndex];
      if (move) {
        const isCheck = move.san?.includes('+') || move.san?.includes('#') || (move.flags && (move.flags.includes('+') || move.flags.includes('#')));
        const isCapture = move.captured || move.san?.includes('x') || (move.flags && move.flags.includes('c'));
        if (isCheck) {
          chessAudio.playCheck();
        } else if (isCapture) {
          chessAudio.playCapture();
        } else {
          chessAudio.playMove();
        }
      }
    }
  }

  goToStart() {
    if (this.currentMoveIndex === -1) return;
    this.currentMoveIndex = -1;
    this.updateBoardVisual(true, false);
    this.cdr.detectChanges();
  }

  goToPrev() {
    if (this.currentMoveIndex < 0) return;
    this.currentMoveIndex--;
    this.updateBoardVisual(true, true);
    this.cdr.detectChanges();
  }

  goToNext() {
    if (this.currentMoveIndex >= this.moveHistory.length - 1) return;
    this.currentMoveIndex++;
    this.updateBoardVisual(true, true);
    this.cdr.detectChanges();
  }

  goToEnd() {
    if (this.currentMoveIndex === this.moveHistory.length - 1) return;
    this.currentMoveIndex = this.moveHistory.length - 1;
    this.updateBoardVisual(true, true);
    this.cdr.detectChanges();
  }

  selectMove(moveIndex: number) {
    if (this.currentMoveIndex === moveIndex) return;
    this.currentMoveIndex = moveIndex;
    this.updateBoardVisual(true, true);
    this.cdr.detectChanges();
  }

  handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    const key = event.key.toLowerCase();
    
    if (key === 'h') {
      event.preventDefault();
      this.showHelpModal = !this.showHelpModal;
      this.cdr.detectChanges();
      return;
    }

    if (key === 'escape' && this.showHelpModal) {
      event.preventDefault();
      this.showHelpModal = false;
      this.cdr.detectChanges();
      return;
    }

    if (key === 'arrowleft' || key === 'a') {
      event.preventDefault();
      this.goToPrev();
    } else if (key === 'arrowright' || key === 'd') {
      event.preventDefault();
      this.goToNext();
    } else if (key === 'arrowup' || key === 'w' || key === 'k' || key === 'home') {
      event.preventDefault();
      this.goToStart();
    } else if (key === 'arrowdown' || key === 's' || key === 'j' || key === 'end') {
      event.preventDefault();
      this.goToEnd();
    } else if (key === 'r') {
      if (!this.cachedIsGameOver) {
        event.preventDefault();
        this.resign();
      }
    } else if (key === 'u') {
      event.preventDefault();
      this.undoMove();
    } else if (key === 'e') {
      event.preventDefault();
      this.toggleEngineOverlay();
    }
  }
}
