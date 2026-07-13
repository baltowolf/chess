package chess.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

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
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> requestMap = new HashMap<>();
            requestMap.put("fen", fen);
            requestMap.put("depth", currentDepth);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestMap, headers);
            String response = restTemplate.postForObject("https://chess-api.com/v1", entity, String.class);
            JsonNode root = objectMapper.readTree(response);

            if (root.has("move")) {
                return root.get("move").asText();
            }
        } catch (Exception e) {
            log.error("Failed to fetch best move", e);
        }
        return null;
    }

    public JsonNode getEvaluation(String fen) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> requestMap = new HashMap<>();
            requestMap.put("fen", fen);
            requestMap.put("depth", 10);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestMap, headers);
            String response = restTemplate.postForObject("https://chess-api.com/v1", entity, String.class);
            return objectMapper.readTree(response);
        } catch (Exception e) {
            log.error("Failed to fetch evaluation", e);
            return null;
        }
    }
}
