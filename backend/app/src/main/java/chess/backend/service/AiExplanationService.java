package chess.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AiExplanationService {

    private static final Logger log = LoggerFactory.getLogger(AiExplanationService.class);
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AiExplanationService() {
        this.restTemplate = new RestTemplate();
    }

    public AiExplanationService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Value("${ai.api.url:https://chat.deepseek.com/api/v0}")
    private String apiUrl;

    /**
     * Получает объяснение хода от DeepSeek ИИ, имитируя запросы к его официальному сайту.
     */
    public String getExplanation(String fenBefore, String move, int evalBefore, int evalAfter, boolean isWhiteToMove) {
        try {
            double before = evalBefore / 100.0;
            double after = evalAfter / 100.0;
            String side = isWhiteToMove ? "Белые" : "Черные";

            String prompt = String.format("Вы - эксперт по шахматам. Позиция (FEN) до хода: %s. Сторона '%s' сделала ход '%s'. " +
                            "Оценка движка до хода была %.2f, а после стала %.2f. " +
                            "Объясните этот ход на русском языке как шахматный тренер. Кратко, до 30 слов.",
                    fenBefore, side, move, before, after);

            // 1. Создаем сессию
            String sessionId = createChatSession();
            if (sessionId == null) return getStaticExplanation(evalBefore, evalAfter, isWhiteToMove);

            // 2. Отправляем запрос
            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("chat_session_id", sessionId);
            requestBody.putNull("parent_message_id");
            requestBody.put("model_type", "default");
            requestBody.put("prompt", prompt);
            requestBody.putArray("ref_file_ids");
            requestBody.put("thinking_enabled", false);
            requestBody.put("search_enabled", false);
            requestBody.putNull("action");
            requestBody.put("preempt", false);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            headers.set("Origin", "https://chat.deepseek.com");
            headers.set("Referer", "https://chat.deepseek.com/");
            headers.set("Accept", "*/*");

            HttpEntity<String> entity = new HttpEntity<>(requestBody.toString(), headers);
            String url = apiUrl + "/chat/completion";

            log.info("Sending prompt to DeepSeek site API: {}", prompt);
            String response = restTemplate.postForObject(url, entity, String.class);

            if (response != null) {
                return parseSseResponse(response);
            }
        } catch (Exception e) {
            log.error("DeepSeek site simulation error: {}", e.getMessage());
        }

        return getStaticExplanation(evalBefore, evalAfter, isWhiteToMove);
    }

    private String createChatSession() {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            
            HttpEntity<String> entity = new HttpEntity<>("{}", headers);
            String url = apiUrl + "/chat_session/create";
            
            String response = restTemplate.postForObject(url, entity, String.class);
            JsonNode root = objectMapper.readTree(response);
            return root.path("data").path("biz_data").path("chat_session").path("id").asText(null);
        } catch (Exception e) {
            log.error("Failed to create DeepSeek session: {}", e.getMessage());
            return null;
        }
    }

    private String parseSseResponse(String response) {
        StringBuilder result = new StringBuilder();
        // Ищем фрагменты текста в SSE формате: data: {"v":"текст"} или в начальном фрагменте
        // На основе примера: data: {"v":"..."}
        Pattern pattern = Pattern.compile("data: \\{\"v\":\"(.*?)\"\\}");
        Matcher matcher = pattern.matcher(response);
        while (matcher.find()) {
            String fragment = matcher.group(1);
            if (!fragment.startsWith("{")) { // Игнорируем мета-данные в конце
                result.append(fragment);
            }
        }
        
        // Также проверяем начальный фрагмент в fragments
        if (result.length() == 0 && response.contains("\"content\":\"")) {
             Pattern contentPattern = Pattern.compile("\"content\":\"(.*?)\"");
             Matcher contentMatcher = contentPattern.matcher(response);
             if (contentMatcher.find()) {
                 result.append(contentMatcher.group(1));
             }
        }

        String finalResult = result.toString()
                .replace("\\n", "\n")
                .replace("\\\"", "\"")
                .trim();
        
        return finalResult.isEmpty() ? null : finalResult;
    }

    private String getStaticExplanation(int evalBefore, int evalAfter, boolean isWhiteToMove) {
        int diff = evalAfter - evalBefore;
        if (!isWhiteToMove) diff = -diff;
        if (diff < -100) return "Этот ход серьезно ухудшает позицию. Стоило поискать более надежное продолжение.";
        if (diff > 100) return "Отличное решение! Этот ход значительно усиливает ваше давление на доске.";
        return "Ход в рамках стратегии, поддерживает баланс сил в позиции.";
    }
}
