import { Component, EventEmitter, Input, Output, ViewChild, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chess } from 'chess.js';

declare var window: any;

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game.html',
  styleUrl: './game.css'
})
export class Game implements OnInit, OnDestroy, AfterViewInit {
  @Input() settings: any;
  @Output() goBack = new EventEmitter<void>();
  @Output() analyze = new EventEmitter<any[]>();

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;

  game = new Chess();
  moveHistory: any[] = [];
  ws: WebSocket | null = null;

  boardTheme = 'classic';
  showSettings = false;

  chessboard: any;

  ngOnInit() {
    this.ws = new WebSocket('ws://localhost:8080/ws-chess');

    this.ws.onopen = () => {
      console.log('Connected to chess engine');
      if (this.settings.side === 'black' && this.game.moveNumber() === 1 && this.game.turn() === 'w') {
        this.requestEngineMove(this.game.fen());
      }
    };

    this.ws.onmessage = (event) => {
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
    };
  }

  async ngAfterViewInit() {
    // Dynamically import cm-chessboard
    const { Chessboard, COLOR, INPUT_EVENT_TYPE } = await import('cm-chessboard');

    this.chessboard = new Chessboard(this.boardContainer.nativeElement, {
      position: this.game.fen(),
      assetsUrl: "/assets/",
      orientation: this.settings.side === 'white' ? COLOR.white : COLOR.black,
      style: {
         cssClass: "default"
      }
    });

    this.chessboard.enableMoveInput((event: any) => {
      if (event.type === INPUT_EVENT_TYPE.moveDone) {
        if (!this.isPlayerTurn()) {
           return false; // prevent move visually
        }

        const move = { from: event.squareFrom, to: event.squareTo, promotion: 'q' };

        // Let's validate the move with chess.js
        try {
          const result = this.game.move(move);

          if (result) {
            this.moveHistory.push({ ...result, fenAfter: this.game.fen() });

            if (!this.game.isGameOver()) {
              this.requestEngineMove(this.game.fen());
            }
            return true; // valid move
          }
        } catch(e) {
          return false;
        }
        return false; // invalid move
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
  }

  requestEngineMove(currentFen: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'REQUEST_MOVE',
        fen: currentFen,
        difficulty: this.settings.difficulty
      }));
    }
  }

  makeAMove(move: any, isEngine: boolean = false) {
    try {
      const result = this.game.move(move);
      this.moveHistory.push({ ...result, fenAfter: this.game.fen() });

      if (this.chessboard) {
        this.chessboard.setPosition(this.game.fen(), true);
      }

      if (!isEngine && !this.game.isGameOver()) {
        this.requestEngineMove(this.game.fen());
      }

      return result;
    } catch (e) {
      return null;
    }
  }

  isPlayerTurn(): boolean {
    if (this.game.isGameOver()) return false;
    if ((this.settings.side === 'white' && this.game.turn() === 'b') ||
        (this.settings.side === 'black' && this.game.turn() === 'w')) {
      return false;
    }
    return true;
  }

  isGameOver(): boolean {
    return this.game.isGameOver();
  }

  getThemeColors() {
    switch (this.boardTheme) {
      case 'wood':
        return { dark: '#b58863', light: '#f0d9b5' };
      case 'blue':
        return { dark: '#4b7399', light: '#eae9d2' };
      case 'purple':
        return { dark: '#7b5b8d', light: '#f0e6f5' };
      case 'classic':
      default:
        return { dark: '#779556', light: '#ebecd0' };
    }
  }
}
