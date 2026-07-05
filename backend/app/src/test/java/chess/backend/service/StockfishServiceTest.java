package chess.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.URI;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StockfishServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private StockfishService stockfishService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(stockfishService, "restTemplate", restTemplate);
    }

    @Test
    void testGetBestMove_Success() {
        String mockResponse = "{\"success\":true,\"evaluation\":0.39,\"mate\":null,\"bestmove\":\"bestmove e2e4 ponder e7e5\",\"continuation\":\"\"}";
        when(restTemplate.getForObject(any(URI.class), eq(String.class))).thenReturn(mockResponse);

        String bestMove = stockfishService.getBestMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 1000);

        assertEquals("e2e4", bestMove);
    }

    @Test
    void testGetEvaluation_Success() {
        String mockResponse = "{\"success\":true,\"evaluation\":1.50,\"mate\":null,\"bestmove\":\"bestmove e2e4 ponder e7e5\",\"continuation\":\"\"}";
        when(restTemplate.getForObject(any(URI.class), eq(String.class))).thenReturn(mockResponse);

        int evaluation = stockfishService.getEvaluation("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

        assertEquals(150, evaluation);
    }
}
