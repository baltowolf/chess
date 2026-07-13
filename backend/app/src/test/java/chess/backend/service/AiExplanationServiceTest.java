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
        ReflectionTestUtils.setField(aiExplanationService, "apiUrl", "https://api.test/completions");
        ReflectionTestUtils.setField(aiExplanationService, "apiModel", "test-model");
    }

    @Test
    void testGetFullGameExplanation() {
        String jsonResponse = "{\"choices\": [{\"message\": {\"content\": \"Test analysis\"}}]}";

        when(restTemplate.postForObject(eq("https://api.test/completions"), ArgumentMatchers.<HttpEntity<String>>any(), eq(String.class)))
                .thenReturn(jsonResponse);

        String result = aiExplanationService.getFullGameExplanation("pgn", "[10, 20]");
        
        assertEquals("Test analysis", result);
    }

    @Test
    void testFallbackOnFailure() {
        when(restTemplate.postForObject(anyString(), ArgumentMatchers.any(), eq(String.class)))
                .thenThrow(new RuntimeException("Connection refused"));

        String result = aiExplanationService.getFullGameExplanation("pgn", "[10, 20]");
        
        assertNotNull(result);
        assertEquals("Failed to analyze the game. Please try again later.", result);
    }
}
