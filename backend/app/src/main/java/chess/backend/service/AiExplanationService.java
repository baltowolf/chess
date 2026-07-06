package chess.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class AiExplanationService {

    private static final Logger log = LoggerFactory.getLogger(AiExplanationService.class);
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.api.url}")
    private String apiUrl;

    @Value("${ai.api.key}")
    private String apiKey;

    @Value("${ai.api.model}")
    private String apiModel;

    public String getExplanation(String fenBefore, String move, int evalBefore, int evalAfter, boolean isWhiteToMove) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            log.warn("AI API key is missing. Using fallback explanation logic.");
            return getFallbackExplanation(evalBefore, evalAfter, isWhiteToMove);
        }

        try {
            double before = evalBefore / 100.0;
            double after = evalAfter / 100.0;
            String side = isWhiteToMove ? "Белые" : "Черные";

            String prompt = String.format("Вы - эксперт по шахматам. Позиция (FEN) до хода: %s. Сторона '%s' сделала ход '%s'. " +
                    "Оценка движка до хода была %.2f, а после стала %.2f. " +
                    "Объясните этот ход на русском языке. Подобно шахматному тренеру объясни суть ошибки, если ход плохой" +
                            " или почему ход сильный, если ход хороший. Текст объяснения не должен превышать 30 слов.",
                    fenBefore, side, move, before, after);

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", apiModel);
            ArrayNode messages = requestBody.putArray("messages");

            ObjectNode systemMessage = objectMapper.createObjectNode();
            systemMessage.put("role", "system");
            systemMessage.put("content", "You are a helpful chess assistant. Reply only with the analysis text in Russian.");
            messages.add(systemMessage);

            ObjectNode userMessage = objectMapper.createObjectNode();
            userMessage.put("role", "user");
            userMessage.put("content", prompt);
            messages.add(userMessage);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);

            log.info("Sending request to AI for explanation: {}", prompt);
            String responseString = restTemplate.postForObject(apiUrl, entity, String.class);
            log.info("Received AI response: {}", responseString);

            if (responseString != null && !responseString.trim().isEmpty()) {
                JsonNode root = objectMapper.readTree(responseString);
                JsonNode choices = root.path("choices");
                if (choices.isArray() && choices.size() > 0) {
                    JsonNode messageNode = choices.get(0).path("message");
                    String content = messageNode.path("content").asText();
                    if (content != null && !content.trim().isEmpty()) {
                        return content.trim();
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to get explanation from AI", e);
        }

        return getFallbackExplanation(evalBefore, evalAfter, isWhiteToMove);
    }

    private String getFallbackExplanation(int evalBefore, int evalAfter, boolean isWhiteToMove) {
        int diff = evalAfter - evalBefore;
        if (!isWhiteToMove) {
            diff = -diff; // For black, a negative eval is good, so a drop in eval is good for black.
        }

        if (diff < -200) {
            return "Этот ход - грубая ошибка. Вы теряете много материала или получаете мат.";
        } else if (diff < -100) {
            return "Это плохой ход. Ваша позиция значительно ухудшилась.";
        } else if (diff < -50) {
            return "Сомнительный ход. Можно было сыграть лучше.";
        } else if (diff > 50) {
            return "Отличный ход! Ваша позиция стала лучше.";
        } else {
            return "Нормальный ход.";
        }
    }
}
