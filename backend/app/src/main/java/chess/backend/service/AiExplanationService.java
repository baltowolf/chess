package chess.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiExplanationService {

    private static final Logger log = LoggerFactory.getLogger(AiExplanationService.class);
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.api.url:https://text.pollinations.ai/openai/v1/chat/completions}")
    private String apiUrl;

    @Value("${ai.api.model:openai}")
    private String apiModel;

    public AiExplanationService() {
        this.restTemplate = new RestTemplate();
    }

    public AiExplanationService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String getFullGameExplanation(String pgn, String evaluations) {
        try {
            String prompt = String.format(
                "You are an expert chess coach. Analyze the following game and provide a detailed review in Russian language, pointing out key moments and giving recommendations, as a coach would do. Feel free to explain without length limit.\n\nPGN: %s\nEvaluations (centipawns): %s",
                pgn, evaluations
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> message = new HashMap<>();
            message.put("role", "user");
            message.put("content", prompt);

            List<Map<String, Object>> messages = new ArrayList<>();
            messages.add(message);

            Map<String, Object> requestMap = new HashMap<>();
            requestMap.put("model", apiModel);
            requestMap.put("messages", messages);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestMap, headers);
            String response = restTemplate.postForObject(apiUrl, entity, String.class);

            JsonNode root = objectMapper.readTree(response);
            if (root.has("choices") && root.get("choices").size() > 0) {
                return root.get("choices").get(0).get("message").get("content").asText();
            }
        } catch (Exception e) {
            log.error("Failed to generate AI analysis", e);
        }
        return "Failed to analyze the game. Please try again later.";
    }

    public String getExplanation(String fenBefore, String move, int evalBefore, int evalAfter, boolean isWhiteToMove) {
        return getFullGameExplanation("", "0");
    }
}
