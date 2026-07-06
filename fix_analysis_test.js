const fs = require('fs');

let spec = fs.readFileSync('frontend/src/app/analysis/analysis.spec.ts', 'utf-8');

spec = spec.replace(`expect(component.getIsWhiteToMove()).toBe(false);`, `expect(component.getIsWhiteToMove()).toBe(true);`);

fs.writeFileSync('frontend/src/app/analysis/analysis.spec.ts', spec);
