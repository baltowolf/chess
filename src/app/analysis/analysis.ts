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
} from 'lucide-angular';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getWebSocketUrl } from '../../utils/config';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './analysis.html',
  styleUrl: './analysis.css',
})
export class Analysis implements OnInit, OnDestroy, AfterViewInit {
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly RotateCcw = RotateCcw;
  readonly MessageSquare = MessageSquare;
  readonly Math = Math;

  @Input() history: any[] = [];
  @Input() depth: number = 8;
  @Input() precomputedEvaluations: any[] = [];
  @Input() elo: number = 1500;
  @Output() goBack = new EventEmitter<void>();

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone, private sanitizer: DomSanitizer) {}

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;
  @ViewChild('chartSvg', { static: false }) chartSvg!: ElementRef;

  chessboard: any;
  ws: WebSocket | null = null;

  currentMoveIndex: number = 0;
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

  // ⚡ Bolt: Cache explanations to prevent redundant backend/AI calls when stepping back and forth
  explanationCache: Map<number, string> = new Map();

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

    this.chessboard = new Chessboard(this.boardContainer.nativeElement, {
      position: this.getCurrentFen(),
      assetsUrl: '/assets/',
      assetsCache: true,
      style: {
        cssClass: 'default',
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
  }

  getCurrentMove() {
    return this.history[this.currentMoveIndex];
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
    if (this.chessboard) {
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
      } else if (this.currentMoveIndex >= 0 && this.currentMoveIndex < this.history.length) {
        const move = this.history[this.currentMoveIndex];
        const arrowType = this.getArrowTypeForMove(this.currentMoveIndex);
        console.log("Drawing history arrow:", move.from, move.to, arrowType);
        if (this.chessboard.addArrow) {
          this.chessboard.addArrow(arrowType, move.from, move.to);
        }
      }

      // Redraw highlighted square marker if present
      if (this.highlightedSquare) {
        this.chessboard.addMarker(this.coordinateMarkerType, this.highlightedSquare);
      }
    }
  }

  requestFullAnalysis() {
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
    if (!this.evaluations || this.evaluations.length === 0) return;

    // SVG Dimensions
    const width = 600;
    const height = 200;
    const midY = height / 2;

    const stepX = width / Math.max(1, this.evaluations.length - 1);

    let path = `M 0,${midY}`;

    for (let i = 0; i < this.evaluations.length; i++) {
      const evalData = this.evaluations[i];
      let evalValue = 0;

      if (evalData) {
        if (evalData.eval !== undefined && evalData.eval !== null) {
           evalValue = parseFloat(evalData.eval);
        } else if (evalData.mate !== undefined && evalData.mate !== null) {
           const mate = parseInt(evalData.mate, 10);
           if (mate === 0) {
              // Current side is checkmated
              const fen = i === 0 ? DEFAULT_POSITION : this.history[i - 1].fenAfter;
              const isWhiteToMove = fen.includes(' w ');
              evalValue = isWhiteToMove ? -10 : 10;
           } else {
              evalValue = mate > 0 ? 10 : -10;
           }
        }
      } else {
        // Inherit from previous move if current is null (e.g., due to rate limiting)
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

      // Cap at +/- 5 pawns for visualization
      const cappedEval = Math.max(-5, Math.min(5, evalValue));

      // Map [-5, 5] to [height, 0]
      const y = midY - (cappedEval / 5) * midY;
      const x = i * stepX;

      path += ` L ${x},${y}`;
    }

    path += ` L ${width},${midY} Z`;
    this.chartPoints = path;
  }

  onChartClick(event: MouseEvent) {
    if (!this.evaluations || this.evaluations.length === 0 || !this.chartSvg) return;

    const rect = this.chartSvg.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));

    const index = Math.round(percentage * (this.evaluations.length - 1));
    this.currentMoveIndex = index - 1; // map back to move index (-1 is start)

    this.updateBoard();
  }

  highlightCoordinatesInHtml(html: string): string {
    if (!html) return html;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
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
            const regex = /\b([a-h][1-8])\b/gi;
            if (regex.test(text)) {
              // Create a document fragment to hold the new structure
              const fragment = doc.createDocumentFragment();
              const container = doc.createElement('div');
              container.innerHTML = text.replace(regex, (match) => {
                return `<a href="#square-${match.toLowerCase()}" class="coordinate-link text-blue-400 hover:underline hover:text-blue-300 font-mono font-semibold">${match}</a>`;
              });
              
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
            this.updateBoard();
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
              const chess = new Chess();
              const fenBefore = plyIndex === 0 ? DEFAULT_POSITION : this.history[plyIndex - 1].fenAfter;
              chess.load(fenBefore);
              try {
                const move = chess.move(san);
                if (move) {
                  // Clear any square highlights
                  if (this.highlightedSquare && this.chessboard) {
                    try {
                      this.chessboard.removeMarkers(this.coordinateMarkerType, this.highlightedSquare);
                    } catch (e) {}
                    this.highlightedSquare = null;
                  }
                  this.previewFen = chess.fen();
                  this.previewArrow = { from: move.from, to: move.to, color: this.ArrowTypeExt.success };
                  // Keep the currentMoveIndex at the move before the suggested one, but show the preview
                  this.currentMoveIndex = plyIndex - 1; 
                  console.log("[onAnalysisClick] Setting preview for alt move. Preview FEN:", this.previewFen, "previewArrow:", this.previewArrow);
                  this.updateBoard();
                }
              } catch (e) {
                console.error("Invalid alternative move:", san, e);
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
    this.updateBoard();
  }

  goToPrev() {
    this.clearPreview();
    this.currentMoveIndex = Math.max(-1, this.currentMoveIndex - 1);
    this.updateBoard();
  }

  goToNext() {
    this.clearPreview();
    this.currentMoveIndex = Math.min(this.history.length - 1, this.currentMoveIndex + 1);
    this.updateBoard();
  }

  goToEnd() {
    this.clearPreview();
    this.currentMoveIndex = this.history.length - 1;
    this.updateBoard();
  }
}
