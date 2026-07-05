package chess.backend.controller;

import chess.backend.service.AiExplanationService;
import chess.backend.service.StockfishService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChessWebSocketHandlerTest {

    @Mock
    private StockfishService stockfishService;

    @Mock
    private AiExplanationService aiExplanationService;

    @Mock
    private WebSocketSession session;

    @InjectMocks
    private ChessWebSocketHandler handler;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void testHandleRequestMove() throws Exception {
        String payload = "{\"type\":\"REQUEST_MOVE\", \"fen\":\"startfen\", \"difficulty\":1500}";
        when(stockfishService.getBestMove("startfen", 1000)).thenReturn("e2e4");

        handler.handleTextMessage(session, new TextMessage(payload));

        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(captor.capture());

        String response = captor.getValue().getPayload();
        assertTrue(response.contains("\"type\":\"ENGINE_MOVE\""));
        assertTrue(response.contains("\"move\":\"e2e4\""));
    }

    @Test
    void testHandleAnalyzeMove() throws Exception {
        String payload = "{\"type\":\"ANALYZE_MOVE\", \"move\":\"e4\", \"fenBefore\":\"fen1\", \"fenAfter\":\"fen2\", \"isWhiteToMove\":true}";

        when(stockfishService.getEvaluation("fen1")).thenReturn(0);
        when(stockfishService.getEvaluation("fen2")).thenReturn(50);
        when(aiExplanationService.getExplanation("e4", 0, 50, true)).thenReturn("Test explanation");

        handler.handleTextMessage(session, new TextMessage(payload));

        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(captor.capture());

        String response = captor.getValue().getPayload();
        assertTrue(response.contains("\"type\":\"ANALYSIS_RESULT\""));
        assertTrue(response.contains("\"explanation\":\"Test explanation\""));
    }
}
