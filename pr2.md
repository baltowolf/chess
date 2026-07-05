⚡ Fixed timer freeze, added online Stockfish and AI explanation

💡 **What:**
1. Replaced the local, OS-specific Stockfish engine process with a robust API client using `stockfish.online` for fetching the best moves and position evaluations.
2. Refactored `AiExplanationService` to fetch dynamic Russian explanations from an AI using `text.pollinations.ai`.
3. Cached chess.js game state methods (like `isGameOver`, `turn`) into Angular component fields instead of calling them repeatedly in HTML templates.
4. Correctly passed FEN strings back and forth through the WebSocket payload to enable proper post-game analysis without mocking evaluations.

🎯 **Why:**
1. Hardcoded, system-specific engine paths break across environments. Cloud APIs make the application portable.
2. The user required actual AI text explanations for their moves during analysis rather than hardcoded logic.
3. Timer freezes and slow move history rendering were caused by Angular change detection repeatedly executing heavy `chess.js` checks every tick of the timer interval.
4. Game analysis was stuck/failing because mock evaluations weren't properly being replaced by real FEN evaluation.
