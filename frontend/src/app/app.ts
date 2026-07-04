import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Home } from './home/home';
import { Game } from './game/game';
import { Analysis } from './analysis/analysis';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, Home, Game, Analysis],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  gameState = signal<'setup' | 'playing' | 'analysis'>('setup');
  gameSettings = signal<any>(null);
  gameHistory = signal<any[]>([]);

  handleStartGame(settings: any) {
    this.gameSettings.set(settings);
    this.gameState.set('playing');
  }

  handleAnalyze(history: any[]) {
    this.gameHistory.set(history);
    this.gameState.set('analysis');
  }

  goBackToSetup() {
    this.gameState.set('setup');
  }
}
