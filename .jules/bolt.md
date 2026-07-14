## 2024-05-20 - Optimize Chess Initialization
**Learning:** Calling `new Chess().fen()` repeatedly for default states introduces measurable CPU overhead, especially during rendering cycles or array mappings.
**Action:** Import and use the `DEFAULT_POSITION` constant from `chess.js` directly whenever checking or initializing the starting board state.
