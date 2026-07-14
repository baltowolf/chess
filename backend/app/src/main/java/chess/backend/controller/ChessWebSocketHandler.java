package chess.backend.controller;

import chess.backend.service.AiExplanationService;
import chess.backend.service.StockfishService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Component
public class ChessWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChessWebSocketHandler.class);
    private final StockfishService stockfishService;
    private final AiExplanationService aiExplanationService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChessWebSocketHandler(StockfishService stockfishService, AiExplanationService aiExplanationService) {
        this.stockfishService = stockfishService;
        this.aiExplanationService = aiExplanationService;
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode payload = objectMapper.readTree(message.getPayload());
        String type = payload.has("type") ? payload.get("type").asText() : "";

        if ("ENGINE_MOVE".equals(type)) {
            String fen = payload.get("fen").asText();
            int difficulty = payload.has("difficulty") ? payload.get("difficulty").asInt() : 1500;

            stockfishService.setDifficulty(difficulty);
            String bestMove = stockfishService.getBestMove(fen, 1000);

            if (bestMove != null) {
                String response = String.format("{\"type\":\"ENGINE_MOVE\",\"move\":\"%s\"}", bestMove);
                session.sendMessage(new TextMessage(response));
            }
        } else if ("ANALYZE_GAME".equals(type)) {
            String pgn = payload.get("pgn").asText();
            JsonNode fensNode = payload.get("fens");

            List<String> fens = new ArrayList<>();
            for (JsonNode fenNode : fensNode) {
                fens.add(fenNode.asText());
            }

            // Calculate evaluations for each fen sequentially to avoid 504 errors
            List<JsonNode> evaluations = new ArrayList<>();
            List<Integer> evalValues = new ArrayList<>();

            for (String fen : fens) {
                JsonNode evalNode = stockfishService.getEvaluation(fen);
                evaluations.add(evalNode);

                int eval = 0;
                if (evalNode != null && evalNode.has("eval")) {
                     eval = (int)(evalNode.get("eval").asDouble() * 100);
                } else if (evalNode != null && evalNode.has("mate")) {
                     int mate = evalNode.get("mate").asInt();
                     eval = mate > 0 ? 10000 - mate : -10000 - mate;
                }
                evalValues.add(eval);
            }

            // Fetch AI explanation asynchronously
            CompletableFuture.supplyAsync(() ->
                aiExplanationService.getFullGameExplanation(pgn, evalValues.toString())
            ).thenAccept(aiText -> {
                try {
                    String response = objectMapper.writeValueAsString(
                        new AnalysisResult("ANALYSIS_GAME_RESULT", evaluations, aiText)
                    );
                    session.sendMessage(new TextMessage(response));
                } catch (Exception e) {
                    log.error("Failed to send analysis result", e);
                }
            });
        }
    }

    static class AnalysisResult {
        public String type;
        public List<JsonNode> evaluations;
        public String aiExplanation;

        public AnalysisResult(String type, List<JsonNode> evaluations, String aiExplanation) {
            this.type = type;
            this.evaluations = evaluations;
            this.aiExplanation = aiExplanation;
        }
    }
}
