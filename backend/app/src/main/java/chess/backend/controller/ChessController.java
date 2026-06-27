package chess.backend.controller;

import chess.backend.service.StockfishService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/chess")
@CrossOrigin(origins = "*") // Allow frontend to call
public class ChessController {

    private final StockfishService stockfishService;

    // Simple in-memory game map for now. In a real app, this goes to DB.
    private final Map<String, GameSettings> activeGames = new ConcurrentHashMap<>();

    public ChessController(StockfishService stockfishService) {
        this.stockfishService = stockfishService;
    }

    public static class GameSettings {
        public String gameId;
        public int difficulty;
        public String side;
        public String timeControl;
    }

    @PostMapping("/start")
    public ResponseEntity<GameSettings> startGame(@RequestBody GameSettings request) {
        String gameId = UUID.randomUUID().toString();
        request.gameId = gameId;
        activeGames.put(gameId, request);

        // Stockfish is shared in this simplistic setup, but we could initialize per game if needed.
        // For now, we'll just set difficulty when a move is requested.

        return ResponseEntity.ok(request);
    }

    @GetMapping("/game/{id}")
    public ResponseEntity<GameSettings> getGame(@PathVariable String id) {
        GameSettings game = activeGames.get(id);
        if (game == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(game);
    }
}
