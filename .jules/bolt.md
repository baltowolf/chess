## 2024-05-20 - Optimize Chess Initialization
**Learning:** Calling `new Chess().fen()` repeatedly for default states introduces measurable CPU overhead, especially during rendering cycles or array mappings.
**Action:** Import and use the `DEFAULT_POSITION` constant from `chess.js` directly whenever checking or initializing the starting board state.
## 2024-05-20 - Optimize Analysis Loading Loop
**Learning:** Using an `O(N)` array filter function (`getAnalyzedCount()`) bound directly inside Angular templates results in $O(N^2)$ change detection cycles when rapid asynchronous events trigger updates.
**Action:** Memoize computational values or expensive array iterations using a simple cached property updated asynchronously. Wrap isolated `setInterval` tasks in `this.ngZone.runOutsideAngular()` to bypass heavy Angular global change detection.
