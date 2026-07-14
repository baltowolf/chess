package chess.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
public class StockfishService {

    private static final Logger log = LoggerFactory.getLogger(StockfishService.class);
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private int currentDepth = 5;

    public void setDifficulty(int elo) {
        this.currentDepth = Math.max(1, Math.min(15, (elo - 800) * 14 / 2400 + 1));
        log.info("Set difficulty ELO {} to depth {}", elo, currentDepth);
    }

    public String getBestMove(String fen, int moveTimeMs) {
        try {
            String encodedFen = URLEncoder.encode(fen, StandardCharsets.UTF_8.toString());
            String url = "https://stockfish.online/api/s/v2.php?fen=" + encodedFen + "&depth=" + currentDepth;

            String response = restTemplate.getForObject(url, String.class);
            JsonNode root = objectMapper.readTree(response);

            if (root.has("bestmove")) {
                String bestMoveStr = root.get("bestmove").asText();
                String[] parts = bestMoveStr.split(" ");
                if (parts.length > 1) {
                    return parts[1];
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch best move", e);
        }
        return null;
    }

    public JsonNode getEvaluation(String fen) {
        try {
            String encodedFen = URLEncoder.encode(fen, StandardCharsets.UTF_8.toString());
            String url = "https://stockfish.online/api/s/v2.php?fen=" + encodedFen + "&depth=10";

            String response = restTemplate.getForObject(url, String.class);
            JsonNode root = objectMapper.readTree(response);

            ObjectNode mapped = objectMapper.createObjectNode();

            if (root.has("evaluation") && !root.get("evaluation").isNull()) {
                mapped.put("eval", root.get("evaluation").asDouble());
            }
            if (root.has("mate") && !root.get("mate").isNull()) {
                mapped.put("mate", root.get("mate").asInt());
            }
            if (root.has("bestmove") && !root.get("bestmove").isNull()) {
                String bm = root.get("bestmove").asText();
                String[] parts = bm.split(" ");
                if (parts.length > 1) {
                    mapped.put("move", parts[1]);
                }
            }
            return mapped;
        } catch (Exception e) {
            log.error("Failed to fetch evaluation", e);
            return null;
        }
    }
}
