const fs = require('fs');

let spec = fs.readFileSync('frontend/src/app/game/game.spec.ts', 'utf-8');

if (!spec.includes('should handle time decrement')) {
  spec = spec.replace('});', `
  it('should initialize timers based on settings', () => {
    component.settings = { side: 'white', difficulty: 1500, timeControl: '5+3' };
    component.ngOnInit();
    expect(component.playerTime).toBe(300);
    expect(component.engineTime).toBe(300);
    expect(component.increment).toBe(3);
  });

  it('should format time correctly', () => {
    expect(component.formatTime(300)).toBe('5:00');
    expect(component.formatTime(65)).toBe('1:05');
    expect(component.formatTime(15)).toBe('0:15');
  });
});`);
  fs.writeFileSync('frontend/src/app/game/game.spec.ts', spec);
}
