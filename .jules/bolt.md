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
## 2024-05-18 - WebSocket Caching in Analysis Component
**Learning:** Navigating through history in the Analysis board caused redundant WebSocket connections and Stockfish/DeepSeek API calls for moves that were already analyzed, significantly degrading performance. Caching the `ANALYSIS_RESULT` in the component state prevents these unnecessary network and backend roundtrips.
**Action:** For components that fetch data based on user navigation across a finite set of states (like chess move history), implement a local cache (e.g., `Map`) to store previously fetched results and bypass the fetch logic if the result is already available.

## 2024-05-18 - Full Game FEN Evaluation Bulk Request
**Learning:** Requesting multiple FEN evaluations via Stockfish API concurrently using `parallelStream()` caused a `504 Gateway Time-out`. To prevent API rate limits and connection pooling issues, we must fetch FEN evaluations sequentially. We also switched to the highly reliable and free `https://chess-api.com/v1` for both Stockfish evaluation and best move.
**Action:** When evaluating an entire chess game move by move on an external REST API, use sequential loops to collect `JsonNode` or evaluation data. For the LLM integration (Pollinations AI), we use a single asynchronous request containing the PGN and all evaluations to get the full-game review.
