const fs = require('fs');

let analysisTs = fs.readFileSync('frontend/src/app/analysis/analysis.ts', 'utf-8');

analysisTs = analysisTs.replace(
`  AfterViewInit,
} from '@angular/core';`,
`  AfterViewInit,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';`
);

analysisTs = analysisTs.replace(
`  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;`,
`  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef;`
);

analysisTs = analysisTs.replace(
`    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ANALYSIS_RESULT') {
        this.explanation = data.explanation;
        this.isLoading = false;
        this.ws?.close();
        this.ws = null;
      }
    };

    this.ws.onerror = () => {
      this.explanation = 'Failed to load analysis.';
      this.isLoading = false;
      this.ws?.close();
      this.ws = null;
    };`,
`    this.ws.onmessage = (event) => {
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
    };`
);

fs.writeFileSync('frontend/src/app/analysis/analysis.ts', analysisTs);
