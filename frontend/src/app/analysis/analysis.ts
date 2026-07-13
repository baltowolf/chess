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
import { Chess } from 'chess.js';
import {
  LucideAngularModule,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  MessageSquare,
} from 'lucide-angular';
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
  @Output() goBack = new EventEmitter<void>();

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;
  @ViewChild('chartSvg', { static: false }) chartSvg!: ElementRef;

  chessboard: any;
  ws: WebSocket | null = null;

  currentMoveIndex: number = 0;
  explanation: string = '';
  isLoading: boolean = true;
  gameAnalysis: any = null;
  evaluations: any[] = [];

  // Chart calculation data
  chartPoints: string = "";

  // Extensions
  ArrowsExt: any = null;
  ArrowTypeExt: any = null;

  // ⚡ Bolt: Cache explanations to prevent redundant backend/AI calls when stepping back and forth
  explanationCache: Map<number, string> = new Map();

  ngOnInit() {
    this.currentMoveIndex = this.history.length - 1;
    this.requestFullAnalysis();
  }

  async ngAfterViewInit() {
    const { Chessboard } = await import('cm-chessboard');
    const { Arrows, ARROW_TYPE } = await import('cm-chessboard/src/extensions/arrows/Arrows.js');
    this.ArrowsExt = Arrows;
    this.ArrowTypeExt = ARROW_TYPE;

    this.chessboard = new Chessboard(this.boardContainer.nativeElement, {
      position: this.getCurrentFen(),
      assetsUrl: '/assets/',
      style: {
        cssClass: 'default',
      },
      extensions: [{ class: Arrows }]
    });

    this.updateBoard();
  }

  ngOnDestroy() {
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
    const currentMove = this.getCurrentMove();
    return currentMove ? currentMove.fenAfter : new Chess().fen();
  }

  getPreviousFen() {
    if (this.currentMoveIndex < 0) return new Chess().fen();
    if (this.currentMoveIndex === 0) return new Chess().fen();
    return this.history[this.currentMoveIndex - 1].fenAfter;
  }

  getMoveNumber() {
    return this.currentMoveIndex >= 0 ? Math.floor(this.currentMoveIndex / 2) + 1 : 0;
  }

  getIsWhiteToMove() {
    return this.currentMoveIndex >= 0 ? this.currentMoveIndex % 2 === 0 : true;
  }

  updateBoard() {
    if (this.chessboard) {
      this.chessboard.setPosition(this.getCurrentFen());

      // Clear previous arrows
      if (this.chessboard.removeArrows) {
        this.chessboard.removeArrows();
      }

      // Draw arrow for best move if evaluation is available
      if (this.evaluations && this.evaluations.length > this.currentMoveIndex + 1) {
        const evalData = this.evaluations[this.currentMoveIndex + 1];
        if (evalData && evalData.move && evalData.move.length >= 4) {
          const bestMove = evalData.move;
          const from = bestMove.substring(0, 2);
          const to = bestMove.substring(2, 4);

          if (this.chessboard.addArrow) {
            this.chessboard.addArrow(this.ArrowTypeExt.default, from, to);
          }
        }
      }
    }
  }

  requestFullAnalysis() {
    this.isLoading = true;

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
      const fens = [new Chess().fen(), ...this.history.map(m => m.fenAfter)];

      this.ws?.send(
        JSON.stringify({
          type: 'ANALYZE_GAME',
          pgn: pgn,
          fens: fens
        }),
      );
    };

    this.ws.onmessage = (event) => {
      this.ngZone.run(() => {
        const data = JSON.parse(event.data);
        if (data.type === 'ANALYSIS_GAME_RESULT') {
          this.gameAnalysis = data.aiExplanation;
          this.evaluations = data.evaluations;
          this.calculateChart();
          this.updateBoard(); // Redraw arrows with loaded data
          this.isLoading = false;
          this.ws?.close();
          this.ws = null;
          this.cdr.detectChanges();
        }
      });
    };

    this.ws.onerror = () => {
      this.ngZone.run(() => {
        this.gameAnalysis = 'Failed to load analysis.';
        this.isLoading = false;
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
    const height = 100;
    const midY = height / 2;

    const stepX = width / Math.max(1, this.evaluations.length - 1);

    let path = `M 0,${midY}`;

    for (let i = 0; i < this.evaluations.length; i++) {
      const evalData = this.evaluations[i];
      let evalValue = 0;

      if (evalData) {
        if (evalData.eval !== undefined) {
           evalValue = evalData.eval; // usually in pawns
        } else if (evalData.mate !== undefined) {
           const mate = evalData.mate;
           evalValue = mate > 0 ? 10 : -10; // Cap mate evaluation
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

  goToStart() {
    this.currentMoveIndex = -1;
    this.updateBoard();
  }

  goToPrev() {
    this.currentMoveIndex = Math.max(-1, this.currentMoveIndex - 1);
    this.updateBoard();
  }

  goToNext() {
    this.currentMoveIndex = Math.min(this.history.length - 1, this.currentMoveIndex + 1);
    this.updateBoard();
  }

  goToEnd() {
    this.currentMoveIndex = this.history.length - 1;
    this.updateBoard();
  }
}
