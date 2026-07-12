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
import { DEFAULT_POSITION } from 'chess.js';
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

  @Input() history: any[] = [];
  @Output() goBack = new EventEmitter<void>();

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;
  chessboard: any;
  ws: WebSocket | null = null;

  currentMoveIndex: number = 0;
  explanation: string = '';
  isLoading: boolean = false;

  ngOnInit() {
    this.currentMoveIndex = this.history.length - 1;
    this.fetchExplanation();
  }

  async ngAfterViewInit() {
    const { Chessboard } = await import('cm-chessboard');

    this.chessboard = new Chessboard(this.boardContainer.nativeElement, {
      position: this.getCurrentFen(),
      assetsUrl: '/assets/',
      style: {
        cssClass: 'default',
      },
    });
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
    // ⚡ Bolt: Use DEFAULT_POSITION constant instead of initializing a new Chess() instance for performance
    return currentMove ? currentMove.fenAfter : DEFAULT_POSITION;
  }

  getPreviousFen() {
    // ⚡ Bolt: Use DEFAULT_POSITION constant instead of initializing a new Chess() instance for performance
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

  updateBoard() {
    if (this.chessboard) {
      this.chessboard.setPosition(this.getCurrentFen());
    }
  }

  fetchExplanation() {
    if (this.currentMoveIndex < 0) {
      this.explanation = 'Start of the game.';
      return;
    }

    this.isLoading = true;
    this.explanation = '';

    if (this.ws) {
      this.ws.close();
    }

    const currentMove = this.getCurrentMove();
    const isWhiteToMove = this.getIsWhiteToMove();
    const fenBefore = this.getPreviousFen();
    const fenAfter = this.getCurrentFen();

    this.ws = new WebSocket(getWebSocketUrl());

    this.ws.onopen = () => {
      this.ws?.send(
        JSON.stringify({
          type: 'ANALYZE_MOVE',
          move: currentMove.san,
          fenBefore: fenBefore,
          fenAfter: fenAfter,
          isWhiteToMove: isWhiteToMove,
        }),
      );
    };

    this.ws.onmessage = (event) => {
      this.ngZone.run(() => {
        const data = JSON.parse(event.data);
        if (data.type === 'ANALYSIS_RESULT') {
          this.explanation = data.explanation;
          this.isLoading = false;
          this.ws?.close();
          this.ws = null;
          this.cdr.detectChanges();
        }
      });
    };

    this.ws.onerror = () => {
      this.ngZone.run(() => {
        this.explanation = 'Failed to load analysis.';
        this.isLoading = false;
        this.ws?.close();
        this.ws = null;
        this.cdr.detectChanges();
      });
    };
  }

  goToStart() {
    this.currentMoveIndex = -1;
    this.updateBoard();
    this.fetchExplanation();
  }

  goToPrev() {
    this.currentMoveIndex = Math.max(-1, this.currentMoveIndex - 1);
    this.updateBoard();
    this.fetchExplanation();
  }

  goToNext() {
    this.currentMoveIndex = Math.min(this.history.length - 1, this.currentMoveIndex + 1);
    this.updateBoard();
    this.fetchExplanation();
  }

  goToEnd() {
    this.currentMoveIndex = this.history.length - 1;
    this.updateBoard();
    this.fetchExplanation();
  }
}
