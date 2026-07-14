import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Settings, Play } from 'lucide-angular';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './home.html',
})
export class Home {
  readonly Settings = Settings;
  readonly Play = Play;

  difficulty = 1500;
  side: 'white' | 'black' | 'random' = 'white';
  timeControl = '10+0';

  @Output() startGame = new EventEmitter<any>();

  setSide(selectedSide: 'white' | 'black' | 'random') {
    this.side = selectedSide;
  }

  handleStart() {
    let finalSide = this.side;
    if (this.side === 'random') {
      finalSide = Math.random() > 0.5 ? 'white' : 'black';
    }

    this.startGame.emit({
      difficulty: this.difficulty,
      side: finalSide,
      timeControl: this.timeControl,
    });
  }
}
