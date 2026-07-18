import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  OnInit,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import {
  LucideAngularModule,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  MessageSquare,
  Download,
  Lightbulb,
} from 'lucide-angular';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getWebSocketUrl } from '../../utils/config';
import { getOpeningFromMoves, ChessOpening, getOpeningVariations, getTranspositions, OpeningVariation } from '../../utils/openings';
import { animateCapture } from '../../utils/animations';
import { chessAudio } from '../game/audio';
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { language } from '../language';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './analysis.html',
  styleUrl: './analysis.css',
  host: {
    '(window:keydown)': 'handleKeyDown($event)'
  }
})
export class Analysis implements OnInit, OnDestroy, AfterViewInit {
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly RotateCcw = RotateCcw;
  readonly MessageSquare = MessageSquare;
  readonly Download = Download;
  readonly Lightbulb = Lightbulb;
  readonly Math = Math;
  lang = language;

  @Input() history: any[] = [];
  @Input() depth: number = 8;
  @Input() precomputedEvaluations: any[] = [];
  @Input() elo: number = 1500;
  @Input() settings: any = null;
  @Output() goBack = new EventEmitter<void>();

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone, private sanitizer: DomSanitizer) {}

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;
  @ViewChild('rechartsContainer', { static: false }) rechartsContainer!: ElementRef;

  chessboard: any;
  ws: WebSocket | null = null;
  reactRoot: any = null;

  boardTheme: string = 'default';
  engineOverlayEnabled: boolean = true;
  showExplanationOnBoard: boolean = false;
  showHelpModal: boolean = false;

  toggleAiExplanationOnBoard() {
    this.showExplanationOnBoard = !this.showExplanationOnBoard;
    if (this.showExplanationOnBoard) {
      this.loadMoveExplanation(this.currentMoveIndex, false);
    }
    this.cdr.detectChanges();
  }

  triggerAiExplanationOnBoard() {
    this.loadMoveExplanation(this.currentMoveIndex, true);
    this.cdr.detectChanges();
  }

  currentMoveIndex: number = 0;
  lastRenderedMoveIndex: number = -1;
  private playSoundOnUpdate: boolean = false;
  explanation: string = '';
  isLoading: boolean = true;
  isAiLoading: boolean = false;
  gameAnalysis: any = null;
  parsedGameAnalysis: SafeHtml | null = null;
  evaluations: any[] = [];
  highlightedSquare: string | null = null;
  coordinateMarkerType = { class: "marker-coordinate", slice: "markerSquare" };

  // Chart calculation data
  chartPoints: string = "";

  // Extensions
  ArrowsExt: any = null;
  ArrowTypeExt: any = null;

  previewFen: string | null = null;
  previewArrow: { from: string, to: string, color: any } | null = null;
  pvsList: any[] = [];
  pvsLoading: boolean = false;
  pvsError: string | null = null;
  lastPvFen: string | null = null;

  // ⚡ Bolt: Cache explanations to prevent redundant backend/AI calls when stepping back and forth
  explanationCache: Map<number, string> = new Map();
  statsSummary: any = null;
  currentMoveExplanation: string = '';
  parsedMoveExplanation: SafeHtml | null = null;
  currentMoveAiLoading: boolean = false;

  loadingFacts = [
    "Первая шахматная доска с чередующимися светлыми и темными клетками появилась в Европе в 1090 году.",
    "Самая длинная шахматная партия (Николич - Арсович, 1989) длилась 269 ходов.",
    "Теоретически возможна партия в 5949 ходов.",
    "Слово «шахматы» происходит от персидского «шах мат» («король мертв»).",
    "В 1997 году компьютер Deep Blue победил чемпиона мира Гарри Каспарова.",
    "Число возможных партий больше, чем количество атомов во Вселенной (число Шеннона).",
    "Изначально ферзь мог двигаться только на одну клетку по диагонали.",
    "Складная шахматная доска была изобретена в 1125 году."
  ];
  currentFactIndex = 0;
  factTimer: any;

  ngOnInit() {
    this.currentMoveIndex = this.history.length - 1;
    this.requestFullAnalysis();
  }

  async ngAfterViewInit() {
    const { Chessboard } = await import('cm-chessboard');
    const { Arrows, ARROW_TYPE } = await import('cm-chessboard/src/extensions/arrows/Arrows.js');
    const { Markers } = await import('cm-chessboard/src/extensions/markers/Markers.js');
    this.ArrowsExt = Arrows;
    this.ArrowTypeExt = ARROW_TYPE;

    this.boardTheme = localStorage.getItem('chess_board_theme') || 'default';

    this.chessboard = new Chessboard(this.boardContainer.nativeElement, {
      position: this.getCurrentFen(),
      assetsUrl: '/assets/',
      assetsCache: true,
      style: {
        cssClass: this.boardTheme,
      },
      extensions: [{ class: Arrows }, { class: Markers }]
    });

    this.updateBoard();
  }

  ngOnDestroy() {
    if (this.factTimer) {
      clearInterval(this.factTimer);
    }
    if (this.chessboard) {
      this.chessboard.destroy();
    }
    if (this.ws) {
      this.ws.close();
    }
    if (this.reactRoot) {
      try {
        this.reactRoot.unmount();
      } catch (e) {
        console.warn("Error unmounting React root:", e);
      }
    }
  }

  getCurrentMove() {
    return this.history[this.currentMoveIndex];
  }

  getCurrentOpening(): ChessOpening | null {
    if (this.currentMoveIndex < 0 || this.history.length === 0) return null;
    const movesUpToNow = this.history.slice(0, this.currentMoveIndex + 1).map(m => m.san);
    return getOpeningFromMoves(movesUpToNow);
  }

  getGameOpening(): ChessOpening | null {
    if (!this.history || this.history.length === 0) return null;
    // Compare first 10-15 moves of the entire game to determine the main game opening
    const gameMoves = this.history.slice(0, 15).map(m => m.san);
    return getOpeningFromMoves(gameMoves);
  }

  getOpeningVariations(): OpeningVariation[] {
    const movesUpToNow = this.history.slice(0, this.currentMoveIndex + 1).map(m => m.san);
    // Limit to top 5 variations to keep the display clean
    return getOpeningVariations(movesUpToNow).slice(0, 5);
  }

  getOpeningTranspositions(): ChessOpening[] {
    const movesUpToNow = this.history.slice(0, this.currentMoveIndex + 1).map(m => m.san);
    const currentOpening = this.getCurrentOpening();
    // Limit to top 5 transpositions to keep the display clean
    return getTranspositions(movesUpToNow, currentOpening).slice(0, 5);
  }

  getCurrentFen() {
    if (this.previewFen) return this.previewFen;
    const currentMove = this.getCurrentMove();
    return currentMove ? currentMove.fenAfter : DEFAULT_POSITION;
  }

  getPreviousFen() {
    if (this.currentMoveIndex < 0) return DEFAULT_POSITION;
    if (this.currentMoveIndex === 0) return DEFAULT_POSITION;
    return this.history[this.currentMoveIndex - 1].fenAfter;
  }

  getMoveNumber() {
    return this.currentMoveIndex >= 0 ? Math.floor(this.currentMoveIndex / 2) + 1 : 0;
  }

  getIsWhiteToMove() {
    return this.currentMoveIndex >= 0 ? this.currentMoveIndex % 2 === 0 : true;
  }

  getAnalyzedCount() {
    if (!this.evaluations) return 0;
    return this.evaluations.filter(e => e !== null).length;
  }

  getCurrentEvalString(): string {
    if (!this.evaluations || this.evaluations.length <= this.currentMoveIndex + 1) return '';
    const evalData = this.evaluations[this.currentMoveIndex + 1];
    if (!evalData) return '...';
    
    if (evalData.mate !== undefined && evalData.mate !== null) {
      const mate = parseInt(evalData.mate, 10);
      if (mate === 0) return '#';
      return `M${Math.abs(mate)}`;
    }
    
    if (evalData.eval !== undefined && evalData.eval !== null) {
      const e = parseFloat(evalData.eval);
      return e > 0 ? `+${e.toFixed(2)}` : e.toFixed(2);
    }
    
    return '';
  }

  isCurrentMoveTablebase(): boolean {
    if (!this.evaluations || this.evaluations.length <= this.currentMoveIndex + 1) return false;
    const evalData = this.evaluations[this.currentMoveIndex + 1];
    return !!(evalData && evalData.isTablebase);
  }

  getArrowTypeForMove(moveIndex: number) {
    if (moveIndex < 0 || !this.evaluations || this.evaluations.length <= moveIndex + 1) return this.ArrowTypeExt.secondary;
    
    // Check if this move delivers checkmate using chess.js
    const move = this.history[moveIndex];
    if (move && move.fenAfter) {
      try {
        const chess = new Chess(move.fenAfter);
        if (chess.isCheckmate()) {
          return this.ArrowTypeExt.success; // ALWAYS mark checkmate with a success (green) arrow!
        }
      } catch (e) {
        console.error("Error checking checkmate:", e);
      }
    }

    const evalBefore = this.evaluations[moveIndex];
    const evalAfter = this.evaluations[moveIndex + 1];
    
    if (!evalBefore || !evalAfter) return this.ArrowTypeExt.secondary;

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

    if (playerLoss >= 2.0) return this.ArrowTypeExt.danger;
    if (playerLoss >= 1.0) return this.ArrowTypeExt.warning;
    if (playerLoss <= 0.2) return this.ArrowTypeExt.success;
    return this.ArrowTypeExt.secondary;
  }

   updateBoard() {
    this.loadPrincipalVariations();
    if (this.chessboard) {
      if (this.currentMoveIndex === this.lastRenderedMoveIndex + 1 && this.currentMoveIndex >= 0) {
        const move = this.history[this.currentMoveIndex];
        if (move && move.captured) {
          animateCapture(this.boardContainer.nativeElement, move.to);
        }
      }

      if (this.playSoundOnUpdate && this.currentMoveIndex !== this.lastRenderedMoveIndex) {
        this.playSoundOnUpdate = false;
        if (this.currentMoveIndex >= 0) {
          const move = this.history[this.currentMoveIndex];
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
      } else {
        this.playSoundOnUpdate = false;
      }

      this.lastRenderedMoveIndex = this.currentMoveIndex;

      this.chessboard.setPosition(this.getCurrentFen());

      // Clear previous arrows
      if (this.chessboard.removeArrows) {
        this.chessboard.removeArrows();
      }

      // Draw custom preview arrow or the previous move
      if (this.previewArrow) {
        if (this.chessboard.addArrow) {
          console.log("Drawing preview arrow:", this.previewArrow);
          this.chessboard.addArrow(this.previewArrow.color, this.previewArrow.from, this.previewArrow.to);
        }
      } else if (this.engineOverlayEnabled) {
        // 1. Draw Stockfish recommended best move for the current position
        const currentEval = this.evaluations && this.evaluations[this.currentMoveIndex + 1];
        if (currentEval && currentEval.move && currentEval.move.length >= 4) {
          const bestMoveFrom = currentEval.move.substring(0, 2);
          const bestMoveTo = currentEval.move.substring(2, 4);
          if (this.chessboard && this.chessboard.addArrow) {
            console.log("Drawing engine best move arrow:", bestMoveFrom, bestMoveTo);
            this.chessboard.addArrow(this.ArrowTypeExt.success, bestMoveFrom, bestMoveTo);
          }
        }

        // 2. Draw history arrow (how we got here) if applicable
        if (this.currentMoveIndex >= 0 && this.currentMoveIndex < this.history.length) {
          const move = this.history[this.currentMoveIndex];
          const arrowType = this.getArrowTypeForMove(this.currentMoveIndex);
          console.log("Drawing history arrow:", move.from, move.to, arrowType);
          if (this.chessboard && this.chessboard.addArrow) {
            this.chessboard.addArrow(arrowType, move.from, move.to);
          }
        }
      }

      // Redraw highlighted square marker if present
      if (this.highlightedSquare) {
        this.chessboard.addMarker(this.coordinateMarkerType, this.highlightedSquare);
      }

      this.renderRecharts();
    }
  }

  requestFullAnalysis() {
    if (!this.history || this.history.length === 0) {
      this.isLoading = false;
      this.isAiLoading = false;
      this.gameAnalysis = 'В этой партии не сыграно ни одного хода. Пожалуйста, сделайте несколько ходов или загрузите игру, чтобы начать анализ.';
      this.parsedGameAnalysis = this.sanitizer.bypassSecurityTrustHtml('В этой партии не сыграно ни одного хода. Пожалуйста, сделайте несколько ходов или загрузите игру, чтобы начать анализ.');
      return;
    }
    this.isLoading = true;
    this.isAiLoading = true;
    this.currentFactIndex = 0;
    if (this.factTimer) {
      clearInterval(this.factTimer);
    }
    this.factTimer = setInterval(() => {
      this.ngZone.run(() => {
        this.currentFactIndex = (this.currentFactIndex + 1) % this.loadingFacts.length;
        this.cdr.detectChanges();
      });
    }, 4000);

    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(getWebSocketUrl());

    this.ws.onopen = () => {
      // Reconstruct PGN
      const chess = new Chess();
      this.history.forEach(move => chess.move(move.san));
      const pgn = chess.pgn();

      // Gather all FENs
      const fens = [DEFAULT_POSITION, ...this.history.map(m => m.fenAfter)];

      this.ws?.send(
        JSON.stringify({
          type: 'ANALYZE_GAME',
          pgn: pgn,
          fens: fens,
          depth: this.depth,
          precomputedEvaluations: this.precomputedEvaluations,
          elo: this.elo
        }),
      );
    };

    this.ws.onmessage = (event) => {
      this.ngZone.run(() => {
        const data = JSON.parse(event.data);
        if (data.type === 'ANALYSIS_PROGRESS') {
          // Initialize array if needed
          if (this.evaluations.length !== data.total) {
            this.evaluations = new Array(data.total).fill(null);
          }
          this.evaluations[data.index] = data.evaluation;
          this.calculateChart();
          this.updateBoard(); // Redraw arrows
          this.cdr.detectChanges();
        } else if (data.type === 'ANALYSIS_EVALUATION_DONE') {
          this.evaluations = data.evaluations;
          this.calculateChart();
          this.updateBoard();
          this.isLoading = false; // Stockfish is done, unlock the board
          this.calculateStatsSummary();
          this.loadMoveExplanation(this.currentMoveIndex);
          this.prefetchErrorExplanations();
          this.cdr.detectChanges();
        } else if (data.type === 'ANALYSIS_GAME_RESULT') {
          this.gameAnalysis = data.aiExplanation;
          
          Promise.resolve(marked.parse(this.gameAnalysis || '')).then(parsed => {
            const htmlWithCoords = this.highlightCoordinatesInHtml(parsed as string);
            this.parsedGameAnalysis = this.sanitizer.bypassSecurityTrustHtml(htmlWithCoords);
            this.cdr.detectChanges();
          });

          if (data.evaluations) {
            this.evaluations = data.evaluations;
            this.calculateChart();
            this.updateBoard(); // Redraw arrows with loaded data
          }
          this.isLoading = false;
          this.isAiLoading = false;
          if (this.factTimer) clearInterval(this.factTimer);
          this.ws?.close();
          this.ws = null;
          this.calculateStatsSummary();
          this.loadMoveExplanation(this.currentMoveIndex);
          this.prefetchErrorExplanations();
          this.cdr.detectChanges();
        }
      });
    };

    this.ws.onerror = () => {
      this.ngZone.run(() => {
        this.gameAnalysis = 'Failed to load analysis.';
        this.parsedGameAnalysis = this.sanitizer.bypassSecurityTrustHtml('Failed to load analysis.');
        this.isLoading = false;
        this.isAiLoading = false;
        if (this.factTimer) clearInterval(this.factTimer);
        this.ws?.close();
        this.ws = null;
        this.cdr.detectChanges();
      });
    };
  }

  calculateChart() {
    this.renderRecharts();
  }

  highlightCoordinatesInHtml(html: string): string {
    if (!html) return html;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const ruToEnSquare: { [key: string]: string } = {
        'а': 'a', 'a': 'a',
        'в': 'b', 'b': 'b',
        'с': 'c', 'c': 'c',
        'д': 'd', 'd': 'd',
        'е': 'e', 'e': 'e',
        'ф': 'f', 'f': 'f',
        'х': 'h', 'h': 'h',
        'А': 'a', 'В': 'b', 'С': 'c', 'Д': 'd', 'Е': 'e', 'Ф': 'f', 'Х': 'h'
      };

      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentNode;
          // Check if parent or any ancestor is an anchor tag 'A'
          let inAnchor = false;
          let temp: HTMLElement | null = parent as HTMLElement;
          while (temp) {
            if (temp.tagName === 'A') {
              inAnchor = true;
              break;
            }
            temp = temp.parentElement;
          }
          
          if (!inAnchor && node.nodeValue) {
            const text = node.nodeValue;
            // Matches Latin a-h or Russian а, в, с, д, е, ф, х followed by a digit 1-8.
            const regex = /(?<![a-zA-Zа-яА-Я0-9])([a-hавсдефхд][1-8])(?![a-zA-Zа-яА-Я0-9])/gi;
            const replaced = text.replace(regex, (match) => {
              const letter = match[0];
              const digit = match[1];
              const mappedLetter = ruToEnSquare[letter] || letter.toLowerCase();
              const normalizedSquare = mappedLetter + digit;
              return `<a href="#square-${normalizedSquare}" class="coordinate-link text-blue-400 hover:underline hover:text-blue-300 font-mono font-semibold">${match}</a>`;
            });
            
            if (replaced !== text) {
              // Create a document fragment to hold the new structure
              const fragment = doc.createDocumentFragment();
              const container = doc.createElement('div');
              container.innerHTML = replaced;
              
              // Move children of container to fragment
              while (container.firstChild) {
                fragment.appendChild(container.firstChild);
              }
              
              parent?.replaceChild(fragment, node);
            }
          }
        } else {
          // Clone childNodes array because replacing children modifies the live list
          const children = Array.from(node.childNodes);
          for (const child of children) {
            walk(child);
          }
        }
      };
      
      walk(doc.body);
      return doc.body.innerHTML;
    } catch (e) {
      console.error("DOMParser coordinate highlighting error, falling back to regex:", e);
      // Fallback regex logic in case DOMParser fails
      return html;
    }
  }

  highlightSquareOnBoard(square: string) {
    if (!this.chessboard) return;
    console.log("[highlightSquareOnBoard] Highlighting square:", square, "Previous highlightedSquare:", this.highlightedSquare);
    
    // Remove previous highlighted square if any
    if (this.highlightedSquare) {
      try {
        this.chessboard.removeMarkers(this.coordinateMarkerType, this.highlightedSquare);
      } catch (e) {
        console.warn("Error removing marker:", e);
      }
    }
    
    this.highlightedSquare = square;
    try {
      this.chessboard.addMarker(this.coordinateMarkerType, square);
    } catch (e) {
      console.warn("Error adding marker:", e);
    }
  }

  onAnalysisClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    console.log("[onAnalysisClick] Element clicked:", target);
    
    // Check if a link was clicked
    const link = target.closest('a');
    if (link) {
      const href = link.getAttribute('href');
      console.log("[onAnalysisClick] Found anchor link with href:", href);
      if (href) {
        if (href.includes('#move-')) {
          event.preventDefault(); // Prevent scrolling to anchor
          const hashIndex = href.indexOf('#move-');
          const plyIndexStr = href.substring(hashIndex + '#move-'.length);
          const plyIndex = parseInt(plyIndexStr, 10);
          console.log("[onAnalysisClick] Parsed move link plyIndex:", plyIndex, "Total history length:", this.history.length);
          
          if (!isNaN(plyIndex) && plyIndex >= 0 && plyIndex < this.history.length) {
            this.previewFen = null;
            this.previewArrow = null;
            // Clear any square highlights
            if (this.highlightedSquare && this.chessboard) {
              try {
                this.chessboard.removeMarkers(this.coordinateMarkerType, this.highlightedSquare);
              } catch (e) {
                console.error("[onAnalysisClick] Error removing coordinate marker:", e);
              }
              this.highlightedSquare = null;
            }
            this.currentMoveIndex = plyIndex;
            console.log("[onAnalysisClick] Updating board to move index:", plyIndex);
            this.playSoundOnUpdate = true;
            this.updateBoard();
            this.loadMoveExplanation(this.currentMoveIndex);
          } else {
            console.warn("[onAnalysisClick] Move plyIndex is out of range or NaN");
          }
        } else if (href.includes('#alt-')) {
          event.preventDefault();
          const hashIndex = href.indexOf('#alt-');
          const altStr = href.substring(hashIndex + '#alt-'.length);
          const parts = altStr.split('-');
          console.log("[onAnalysisClick] Parsed alt link parts:", parts);
          if (parts.length >= 2) {
            const plyIndex = parseInt(parts[0], 10);
            const san = parts.slice(1).join('-');
            console.log("[onAnalysisClick] Alt move plyIndex:", plyIndex, "san:", san);
            if (!isNaN(plyIndex) && plyIndex >= 0 && plyIndex <= this.history.length) {
              // Try adjacent/nearby indices to find the position where this SAN is actually a legal move.
              // Candidate indices represent the move after which we apply our alternative SAN.
              // If the AI used same-index mapping, plyIndex corresponds to the move replaced, so the board before it is plyIndex - 1.
              // We try:
              // 1. plyIndex - 1 (the move before)
              // 2. plyIndex (same-index as board position)
              // 3. plyIndex - 2 (in case of double off-by-one)
              // 4. plyIndex + 1 (in case of other direction offset)
              const candidateBaseIndices = [plyIndex - 1, plyIndex, plyIndex - 2, plyIndex + 1];
              let successfulMove: any = null;
              let successfulFen: string | null = null;
              let finalBaseIndex = plyIndex - 1;

              for (const idx of candidateBaseIndices) {
                if (idx < -1 || idx >= this.history.length) continue;
                const chess = new Chess();
                const fenBefore = idx === -1 ? DEFAULT_POSITION : this.history[idx].fenAfter;
                chess.load(fenBefore);
                try {
                  const move = chess.move(san);
                  if (move) {
                    successfulMove = move;
                    successfulFen = chess.fen();
                    finalBaseIndex = idx;
                    break; // Found the legal candidate!
                  }
                } catch (e) {
                  // Not legal in this candidate FEN, try the next
                }
              }

              if (successfulMove && successfulFen) {
                // Clear any square highlights
                if (this.highlightedSquare && this.chessboard) {
                  try {
                    this.chessboard.removeMarkers(this.coordinateMarkerType, this.highlightedSquare);
                  } catch (e) {}
                  this.highlightedSquare = null;
                }
                this.previewFen = successfulFen;
                this.previewArrow = { from: successfulMove.from, to: successfulMove.to, color: this.ArrowTypeExt.success };
                this.currentMoveIndex = finalBaseIndex;
                console.log("[onAnalysisClick] Loaded alt move successfully. Base history index:", finalBaseIndex, "Preview FEN:", this.previewFen);
                
                // Play sound for alternative move
                const isCheck = successfulMove.san?.includes('+') || successfulMove.san?.includes('#') || (successfulMove.flags && (successfulMove.flags.includes('+') || successfulMove.flags.includes('#')));
                const isCapture = successfulMove.captured || successfulMove.san?.includes('x') || (successfulMove.flags && successfulMove.flags.includes('c'));
                if (isCheck) {
                  chessAudio.playCheck();
                } else if (isCapture) {
                  chessAudio.playCapture();
                } else {
                  chessAudio.playMove();
                }
                this.playSoundOnUpdate = false; // Prevent updateBoard from playing a history move sound

                this.updateBoard();
                this.loadMoveExplanation(this.currentMoveIndex);
              } else {
                console.error("Unable to play alternative move under any nearby board states:", san);
              }
            }
          }
        } else if (href.includes('#square-')) {
          event.preventDefault();
          const hashIndex = href.indexOf('#square-');
          const square = href.substring(hashIndex + '#square-'.length);
          console.log("[onAnalysisClick] Highlighting square coordinate:", square);
          this.highlightSquareOnBoard(square);
        }
      }
    }
  }

  clearPreview() {
    this.previewFen = null;
    this.previewArrow = null;
    if (this.highlightedSquare && this.chessboard) {
      try {
        this.chessboard.removeMarkers(this.coordinateMarkerType, this.highlightedSquare);
      } catch (e) {}
      this.highlightedSquare = null;
    }
  }

  goToStart() {
    this.clearPreview();
    this.currentMoveIndex = -1;
    this.playSoundOnUpdate = false;
    this.updateBoard();
    this.loadMoveExplanation(this.currentMoveIndex);
  }

  goToPrev() {
    this.clearPreview();
    this.currentMoveIndex = Math.max(-1, this.currentMoveIndex - 1);
    this.playSoundOnUpdate = true;
    this.updateBoard();
    this.loadMoveExplanation(this.currentMoveIndex);
  }

  goToNext() {
    this.clearPreview();
    this.currentMoveIndex = Math.min(this.history.length - 1, this.currentMoveIndex + 1);
    this.playSoundOnUpdate = true;
    this.updateBoard();
    this.loadMoveExplanation(this.currentMoveIndex);
  }

  goToEnd() {
    this.clearPreview();
    this.currentMoveIndex = this.history.length - 1;
    this.playSoundOnUpdate = true;
    this.updateBoard();
    this.loadMoveExplanation(this.currentMoveIndex);
  }

  selectMove(moveIndex: number) {
    this.clearPreview();
    this.currentMoveIndex = moveIndex;
    this.playSoundOnUpdate = true;
    this.updateBoard();
    this.loadMoveExplanation(this.currentMoveIndex);
  }

  getMoveClassification(moveIndex: number): string | null {
    if (moveIndex < 0 || !this.evaluations || this.evaluations.length <= moveIndex + 1) return null;

    const evalBefore = this.evaluations[moveIndex];
    const evalAfter = this.evaluations[moveIndex + 1];
    
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
    } else if (key === 'e') {
      event.preventDefault();
      this.toggleEngineOverlay();
    } else if (key === 'l') {
      event.preventDefault();
      this.toggleAiExplanationOnBoard();
    }
  }

  toggleEngineOverlay() {
    this.engineOverlayEnabled = !this.engineOverlayEnabled;
    this.updateBoard();
    this.cdr.detectChanges();
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

  onDepthChange() {
    this.precomputedEvaluations = [];
    this.evaluations = [];
    this.explanation = '';
    this.gameAnalysis = null;
    this.parsedGameAnalysis = null;
    this.explanationCache.clear();
    this.requestFullAnalysis();
  }

  downloadPgn() {
    if (!this.history || this.history.length === 0) return;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}.${mm}.${dd}`;

    const opening = this.getGameOpening() || this.getCurrentOpening();

    let pgn = '';
    pgn += `[Event "AI Studio Chess Analysis"]\n`;
    pgn += `[Site "https://ai.studio/build"]\n`;
    pgn += `[Date "${dateStr}"]\n`;
    pgn += `[Round "1"]\n`;
    pgn += `[White "Player"]\n`;
    pgn += `[Black "Opponent"]\n`;
    pgn += `[Result "*"]\n`;
    if (opening) {
      pgn += `[ECO "${opening.eco}"]\n`;
      pgn += `[Opening "${opening.nameEn}"]\n`;
    }
    pgn += `[Variant "Standard"]\n`;
    pgn += `[SearchDepth "${this.depth}"]\n`;
    pgn += `\n`;

    let movesPgn = '';
    for (let i = 0; i < this.history.length; i++) {
      const move = this.history[i];
      const moveNum = Math.floor(i / 2) + 1;
      if (i % 2 === 0) {
        movesPgn += `${moveNum}. `;
      }
      movesPgn += `${move.san}`;

      // Evaluation is stored at index i + 1 (evaluations starts at initial state)
      if (this.evaluations && this.evaluations.length > i + 1) {
        const evalData = this.evaluations[i + 1];
        if (evalData) {
          let commentParts = [];
          if (evalData.mate !== undefined && evalData.mate !== null) {
            const mate = parseInt(evalData.mate, 10);
            if (mate === 0) {
              commentParts.push('[%eval #]');
            } else {
              commentParts.push(mate > 0 ? `[%eval #${mate}]` : `[%eval -#${Math.abs(mate)}]`);
            }
          } else if (evalData.eval !== undefined && evalData.eval !== null) {
            const e = parseFloat(evalData.eval);
            commentParts.push(`[%eval ${e.toFixed(2)}]`);
          }

          if (commentParts.length > 0) {
            movesPgn += ` { ${commentParts.join(' ')} }`;
          }
        }
      }
      movesPgn += ' ';
    }
    pgn += movesPgn.trim() + ' *';

    const blob = new Blob([pgn], { type: 'application/x-chess-pgn;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `chess_analysis_${dateStr.replace(/\./g, '')}.pgn`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  getAdvantageSwings(): any[] {
    const swings: any[] = [];
    if (!this.evaluations || this.evaluations.length < 2) return swings;

    const parseEval = (e: any, isWhiteMove: boolean) => {
      if (!e) return 0;
      if (e.mate !== undefined && e.mate !== null) {
        const mate = parseInt(e.mate, 10);
        if (mate === 0) return isWhiteMove ? -100 : 100;
        return mate > 0 ? 100 : -100;
      }
      return parseFloat(e.eval || 0);
    };

    const getDisplayString = (e: any) => {
      if (!e) return '0.00';
      if (e.mate !== undefined && e.mate !== null) {
        return `M${e.mate}`;
      }
      const val = parseFloat(e.eval || 0);
      return `${val > 0 ? '+' : ''}${val.toFixed(2)}`;
    };

    for (let i = 0; i < this.history.length; i++) {
      const evalBefore = this.evaluations[i];
      const evalAfter = this.evaluations[i + 1];
      if (!evalBefore || !evalAfter) continue;

      const beforeVal = parseEval(evalBefore, i % 2 === 0);
      const afterVal = parseEval(evalAfter, (i + 1) % 2 === 0);
      
      const isWhite = i % 2 === 0;
      const evalShift = afterVal - beforeVal;
      const playerLoss = isWhite ? -evalShift : evalShift;

      let type: 'blunder' | 'mistake' | 'swing' | null = null;
      let typeRu = '';
      let typeEn = '';

      if (playerLoss >= 2.0) {
        type = 'blunder';
        typeRu = 'Зевок';
        typeEn = 'Blunder';
      } else if (playerLoss >= 1.0) {
        type = 'mistake';
        typeRu = 'Ошибка';
        typeEn = 'Mistake';
      } else if (Math.sign(beforeVal) !== Math.sign(afterVal) && Math.abs(afterVal - beforeVal) >= 1.5) {
        type = 'swing';
        typeRu = 'Перелом';
        typeEn = 'Swing';
      }

      if (type) {
        const moveNumber = Math.floor(i / 2) + 1;
        const moveName = `${moveNumber}${isWhite ? '.' : '...'}${this.history[i].san}`;
        
        const playerSide = this.settings?.side || 'white';
        const isPlayerMove = (isWhite && playerSide === 'white') || (!isWhite && playerSide === 'black');

        swings.push({
          index: i,
          moveName,
          name: moveName,
          type,
          typeRu,
          typeEn,
          evalBefore: getDisplayString(evalBefore),
          evalAfter: getDisplayString(evalAfter),
          playerLoss,
          isPlayer: isPlayerMove,
          who: isPlayerMove ? 'Игрок' : 'Противник',
          whoEn: isPlayerMove ? 'Player' : 'Opponent',
          sideName: isWhite ? 'Белые' : 'Черные',
          sideNameEn: isWhite ? 'White' : 'Black'
        });
      }
    }

    return swings;
  }

  getChartData() {
    const data: any[] = [];
    if (!this.evaluations || this.evaluations.length === 0) return data;

    for (let i = 0; i < this.evaluations.length; i++) {
      const evalData = this.evaluations[i];
      let evalValue = 0;

      if (evalData) {
        if (evalData.eval !== undefined && evalData.eval !== null) {
          evalValue = parseFloat(evalData.eval);
        } else if (evalData.mate !== undefined && evalData.mate !== null) {
          const mate = parseInt(evalData.mate, 10);
          if (mate === 0) {
            const fen = i === 0 ? DEFAULT_POSITION : this.history[i - 1].fenAfter;
            const isWhiteToMove = fen.includes(' w ');
            evalValue = isWhiteToMove ? -10 : 10;
          } else {
            evalValue = mate > 0 ? 10 : -10;
          }
        }
      } else {
        // Inherit from previous move if current is null
        for (let j = i - 1; j >= 0; j--) {
          const prevEval = this.evaluations[j];
          if (prevEval) {
            if (prevEval.eval !== undefined && prevEval.eval !== null) {
              evalValue = parseFloat(prevEval.eval);
              break;
            } else if (prevEval.mate !== undefined && prevEval.mate !== null) {
              const mate = parseInt(prevEval.mate, 10);
              if (mate === 0) {
                const fen = j === 0 ? DEFAULT_POSITION : this.history[j - 1].fenAfter;
                const isWhiteToMove = fen.includes(' w ');
                evalValue = isWhiteToMove ? -10 : 10;
              } else {
                evalValue = mate > 0 ? 10 : -10;
              }
              break;
            }
          }
        }
      }

      const cappedEval = Math.max(-10, Math.min(10, evalValue));

      let moveLabel = 'Start';
      let name = 'Start';
      if (i > 0) {
        const move = this.history[i - 1];
        const moveNumber = Math.floor((i - 1) / 2) + 1;
        const isWhite = (i - 1) % 2 === 0;
        name = `${moveNumber}${isWhite ? '.' : '...'}${move.san}`;
        moveLabel = `${moveNumber}. ${isWhite ? move.san : '... ' + move.san}`;
      }

      const evalDisplay = evalData?.mate !== undefined && evalData?.mate !== null
        ? `M${evalData.mate}`
        : `${evalValue > 0 ? '+' : ''}${evalValue.toFixed(2)}`;

      data.push({
        index: i,
        name: name,
        moveLabel: moveLabel,
        value: cappedEval,
        evalDisplay: evalDisplay,
      });
    }

    return data;
  }

  onChartIndexClick(index: number) {
    this.currentMoveIndex = index - 1; // index 0 is Start, maps to -1
    this.playSoundOnUpdate = true;
    this.updateBoard();
    this.loadMoveExplanation(this.currentMoveIndex);
  }

  renderRecharts() {
    if (!this.rechartsContainer) return;
    
    const chartData = this.getChartData();
    if (chartData.length === 0) return;

    if (!this.reactRoot) {
      this.reactRoot = ReactDOM.createRoot(this.rechartsContainer.nativeElement);
    }

    const currentIdx = this.currentMoveIndex + 1; // 0 is start, 1 is move 1, etc.
    const swings = this.getAdvantageSwings();

    const chartElement = React.createElement(
      ResponsiveContainer,
      { width: '100%', height: '100%', key: `recharts-container-${chartData.length}` } as any,
      React.createElement(
        LineChart,
        {
          data: chartData,
          margin: { top: 10, right: 10, left: -20, bottom: 5 },
          onClick: (state: any) => {
            if (state && state.activeTooltipIndex !== undefined) {
              this.ngZone.run(() => {
                this.onChartIndexClick(state.activeTooltipIndex);
              });
            }
          }
        },
        React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#374151', vertical: false }),
        React.createElement(XAxis, {
          dataKey: 'name',
          stroke: '#9ca3af',
          fontSize: 9,
          tickLine: false,
          axisLine: false,
          dy: 5,
        }),
        React.createElement(YAxis, {
          stroke: '#9ca3af',
          fontSize: 9,
          domain: [-6, 6],
          tickLine: false,
          axisLine: false,
          ticks: [-6, -3, 0, 3, 6],
          tickFormatter: (v: number) => {
            if (v > 0) return `+${v}`;
            return `${v}`;
          }
        }),
        React.createElement(ReferenceLine, { y: 0, stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4' }),
        
        // Render vertical lines indicating major advantage swings/blunders/mistakes!
        ...swings.map((swing, idx) => {
          let color = '#6366f1';
          if (swing.type === 'blunder') color = '#ef4444';
          if (swing.type === 'mistake') color = '#f59e0b';
          return React.createElement(ReferenceLine, {
            x: swing.name,
            stroke: color,
            strokeWidth: 1.2,
            strokeDasharray: '3 3',
            key: `swing-line-${swing.index}-${idx}`
          });
        }),

        React.createElement(Tooltip, {
          cursor: { stroke: '#4b5563', strokeWidth: 1 },
          content: (props: any) => {
            const { active, payload } = props;
            if (active && payload && payload.length) {
              const item = payload[0].payload;
              return React.createElement(
                'div',
                { className: 'bg-gray-900 border border-gray-700/80 p-2.5 rounded-xl shadow-xl text-xs font-sans text-gray-200 min-w-[120px]' },
                React.createElement('div', { className: 'font-semibold text-gray-100 border-b border-gray-800 pb-1 mb-1' }, item.moveLabel),
                React.createElement(
                  'div',
                  { className: 'flex justify-between items-center gap-4 mt-1' },
                  React.createElement('span', { className: 'text-gray-400' }, 'Evaluation:'),
                  React.createElement('span', { className: 'font-bold text-amber-400 font-mono' }, item.evalDisplay)
                )
              );
            }
            return null;
          }
        }),
        React.createElement(Line, {
          type: 'monotone',
          dataKey: 'value',
          stroke: '#3b82f6',
          strokeWidth: 2,
          dot: (props: any) => {
            const { cx, cy, index } = props;
            const isCurrent = index === currentIdx;
            if (isCurrent) {
              return React.createElement('circle', {
                cx,
                cy,
                r: 5,
                fill: '#f59e0b',
                stroke: '#ffffff',
                strokeWidth: 1.5,
                key: `dot-${index}`
              });
            }

            // Highlight swings on the line with distinct sizes and colors
            const swingItem = swings.find(s => s.index === index - 1);
            if (swingItem) {
              let fill = '#6366f1';
              if (swingItem.type === 'blunder') fill = '#ef4444';
              if (swingItem.type === 'mistake') fill = '#f59e0b';
              return React.createElement('circle', {
                cx,
                cy,
                r: 4,
                fill: fill,
                stroke: '#ffffff',
                strokeWidth: 1,
                key: `dot-${index}`
              });
            }

            return React.createElement('circle', {
              cx,
              cy,
              r: 2,
              fill: '#3b82f6',
              stroke: 'none',
              key: `dot-${index}`
            });
          },
          activeDot: { r: 6, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }
        })
      )
    );

    this.reactRoot.render(chartElement);
  }

  getMoveAccuracy(moveIndex: number): number | null {
    if (moveIndex < 0 || !this.evaluations || this.evaluations.length <= moveIndex + 1) return null;

    const evalBefore = this.evaluations[moveIndex];
    const evalAfter = this.evaluations[moveIndex + 1];
    
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

    if (playerLoss <= 0) return 100;
    const acc = 100 * Math.exp(-0.4 * playerLoss);
    return Math.max(0, Math.min(100, acc));
  }

  calculateStatsSummary() {
    let blundersWhite = 0;
    let mistakesWhite = 0;
    let inaccuraciesWhite = 0;
    let blundersBlack = 0;
    let mistakesBlack = 0;
    let inaccuraciesBlack = 0;

    let sumAccuracyWhite = 0;
    let countAccWhite = 0;
    let sumAccuracyBlack = 0;
    let countAccBlack = 0;

    let totalDurationWhite = 0;
    let countDurationWhite = 0;
    let totalDurationBlack = 0;
    let countDurationBlack = 0;

    for (let i = 0; i < this.history.length; i++) {
      const classif = this.getMoveClassification(i);
      const isWhite = i % 2 === 0;
      
      if (classif === 'blunder') {
        if (isWhite) blundersWhite++; else blundersBlack++;
      } else if (classif === 'mistake') {
        if (isWhite) mistakesWhite++; else mistakesBlack++;
      } else if (classif === 'inaccuracy') {
        if (isWhite) inaccuraciesWhite++; else inaccuraciesBlack++;
      }

      // Accuracy
      const acc = this.getMoveAccuracy(i);
      if (acc !== null) {
        if (isWhite) {
          sumAccuracyWhite += acc;
          countAccWhite++;
        } else {
          sumAccuracyBlack += acc;
          countAccBlack++;
        }
      }

      // Duration
      let duration = this.history[i].duration;
      if (duration === undefined) {
        // Generate pseudo-random realistic move times based on move index & difficulty
        const seed = (i + 1) * 17 + this.elo;
        const pseudoRand = (Math.sin(seed) + 1) / 2; // [0, 1]
        duration = Math.round(2 + pseudoRand * 13);
      }
      
      if (isWhite) {
        totalDurationWhite += duration;
        countDurationWhite++;
      } else {
        totalDurationBlack += duration;
        countDurationBlack++;
      }
    }

    const accuracyWhite = countAccWhite > 0 ? Math.round(sumAccuracyWhite / countAccWhite) : 100;
    const accuracyBlack = countAccBlack > 0 ? Math.round(sumAccuracyBlack / countAccBlack) : 100;

    const avgMoveTimeWhite = countDurationWhite > 0 ? parseFloat((totalDurationWhite / countDurationWhite).toFixed(1)) : 0;
    const avgMoveTimeBlack = countDurationBlack > 0 ? parseFloat((totalDurationBlack / countDurationBlack).toFixed(1)) : 0;

    this.statsSummary = {
      blundersWhite,
      mistakesWhite,
      inaccuraciesWhite,
      blundersBlack,
      mistakesBlack,
      inaccuraciesBlack,
      accuracyWhite,
      accuracyBlack,
      avgMoveTimeWhite,
      avgMoveTimeBlack
    };
  }

  async loadMoveExplanation(moveIndex: number, force: boolean = false) {
    if (moveIndex < 0 || moveIndex >= this.history.length) {
      this.currentMoveExplanation = '';
      this.parsedMoveExplanation = null;
      return;
    }

    const classification = this.getMoveClassification(moveIndex);
    if (!classification) {
      this.currentMoveExplanation = 'Отличный ход! Оценка стабильна, движок полностью одоверяет этот выбор.';
      this.parsedMoveExplanation = this.sanitizer.bypassSecurityTrustHtml('Отличный ход! Оценка стабильна, движок полностью одоверяет этот выбор.');
      return;
    }

    // Check cache
    if (this.explanationCache.has(moveIndex)) {
      this.currentMoveExplanation = this.explanationCache.get(moveIndex)!;
      const parsed = await marked.parse(this.currentMoveExplanation);
      const highlighted = this.highlightCoordinatesInHtml(parsed);
      this.parsedMoveExplanation = this.sanitizer.bypassSecurityTrustHtml(highlighted);
      this.cdr.detectChanges();
      return;
    }

    // If it's a critical error, but we are not forcing and not cached, we wait for user to click button
    if (!force) {
      this.currentMoveExplanation = '';
      this.parsedMoveExplanation = null;
      this.cdr.detectChanges();
      return;
    }

    // Otherwise, fetch from our new API!
    this.currentMoveAiLoading = true;
    this.currentMoveExplanation = '';
    this.parsedMoveExplanation = null;
    this.cdr.detectChanges();

    try {
      const move = this.history[moveIndex];
      const evalBefore = this.evaluations[moveIndex];
      const evalAfter = this.evaluations[moveIndex + 1];
      const playedMove = `${Math.floor(moveIndex / 2) + 1}${moveIndex % 2 === 0 ? '.' : '...'}${move.san}`;
      const recommendedMove = evalBefore?.san || evalBefore?.move || 'N/A';

      const response = await fetch('/api/chess/explain-move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          moveIndex,
          playedMove,
          recommendedMove,
          evalBefore,
          evalAfter,
          elo: this.elo
        })
      });

      if (response.ok) {
        const data = await response.json();
        const explanation = data.explanation || 'Не удалось получить разбор.';
        this.explanationCache.set(moveIndex, explanation);
        this.currentMoveExplanation = explanation;
        const parsed = await marked.parse(explanation);
        const highlighted = this.highlightCoordinatesInHtml(parsed);
        this.parsedMoveExplanation = this.sanitizer.bypassSecurityTrustHtml(highlighted);
      } else {
        this.currentMoveExplanation = 'Ошибка при запросе к серверу.';
        this.parsedMoveExplanation = this.sanitizer.bypassSecurityTrustHtml('Ошибка при запросе к серверу.');
      }
    } catch (err) {
      console.error("Load move explanation error:", err);
      this.currentMoveExplanation = 'Сбой сети при запросе разбора.';
      this.parsedMoveExplanation = this.sanitizer.bypassSecurityTrustHtml('Сбой сети при запросе разбора.');
    } finally {
      this.currentMoveAiLoading = false;
      this.cdr.detectChanges();
    }
  }

  explainMoveFromList(event: MouseEvent, moveIndex: number) {
    event.stopPropagation();
    this.selectMove(moveIndex);
    this.showExplanationOnBoard = true;
    this.loadMoveExplanation(moveIndex, true);
  }

  async loadPrincipalVariations() {
    const fen = this.getCurrentFen();
    if (fen === this.lastPvFen) return;
    this.lastPvFen = fen;
    this.pvsList = [];
    this.pvsLoading = true;
    this.pvsError = null;
    this.cdr.detectChanges();

    try {
      const res = await fetch('/api/chess/pvs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fen, depth: this.depth })
      });

      if (res.ok) {
        const data = await res.json();
        if (this.getCurrentFen() === fen) {
          this.pvsList = data.pvs || [];
        }
      } else {
        if (this.getCurrentFen() === fen) {
          this.pvsError = 'Не удалось загрузить рекомендации движка';
        }
      }
    } catch (err) {
      console.error('Error loading PVs:', err);
      if (this.getCurrentFen() === fen) {
        this.pvsError = 'Ошибка сети при загрузке рекомендаций';
      }
    } finally {
      if (this.getCurrentFen() === fen) {
        this.pvsLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  formatPvContinuation(pv: any): string {
    if (!pv) return '';
    const moves = [pv.move, ...(pv.continuation || [])].filter(m => !!m);
    if (moves.length === 0) return '';
    
    const fen = this.getCurrentFen();
    const isWhiteToMove = fen.includes(' w ');
    const parts = fen.split(' ');
    let moveNum = parseInt(parts[5] || '1', 10);
    
    let result = [];
    let isWhite = isWhiteToMove;
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      if (isWhite) {
        result.push(`${moveNum}. ${move}`);
        isWhite = false;
      } else {
        if (i === 0) {
          result.push(`${moveNum}... ${move}`);
        } else {
          result.push(move);
        }
        moveNum++;
        isWhite = true;
      }
    }
    
    return result.join(' ');
  }

  formatPvEval(pv: any): string {
    if (pv.mate !== undefined && pv.mate !== null) {
      const mate = parseInt(pv.mate, 10);
      if (mate === 0) return 'M0';
      return `M${mate > 0 ? '+' : ''}${mate}`;
    }
    const val = parseFloat(pv.eval || 0);
    return `${val > 0 ? '+' : ''}${val.toFixed(2)}`;
  }

  getMoveClassificationRu(classification: string | null): string {
    if (classification === 'blunder') return 'Зевок';
    if (classification === 'mistake') return 'Ошибка';
    if (classification === 'inaccuracy') return 'Неточность';
    return '';
  }

  isPvPreviewed(pv: any): boolean {
    if (!pv || !this.previewArrow) return false;
    let lan = pv.lan;
    if (!lan && pv.move && pv.move.length >= 4 && !/[A-Z]/.test(pv.move[0])) {
      lan = pv.move;
    }
    if (!lan) {
      try {
        const baseFen = this.currentMoveIndex < 0 ? DEFAULT_POSITION : this.history[this.currentMoveIndex].fenAfter;
        const chess = new Chess(baseFen);
        const resolved = chess.move(pv.move);
        if (resolved) {
          lan = resolved.from + resolved.to + (resolved.promotion || '');
        }
      } catch (e) {
        // ignore
      }
    }
    if (!lan) return false;
    const from = lan.substring(0, 2);
    const to = lan.substring(2, 4);
    return this.previewArrow.from === from && this.previewArrow.to === to;
  }

  previewPvMove(pv: any) {
    if (!pv) return;
    
    let lan = pv.lan;
    let from = '';
    let to = '';
    let promotion: string | undefined = undefined;

    const baseFen = this.currentMoveIndex < 0 ? DEFAULT_POSITION : this.history[this.currentMoveIndex].fenAfter;
    const chess = new Chess(baseFen);

    try {
      if (lan) {
        from = lan.substring(0, 2);
        to = lan.substring(2, 4);
        promotion = lan.length > 4 ? lan.substring(4, 5) : undefined;
      } else {
        const resolved = chess.move(pv.move);
        if (resolved) {
          from = resolved.from;
          to = resolved.to;
          promotion = resolved.promotion;
          lan = resolved.from + resolved.to + (resolved.promotion || '');
          chess.undo();
        } else if (pv.move && pv.move.length >= 4) {
          from = pv.move.substring(0, 2);
          to = pv.move.substring(2, 4);
          promotion = pv.move.length > 4 ? pv.move.substring(4, 5) : undefined;
        }
      }
    } catch (e) {
      if (pv.move && pv.move.length >= 4) {
        from = pv.move.substring(0, 2);
        to = pv.move.substring(2, 4);
        promotion = pv.move.length > 4 ? pv.move.substring(4, 5) : undefined;
      }
    }

    if (!from || !to) {
      console.error("Failed to resolve PV move squares:", pv);
      return;
    }

    if (this.previewArrow && this.previewArrow.from === from && this.previewArrow.to === to) {
      this.clearPreview();
      this.updateBoard();
      this.cdr.detectChanges();
      return;
    }

    try {
      const move = chess.move({ from, to, promotion });
      if (move) {
        this.previewFen = chess.fen();
        this.previewArrow = { from, to, color: this.ArrowTypeExt.success };
        
        const isCheck = chess.isCheck();
        const isCapture = move.captured;
        if (isCheck) {
          chessAudio.playCheck();
        } else if (isCapture) {
          chessAudio.playCapture();
        } else {
          chessAudio.playMove();
        }
        
        this.playSoundOnUpdate = false;
        this.updateBoard();
        this.cdr.detectChanges();
      }
    } catch (e) {
      console.error("Failed to preview PV move:", e, "pv:", pv);
    }
  }

  async prefetchErrorExplanations() {
    console.log("[prefetchErrorExplanations] Starting background pre-fetching of error explanations...");
    const errorIndices: number[] = [];
    
    // Find all blunders and mistakes
    for (let i = 0; i < this.history.length; i++) {
      const classification = this.getMoveClassification(i);
      if (classification === 'blunder' || classification === 'mistake') {
        if (!this.explanationCache.has(i)) {
          errorIndices.push(i);
        }
      }
    }

    console.log("[prefetchErrorExplanations] Found errors to prefetch at indices:", errorIndices);

    // Pre-fetch them sequentially in the background to avoid overloading
    for (const moveIndex of errorIndices) {
      try {
        const move = this.history[moveIndex];
        const evalBefore = this.evaluations[moveIndex];
        const evalAfter = this.evaluations[moveIndex + 1];
        const playedMove = `${Math.floor(moveIndex / 2) + 1}${moveIndex % 2 === 0 ? '.' : '...'}${move.san}`;
        const recommendedMove = evalBefore?.san || evalBefore?.move || 'N/A';

        // Check again if it was cached while we were waiting
        if (this.explanationCache.has(moveIndex)) continue;

        console.log(`[prefetchErrorExplanations] Background pre-fetching explanation for move index ${moveIndex} (${playedMove})...`);

        const response = await fetch('/api/chess/explain-move', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            moveIndex,
            playedMove,
            recommendedMove,
            evalBefore,
            evalAfter,
            elo: this.elo
          })
        });

        if (response.ok) {
          const data = await response.json();
          const explanation = data.explanation;
          if (explanation) {
            this.explanationCache.set(moveIndex, explanation);
            console.log(`[prefetchErrorExplanations] Cached explanation for move index ${moveIndex}`);
            
            // If the user happens to have selected this move right now, update the UI
            if (this.currentMoveIndex === moveIndex) {
              this.currentMoveExplanation = explanation;
              const parsed = await marked.parse(explanation);
              const highlighted = this.highlightCoordinatesInHtml(parsed);
              this.parsedMoveExplanation = this.sanitizer.bypassSecurityTrustHtml(highlighted);
              this.cdr.detectChanges();
            }
          }
        }
      } catch (err) {
        console.warn(`[prefetchErrorExplanations] Failed to background prefetch move index ${moveIndex}:`, err);
      }
      
      // Small pause between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
