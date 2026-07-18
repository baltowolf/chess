## 2024-05-20 - Optimize Chess Initialization
**Learning:** Calling `new Chess().fen()` repeatedly for default states introduces measurable CPU overhead, especially during rendering cycles or array mappings.
**Action:** Import and use the `DEFAULT_POSITION` constant from `chess.js` directly whenever checking or initializing the starting board state.

## 2024-07-18 - Optimize Array Filtering in Angular Templates
**Learning:** Using an O(N) array filter operation like `array.filter(e => e !== null).length` directly inside an Angular template can cause significant performance bottlenecks, as the expression is evaluated dozens of times per second during change detection cycles.
**Action:** Always cache the result of expensive array operations or computations in a component property (e.g. `analyzedCount`) and update it only when the underlying data changes, binding the cached property to the template instead.
