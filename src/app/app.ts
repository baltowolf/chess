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
})
export class App {
  gameState = signal<'setup' | 'playing' | 'analysis'>('setup');
  gameSettings = signal<any>(null);
  gameHistory = signal<any[]>([]);
  analysisDepth = signal<number>(8);
  precomputedEvaluations = signal<any[]>([]);
  gameElo = signal<number>(1500);

  handleStartGame(settings: any) {
    this.gameSettings.set(settings);
    this.gameState.set('playing');
  }

  handleAnalyze(data: { history: any[], depth: number, precomputedEvaluations: any[], elo?: number }) {
    this.gameHistory.set(data.history);
    this.analysisDepth.set(data.depth);
    this.precomputedEvaluations.set(data.precomputedEvaluations);
    this.gameElo.set(data.elo || 1500);
    this.gameState.set('analysis');
  }

  goBackToSetup() {
    this.gameState.set('setup');
  }
}
