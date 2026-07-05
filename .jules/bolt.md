## 2023-10-27 - Memoizing chess.js calculations in Angular Templates
**Learning:** Angular change detection calls template expressions on every tick. Functions like `isGameOver()` from `chess.js` re-calculate state based on current FEN string, leading to a huge amount of unnecessary processing for static state.
**Action:** When working with compute-heavy state libraries (like `chess.js`) in Angular (or React), memoize their results instead of calling them directly in the template. Cache the result based on the serialized board state (`FEN`).
