package chess.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class AiExplanationServiceTest {

    private AiExplanationService aiExplanationService;

    @Mock
    private RestTemplate restTemplate;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        aiExplanationService = new AiExplanationService(restTemplate);
        ReflectionTestUtils.setField(aiExplanationService, "apiUrl", "https://chat.deepseek.com/api/v0");
    }

    @Test
    void testGetExplanationSimulation() {
        // 1. Mock session creation
        String sessionJson = "{\"data\":{\"biz_data\":{\"chat_session\":{\"id\":\"test-session-id\"}}}}";
        when(restTemplate.postForObject(eq("https://chat.deepseek.com/api/v0/chat_session/create"), ArgumentMatchers.<HttpEntity<String>>any(), eq(String.class)))
                .thenReturn(sessionJson);

        // 2. Mock completion response (SSE format)
        String sseResponse = "data: {\"v\":\"Это\"}\n" +
                           "data: {\"v\":\" хороший\"}\n" +
                           "data: {\"v\":\" ход\"}\n" +
                           "data: {\"v\":\"!\"}";
        when(restTemplate.postForObject(eq("https://chat.deepseek.com/api/v0/chat/completion"), ArgumentMatchers.<HttpEntity<String>>any(), eq(String.class)))
                .thenReturn(sseResponse);

        String result = aiExplanationService.getExplanation("fen", "e4", 0, 50, true);
        
        assertEquals("Это хороший ход!", result);
    }

    @Test
    void testFallbackOnFailure() {
        when(restTemplate.postForObject(anyString(), ArgumentMatchers.any(), eq(String.class)))
                .thenThrow(new RuntimeException("Connection refused"));

        String result = aiExplanationService.getExplanation("fen", "e4", 0, 50, true);
        
        assertNotNull(result);
        assertEquals("Ход в рамках стратегии, поддерживает баланс сил в позиции.", result);
    }
}
