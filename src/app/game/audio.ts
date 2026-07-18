export class ChessAudio {
  private ctx: AudioContext | null = null;
  
  private init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playMove() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // A clean, satisfying wooden block tap (sine wave thud + fast high frequency click)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    // Quick click for sharp contact
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(700, now);
    clickOsc.frequency.exponentialRampToValueAtTime(300, now + 0.015);
    clickGain.gain.setValueAtTime(0.12, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.015);
    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.08);
    
    clickOsc.start(now);
    clickOsc.stop(now + 0.015);
  }

  playCapture() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Capture simulates two wood pieces striking each other (a double wooden knock/clack)
    // First wood impact (louder/sharper)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(310, now);
    osc1.frequency.exponentialRampToValueAtTime(140, now + 0.07);
    gain1.gain.setValueAtTime(0.45, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);

    // High frequency clack contact
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(900, now);
    osc2.frequency.exponentialRampToValueAtTime(400, now + 0.025);
    gain2.gain.setValueAtTime(0.2, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.025);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);

    // Second micro-impact (the capturing piece settling down on the board)
    const osc3 = this.ctx.createOscillator();
    const gain3 = this.ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(170, now + 0.035);
    osc3.frequency.exponentialRampToValueAtTime(70, now + 0.115);
    gain3.gain.setValueAtTime(0.35, now + 0.035);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.115);
    osc3.connect(gain3);
    gain3.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.07);
    osc2.start(now);
    osc2.stop(now + 0.025);
    osc3.start(now + 0.035);
    osc3.stop(now + 0.115);
  }

  playCheck() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Elegant warning/alert chord instead of harsh retro buzzer
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(293.66, now); // D4
    osc1.frequency.linearRampToValueAtTime(329.63, now + 0.15); // E4
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440.00, now); // A4
    osc2.frequency.linearRampToValueAtTime(493.88, now + 0.15); // B4
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.25);
    osc2.start(now);
    osc2.stop(now + 0.25);
  }

  playBlunderAlert() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // A clean, warning-like chime: two high-pitch clean chimes in rapid succession
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(392.00, now + 0.3); // G4
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.05); // E5
    osc2.frequency.exponentialRampToValueAtTime(493.88, now + 0.35); // B4
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.35);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.35);
  }
}

export const chessAudio = new ChessAudio();
