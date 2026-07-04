import { Component, EventEmitter, Input, Output, ViewChild, OnInit, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chess } from 'chess.js';
import { LucideAngularModule, ChevronLeft, ChevronRight, RotateCcw, MessageSquare } from 'lucide-angular';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './analysis.html',
  styleUrl: './analysis.css'
})
export class Analysis implements OnInit, OnDestroy, AfterViewInit {
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly RotateCcw = RotateCcw;
  readonly MessageSquare = MessageSquare;

  @Input() history: any[] = [];
  @Output() goBack = new EventEmitter<void>();

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;
  chessboard: any;

  currentMoveIndex: number = 0;
  explanation: string = '';
  isLoading: boolean = false;

  ngOnInit() {
    this.currentMoveIndex = this.history.length - 1;
    this.fetchExplanation();
  }

  async ngAfterViewInit() {
    const { Chessboard, COLOR } = await import('cm-chessboard');

    this.chessboard = new Chessboard(this.boardContainer.nativeElement, {
      position: this.getCurrentFen(),
      assetsUrl: "/assets/",
      style: {
         cssClass: "default"
      }
    });
  }

  ngOnDestroy() {
    if (this.chessboard) {
      this.chessboard.destroy();
    }
  }

  getCurrentMove() {
    return this.history[this.currentMoveIndex];
  }

  getCurrentFen() {
    const currentMove = this.getCurrentMove();
    return currentMove ? currentMove.fenAfter : new Chess().fen();
  }

  getMoveNumber() {
    return this.currentMoveIndex >= 0 ? Math.floor(this.currentMoveIndex / 2) + 1 : 0;
  }

  getIsWhiteToMove() {
    return this.currentMoveIndex >= 0 ? this.currentMoveIndex % 2 !== 0 : true;
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

    const currentMove = this.getCurrentMove();
    const isWhiteToMove = this.getIsWhiteToMove();

    const ws = new WebSocket('ws://localhost:8080/ws-chess');

    ws.onopen = () => {
      const mockEvalBefore = Math.floor(Math.random() * 200) - 100;
      const mockEvalAfter = mockEvalBefore + (Math.floor(Math.random() * 150) - 75);

      ws.send(JSON.stringify({
        type: 'ANALYZE_MOVE',
        move: currentMove.san,
        evalBefore: mockEvalBefore,
        evalAfter: mockEvalAfter,
        isWhiteToMove: isWhiteToMove
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ANALYSIS_RESULT') {
        this.explanation = data.explanation;
        this.isLoading = false;
        ws.close();
      }
    };

    ws.onerror = () => {
      this.explanation = 'Failed to load analysis.';
      this.isLoading = false;
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
