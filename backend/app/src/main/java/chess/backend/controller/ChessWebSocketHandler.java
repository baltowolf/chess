package chess.backend.controller;

import chess.backend.service.AiExplanationService;
import chess.backend.service.StockfishService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;

@Component
public class ChessWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChessWebSocketHandler.class);
    private final StockfishService stockfishService;
    private final AiExplanationService aiExplanationService;
    private final ObjectMapper mapper = new ObjectMapper();

    public ChessWebSocketHandler(StockfishService stockfishService, AiExplanationService aiExplanationService) {
        this.stockfishService = stockfishService;
        this.aiExplanationService = aiExplanationService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("WebSocket connection established: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.info("Received message: {}", payload);

        try {
            JsonNode jsonNode = mapper.readTree(payload);
            String type = jsonNode.has("type") ? jsonNode.get("type").asText() : "";

            if ("REQUEST_MOVE".equals(type)) {
                String fen = jsonNode.get("fen").asText();
                int difficulty = jsonNode.has("difficulty") ? jsonNode.get("difficulty").asInt() : 1500;

                stockfishService.setDifficulty(difficulty);
                String bestMove = stockfishService.getBestMove(fen, 1000);

                ObjectNode response = mapper.createObjectNode();
                response.put("type", "ENGINE_MOVE");
                response.put("move", bestMove);

                session.sendMessage(new TextMessage(response.toString()));
            } else if ("ANALYZE_MOVE".equals(type)) {
                String move = jsonNode.get("move").asText();
                String fenBefore = jsonNode.get("fenBefore").asText();
                String fenAfter = jsonNode.get("fenAfter").asText();
                boolean isWhiteToMove = jsonNode.get("isWhiteToMove").asBoolean();

                // Get real evaluations
                int evalBefore = stockfishService.getEvaluation(fenBefore);
                int evalAfter = stockfishService.getEvaluation(fenAfter);

                String explanation = aiExplanationService.getExplanation(fenBefore, move, evalBefore, evalAfter, isWhiteToMove);

                ObjectNode response = mapper.createObjectNode();
                response.put("type", "ANALYSIS_RESULT");
                response.put("explanation", explanation);

                session.sendMessage(new TextMessage(response.toString()));
            }
        } catch (Exception e) {
            log.error("Error handling message", e);
            session.sendMessage(new TextMessage("{\"type\": \"ERROR\", \"message\": \"Failed to process message\"}"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        log.info("WebSocket connection closed: {}", session.getId());
    }
}
