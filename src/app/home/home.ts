import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Settings, Play, Gamepad2, Upload } from 'lucide-angular';
import { Chess } from 'chess.js';
import { language } from '../language';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './home.html',
})
export class Home {
  readonly Settings = Settings;
  readonly Play = Play;
  readonly Gamepad2 = Gamepad2;
  readonly Upload = Upload;
  lang = language;

  activeTab: 'play' | 'import' = 'play';
  pgnText = '';
  pgnError = '';

  difficulty = 1500;
  skillLevel = 8;
  skillLevels = Array.from({ length: 20 }, (_, i) => i + 1);
  side: 'white' | 'black' | 'random' = 'white';
  timeControl = '10+0';
  tournamentMode = false;

  @Output() startGame = new EventEmitter<any>();
  @Output() analyzeGame = new EventEmitter<{ history: any[], depth: number, precomputedEvaluations: any[], elo?: number }>();

  setSide(selectedSide: 'white' | 'black' | 'random') {
    this.side = selectedSide;
  }

  getEloForSkillLevel(level: number): number {
    if (level <= 1) return 800;
    if (level === 2) return 900;
    if (level === 3) return 1000;
    if (level === 4) return 1100;
    if (level === 5) return 1200;
    if (level === 6) return 1300;
    if (level === 7) return 1400;
    if (level === 8) return 1500;
    if (level === 9) return 1600;
    if (level === 10) return 1700;
    if (level === 11) return 1800;
    if (level === 12) return 1900;
    if (level === 13) return 2000;
    if (level === 14) return 2100;
    if (level === 15) return 2200;
    if (level === 16) return 2300;
    if (level === 17) return 2400;
    if (level === 18) return 2600;
    if (level === 19) return 2800;
    return 3200;
  }

  getSkillLevelForElo(elo: number): number {
    if (elo <= 800) return 1;
    if (elo <= 900) return 2;
    if (elo <= 1000) return 3;
    if (elo <= 1100) return 4;
    if (elo <= 1200) return 5;
    if (elo <= 1300) return 6;
    if (elo <= 1400) return 7;
    if (elo <= 1500) return 8;
    if (elo <= 1600) return 9;
    if (elo <= 1700) return 10;
    if (elo <= 1800) return 11;
    if (elo <= 1900) return 12;
    if (elo <= 2000) return 13;
    if (elo <= 2100) return 14;
    if (elo <= 2200) return 15;
    if (elo <= 2300) return 16;
    if (elo <= 2400) return 17;
    if (elo <= 2600) return 18;
    if (elo <= 2800) return 19;
    return 20;
  }

  onSkillLevelChange() {
    this.difficulty = this.getEloForSkillLevel(Number(this.skillLevel));
  }

  onDifficultyChange() {
    this.skillLevel = this.getSkillLevelForElo(this.difficulty);
  }

  handleStart() {
    let finalSide = this.side;
    if (this.side === 'random') {
       finalSide = Math.random() > 0.5 ? 'white' : 'black';
    }

    this.startGame.emit({
      difficulty: this.difficulty,
      skillLevel: Number(this.skillLevel),
      side: finalSide,
      timeControl: this.timeControl,
      tournamentMode: this.tournamentMode,
    });
  }

  importPgn() {
    this.pgnError = '';
    if (!this.pgnText.trim()) {
      this.pgnError = 'Please paste a valid PGN string.';
      return;
    }

    try {
      const tempGame = new Chess();
      tempGame.loadPgn(this.pgnText.trim());

      const rawMoves = tempGame.history();
      const gameReconstruction = new Chess();
      const reconstructedHistory: any[] = [];

      for (const rawMove of rawMoves) {
        const result = gameReconstruction.move(rawMove);
        if (result) {
          reconstructedHistory.push({
            ...result,
            fenAfter: gameReconstruction.fen()
          });
        }
      }

      if (reconstructedHistory.length === 0) {
        this.pgnError = 'The PGN contains no moves to analyze.';
        return;
      }

      this.analyzeGame.emit({
        history: reconstructedHistory,
        depth: 8,
        precomputedEvaluations: [],
        elo: 1500
      });
    } catch (e: any) {
      this.pgnError = 'Error parsing PGN: ' + (e.message || e);
    }
  }

  loadSamplePgn() {
    this.pgnText = `[Event "Paris Casual"]
[Site "Paris FRA"]
[Date "1958.11.01"]
[Round "?"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;
    this.pgnError = '';
  }
}
