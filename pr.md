⚡ Fix Game Logic Bugs

💡 **What:**
1. Updated cm-chessboard event logic from the non-existent `moveDone` to `validateMoveInput` and `moveInputStarted` to correctly register player moves.
2. Added missing resign logic, providing `resign` state and separated UI buttons for "Resign" and "Back to Setup" dynamically based on the game over status.

🎯 **Why:**
1. The incorrect event type caused the chessboard to never notify the game engine that a user move happened, preventing the computer from ever making its second move.
2. The user experience was broken because a player couldn't cleanly resign a game while playing, and resigning didn't properly log a game over which prevented analyzing the incomplete game.