package chess.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiExplanationServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private AiExplanationService aiExplanationService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(aiExplanationService, "restTemplate", restTemplate);
    }

    @Test
    void testGetExplanation_ApiSuccess() {
        String mockResponse = "Это отличный ход, захватывающий центр.";
        when(restTemplate.postForObject(eq("https://text.pollinations.ai/"), any(HttpEntity.class), eq(String.class)))
                .thenReturn(mockResponse);

        String explanation = aiExplanationService.getExplanation("e4", 0, 50, true);

        assertEquals(mockResponse, explanation);
    }

    @Test
    void testGetExplanation_Fallback() {
        when(restTemplate.postForObject(eq("https://text.pollinations.ai/"), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RuntimeException("API Down"));

        String explanation = aiExplanationService.getExplanation("e4", 0, 100, true);

        assertEquals("Отличный ход! Ваша позиция стала лучше.", explanation);
    }
}
