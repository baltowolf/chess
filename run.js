const fs = require('fs');

let gameTs = fs.readFileSync('frontend/src/app/game/game.ts', 'utf-8');

gameTs = gameTs.replace(
`  OnDestroy,
  AfterViewInit,
  ElementRef,
} from '@angular/core';`,
`  OnDestroy,
  AfterViewInit,
  ElementRef,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';`
);

gameTs = gameTs.replace(
`  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;`,
`  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;`
);

gameTs = gameTs.replace(
`    this.ws.onmessage = (event) => {
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

    this.startTimer();`,
`    this.ws.onmessage = (event) => {
      this.ngZone.run(() => {
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
        this.cdr.detectChanges();
      });
    };

    this.ngZone.runOutsideAngular(() => {
      this.startTimer();
    });`
);

gameTs = gameTs.replace(
`  startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.cachedIsGameOver || this.timeOut) {
        clearInterval(this.timerInterval);
        return;
      }

      // Check whose turn it is and decrement
      if (this.cachedIsPlayerTurn) {
        this.playerTime--;
        if (this.playerTime <= 0) {
          this.playerTime = 0;
          this.timeOut = true;
          this.timeOutSide = 'Player';
          this.updateCachedState();
          clearInterval(this.timerInterval);
        }
      } else if (this.cachedIsEngineTurn) {
        this.engineTime--;
        if (this.engineTime <= 0) {
          this.engineTime = 0;
          this.timeOut = true;
          this.timeOutSide = 'Engine';
          this.updateCachedState();
          clearInterval(this.timerInterval);
        }
      }
    }, 1000);
  }`,
`  startTimer() {
    this.timerInterval = setInterval(() => {
      this.ngZone.run(() => {
        if (this.cachedIsGameOver || this.timeOut) {
          clearInterval(this.timerInterval);
          return;
        }

        // Check whose turn it is and decrement
        if (this.cachedIsPlayerTurn) {
          this.playerTime--;
          if (this.playerTime <= 0) {
            this.playerTime = 0;
            this.timeOut = true;
            this.timeOutSide = 'Player';
            this.updateCachedState();
            clearInterval(this.timerInterval);
          }
        } else if (this.cachedIsEngineTurn) {
          this.engineTime--;
          if (this.engineTime <= 0) {
            this.engineTime = 0;
            this.timeOut = true;
            this.timeOutSide = 'Engine';
            this.updateCachedState();
            clearInterval(this.timerInterval);
          }
        }
        this.cdr.detectChanges();
      });
    }, 1000);
  }`
);

gameTs = gameTs.replace(
`        animationDuration: 200,`,
`        animationDuration: 300,`
);

gameTs = gameTs.replace(
`        // Let's validate the move with chess.js
        try {
          const result = this.makeAMove(move, false);

          if (result) {
            return true; // valid move
          }
        } catch (_e) {
          return false;
        }
        return false; // invalid move`,
`        return this.ngZone.run(() => {
          // Let's validate the move with chess.js
          try {
            const result = this.makeAMove(move, false);

            if (result) {
              return true; // valid move
            }
          } catch (_e) {
            return false;
          }
          return false; // invalid move
        });`
);

gameTs = gameTs.replace(
`      if (this.chessboard) {
        this.chessboard.setPosition(this.game.fen(), true);
      }

      if (!isEngine && !this.cachedIsGameOver) {
        this.requestEngineMove(this.game.fen());
      }

      return result;`,
`      if (this.chessboard) {
        this.chessboard.setPosition(this.game.fen(), isEngine);
      }

      if (!isEngine && !this.cachedIsGameOver) {
        this.requestEngineMove(this.game.fen());
      }

      this.cdr.detectChanges();

      return result;`
);

fs.writeFileSync('frontend/src/app/game/game.ts', gameTs);
