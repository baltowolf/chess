package chess.backend.service;

import org.springframework.stereotype.Service;

@Service
public class AiExplanationService {

    /**
     * Given a move and the evaluation change (difference in centipawns),
     * returns a short textual explanation.
     */
    public String getExplanation(String move, int evalBefore, int evalAfter, boolean isWhiteToMove) {
        int diff = evalAfter - evalBefore;
        if (!isWhiteToMove) {
            diff = -diff; // For black, a negative eval is good, so a drop in eval is good for black.
        }

        // Extremely simplified AI logic for text explanation
        if (diff < -200) {
            return "Этот ход - грубая ошибка (бландер). Вы теряете много материала или получаете мат.";
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
