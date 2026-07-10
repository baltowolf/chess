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

## 2024-05-20 - WebSocket Cache Race Condition
**Learning:** When implementing a client-side cache for WebSocket responses, if an active connection exists and the next requested data is already cached, you must explicitly close the active connection before returning the cached data. Otherwise, the pending response may arrive later and overwrite the cached data you just loaded.
**Action:** Always clean up pending network requests/connections before returning early from a cache hit block.
