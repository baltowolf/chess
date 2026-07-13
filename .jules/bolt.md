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

## 2024-05-20 - Component State Cleanup During Caching
**Learning:** When implementing in-memory caching for asynchronous operations (like WebSockets) that bypass normal component lifecycles, failing to clean up active resources (`this.ws = null`) before returning the cached result can lead to race conditions or memory leaks in long-running components like `Analysis`.
**Action:** Always eagerly cleanup external connections (e.g. `this.ws.close(); this.ws = null;`) explicitly when short-circuiting to a cached return path.
