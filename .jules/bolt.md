# Critical Learnings

## Angular Change Detection with WebSockets and cm-chessboard

- **Issue:** WebSockets (`ws.onmessage`) and external libraries like `cm-chessboard` trigger callbacks outside of Angular's zone (`NgZone`). This prevents UI updates when state changes occur within these callbacks, causing issues where times don't tick, analysis explanation doesn't show up, and history doesn't properly update.
- **Solution:**
  - Ensure callbacks from `WebSocket` and `cm-chessboard` events are explicitly run inside `ngZone.run(() => { ... })` and manual Change Detection via `ChangeDetectorRef.detectChanges()` is invoked to force template updates.
  - Run asynchronous polling mechanisms (like `setInterval` for timers) outside Angular using `ngZone.runOutsideAngular` to prevent massive change detection cycles, but wrap the logic mutating the state within the interval with `ngZone.run` or call `detectChanges()`.
- **Note:** In `analysis.ts` and `game.ts`, making these explicit zone updates resolved the UI freeze issues.
## 2024-05-18 - Angular List Rendering Optimization
**Learning:** For rendering the move history array using `*ngFor`, missing a `trackBy` function causes Angular to re-render all elements when the array changes, which gets increasingly expensive as the move history grows.
**Action:** Always add a `trackBy` function for `*ngFor` in this codebase, especially for frequently updated lists like the move history.
## 2024-05-18 - chess.js FEN generation performance
**Learning:** Creating a new `Chess` instance (`new Chess().fen()`) simply to retrieve the default starting position FEN string is unnecessarily computationally expensive (~300ms for 10k calls vs ~0.1ms for a constant string), especially when these methods (`getCurrentFen`, `getPreviousFen`) might be called frequently during rendering or analysis.
**Action:** Use the `DEFAULT_POSITION` constant exported by `chess.js` instead of creating temporary `Chess` instances when you only need the starting position.
