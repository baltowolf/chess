package chess.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Service
public class StockfishService {

    private static final Logger log = LoggerFactory.getLogger(StockfishService.class);
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private int currentDepth = 5; // Default depth mapped from ELO

    public void setDifficulty(int elo) {
        // Map ELO (800 - 3200) to depth (1 - 15)
        // 800 -> 1, 3200 -> 15
        this.currentDepth = Math.max(1, Math.min(15, (elo - 800) * 14 / 2400 + 1));
        log.info("Set difficulty ELO {} to depth {}", elo, currentDepth);
    }

    public String getBestMove(String fen, int moveTimeMs) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl("https://stockfish.online/api/s/v2.php")
                    .queryParam("fen", fen)
                    .queryParam("depth", currentDepth)
                    .build()
                    .toUri();

            log.info("Calling Stockfish API for best move: {}", uri);
            String response = restTemplate.getForObject(uri, String.class);
            JsonNode root = objectMapper.readTree(response);

            if (root.has("success") && root.get("success").asBoolean()) {
                String bestmoveStr = root.get("bestmove").asText();
                String[] parts = bestmoveStr.split("bestmove ");
                if (parts.length > 1) {
                    return parts[1].split(" ")[0].trim();
                }
            } else {
                log.error("Stockfish API returned error or unsuccessful: {}", response);
            }
        } catch (Exception e) {
            log.error("Failed to fetch best move from Stockfish API", e);
        }
        return null; // Fallback or handle error appropriately in handler
    }

    /**
     * Gets the evaluation in centipawns. Positive means white is better.
     * If mate is found, returns a large centipawn value (e.g. +/- 10000).
     */
    public int getEvaluation(String fen) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl("https://stockfish.online/api/s/v2.php")
                    .queryParam("fen", fen)
                    .queryParam("depth", 10) // Fixed depth for analysis
                    .build()
                    .toUri();

            log.info("Calling Stockfish API for evaluation: {}", uri);
            String response = restTemplate.getForObject(uri, String.class);
            JsonNode root = objectMapper.readTree(response);

            if (root.has("success") && root.get("success").asBoolean()) {
                if (root.has("mate") && !root.get("mate").isNull()) {
                    int mateIn = root.get("mate").asInt();
                    return mateIn > 0 ? 10000 - mateIn : -10000 - mateIn; // large number indicating forced mate
                }
                if (root.has("evaluation")) {
                    double eval = root.get("evaluation").asDouble();
                    return (int) (eval * 100); // convert to centipawns
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch evaluation from Stockfish API", e);
        }
        return 0;
    }
}
