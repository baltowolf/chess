import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { AI_CONFIG } from './utils/config';
import { Chess } from 'chess.js';

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env['GEMINI_API_KEY'];
    aiClient = new GoogleGenAI(key ? { apiKey: key } : {});
  }
  return aiClient;
}

const app = express();
app.use(cors());
app.use(express.json());

const activeGames = new Map<string, any>();

app.post('/api/chess/start', (req, res) => {
  const gameId = crypto.randomUUID();
  const request = req.body || {};
  request.gameId = gameId;
  activeGames.set(gameId, request);
  res.json(request);
});

app.get('/api/chess/game/:id', (req, res) => {
  const game = activeGames.get(req.params.id);
  if (!game) {
    res.status(404).send();
    return;
  }
  res.json(game);
});

// We need a WebSocket handler
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

function getDepthForElo(elo: number): number {
  if (elo <= 800) return 2;
  if (elo <= 1000) return 3;
  if (elo <= 1200) return 4;
  if (elo <= 1400) return 5;
  if (elo <= 1500) return 6;
  if (elo <= 1600) return 7;
  if (elo <= 1700) return 8;
  if (elo <= 1800) return 9;
  if (elo <= 1900) return 10;
  if (elo <= 2000) return 11;
  if (elo <= 2100) return 12;
  if (elo <= 2200) return 13;
  return 15;
}

function getBlunderProbability(elo: number): number {
  // Humans even at low ratings try to make legal, sensible moves.
  // To simulate human blunders without making the computer look completely absurd,
  // we only trigger a completely random move with very low probabilities at low ELOs.
  if (elo <= 800) return 0.05; // 5% chance
  if (elo <= 1000) return 0.02; // 2% chance
  if (elo <= 1200) return 0.01; // 1% chance
  return 0.0; // 0% chance for 1300+ ELO - rely on Stockfish depth to play naturally
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchChessApiDirect(fen: string, depth: number, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('https://chess-api.com/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen, depth })
      });
      if (res.ok) {
        return await res.json();
      } else {
         console.warn(`[chess-api] returned status ${res.status} for depth ${depth}`);
         if (res.status === 429) {
            await delay(500 * (i + 1));
            continue;
         }
      }
    } catch (e) {
      console.error("[chess-api] fetch error:", e);
    }
    await delay(200);
  }
  return null;
}

class ChessApiQueue {
  private queue: Array<{
    fen: string;
    depth: number;
    priority: 'high' | 'low';
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private minInterval = 350; // ms spacing between low-priority requests to prevent 429 rate limits

  constructor() {}

  async enqueue(fen: string, depth: number, priority: 'high' | 'low' = 'low'): Promise<any> {
    return new Promise((resolve, reject) => {
      const task = { fen, depth, priority, resolve, reject };
      if (priority === 'high') {
        // High priority moves are inserted at the very front of the queue
        // so they bypass any pending evaluations.
        let lastHighIndex = -1;
        for (let i = this.queue.length - 1; i >= 0; i--) {
          if (this.queue[i].priority === 'high') {
            lastHighIndex = i;
            break;
          }
        }
        if (lastHighIndex >= 0) {
          this.queue.splice(lastHighIndex + 1, 0, task);
        } else {
          this.queue.unshift(task);
        }
      } else {
        this.queue.push(task);
      }
      this.processNext();
    });
  }

  private async processNext() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift()!;

    try {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      const requiredInterval = task.priority === 'high' ? 50 : this.minInterval;

      if (timeSinceLast < requiredInterval) {
        await delay(requiredInterval - timeSinceLast);
      }

      this.lastRequestTime = Date.now();
      const data = await fetchChessApiDirect(task.fen, task.depth);
      task.resolve(data);
    } catch (err) {
      task.reject(err);
    } finally {
      this.isProcessing = false;
      setTimeout(() => this.processNext(), 0);
    }
  }
}

const apiQueue = new ChessApiQueue();

async function getBestMove(fen: string, moveTimeMs: number, elo: number = 1500) {
  const depth = getDepthForElo(elo);
  const blunderProb = getBlunderProbability(elo);
  const triggerBlunder = Math.random() < blunderProb;

  if (triggerBlunder) {
    console.log(`[ELO ${elo}] Blunder triggered (probability: ${blunderProb.toFixed(2)})`);
    try {
      const chess = new Chess(fen);
      const moves = chess.moves({ verbose: true });
      if (moves.length > 0) {
        // Shuffle and pick a random legal move
        const shuffled = [...moves].sort(() => Math.random() - 0.5);
        const selected = shuffled[0];
        const lanMove = selected.lan || selected.from + selected.to + (selected.promotion || '');
        console.log(`[ELO ${elo}] Blunder chosen: ${lanMove}`);
        return lanMove;
      }
    } catch (e) {
      console.error("[ELO Blunder] Error picking random move:", e);
    }
  }

  // Game moves get high priority to execute instantly
  const data = await apiQueue.enqueue(fen, depth, 'high');
  if (data && data.move) {
    return data.move;
  }
  
  // Fallback to random move if API completely fails to avoid hanging
  console.log("[chess-api] Falling back to random move");
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    if (moves.length > 0) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      return randomMove.lan || randomMove.from + randomMove.to + (randomMove.promotion || '');
    }
  } catch(e) {
    console.error("Fallback random move error:", e);
  }
  return null;
}

async function getEvaluation(fen: string, depth: number = 8, priority: 'high' | 'low' = 'low') {
  const data = await apiQueue.enqueue(fen, depth, priority);
  if (data) {
    return {
      eval: data.eval !== undefined ? data.eval : 0,
      mate: data.mate,
      move: data.move
    };
  }
  return null;
}

function parseEvaluationScore(e: string): number {
  if (!e || typeof e !== 'string') return 0;
  if (e.startsWith("M")) return 10000 - parseInt(e.substring(1), 10);
  if (e.startsWith("-M")) return -10000 + Math.abs(parseInt(e.substring(2), 10));
  return parseFloat(e) || 0;
}

async function getFullGameExplanation(pgn: string, evaluationsJson: string, elo: number = 1500) {
  try {
    const evaluations: string[] = JSON.parse(evaluationsJson);
    const totalPlies = evaluations.length - 1;

    // Pre-calculate critical shifts
    const shifts: { ply: number; drop: number; evalBefore: string; evalAfter: string }[] = [];
    for (let i = 0; i < totalPlies; i++) {
      const evalBeforeStr = evaluations[i];
      const evalAfterStr = evaluations[i + 1];
      const evalBefore = parseEvaluationScore(evalBeforeStr);
      const evalAfter = parseEvaluationScore(evalAfterStr);
      
      let drop = 0;
      if (i % 2 === 0) {
        // White's turn: eval should not drop significantly (drop > 0 means mistake)
        drop = evalBefore - evalAfter;
      } else {
        // Black's turn: eval should not increase significantly (drop > 0 means mistake)
        drop = evalAfter - evalBefore;
      }
      
      if (drop > 0.8) { // Only consider significant shifts
        shifts.push({ ply: i, drop, evalBefore: evalBeforeStr, evalAfter: evalAfterStr });
      }
    }

    // Sort by largest drop and take top 5
    shifts.sort((a, b) => b.drop - a.drop);
    const topShifts = shifts.slice(0, 5);
    // Sort chronologically
    topShifts.sort((a, b) => a.ply - b.ply);

    let criticalMomentsText = "The engine identified the following critical mistakes/blunders:\n";
    if (topShifts.length === 0) {
      criticalMomentsText += "- No major blunders detected. A very solid game!\n";
    } else {
      topShifts.forEach(shift => {
        const side = shift.ply % 2 === 0 ? "White" : "Black";
        const moveNum = Math.floor(shift.ply / 2) + 1;
        criticalMomentsText += `- Ply index ${shift.ply} (Move ${moveNum} for ${side}): Evaluation shifted from ${shift.evalBefore} to ${shift.evalAfter}.\n`;
      });
    }

    let coachInstructions = "";
    if (elo < 1200) {
      coachInstructions = `
Вы анализируете игру новичка или слабого игрока (рейтинг ~${elo}).
- Стройте рекомендации и объяснения на ОЧЕНЬ простом и доступном языке. Не перегружайте терминами.
- Сосредоточьтесь на базовой безопасности фигур (зевки, прямые угрозы взятия, двойные удары, маты в 1-2 хода).
- Не говорите про сложные стратегические идеи (типа "борьба за поля", "миноритарная атака", "тонкая пешечная структура").
- Объясняйте, почему ход плохой, на языке материальных потерь ("этот ход отдает ладью", "теряется слон").
- Общайтесь максимально дружелюбно, поддерживающе и ободряюще, как терпеливый учитель.
- ОБЯЗАТЕЛЬНО оформляйте ходы из партии в виде ссылок [НомерХода. Ход](#move-plyIndex), а альтернативные ходы — в виде [Ход](#alt-plyIndex-san). Например: "[15. Nxe4](#move-28)" или "[d4](#alt-29-d4)". Без этого ссылки не будут кликабельными!
`;
    } else if (elo < 1800) {
      coachInstructions = `
Вы анализируете игру игрока среднего уровня (рейтинг ~${elo}).
- Объясняйте стандартные тактические мотивы (связки, вилки, отвлечения, открытые шахи) и базовые позиционные концепции (контроль открытых линий, пешечные слабости, форпосты, активность фигур).
- Можно использовать стандартную шахматную терминологию (фианкетто, темп, форпост, рокировка).
- Оценивайте ходы с точки зрения координации фигур, планов игры на 2-3 хода вперед и безопасности короля.
- Тон должен быть аналитическим, профессиональным и обучающим.
- ОБЯЗАТЕЛЬНО оформляйте ходы из партии в виде ссылок [НомерХода. Ход](#move-plyIndex), а альтернативные ходы — в виде [Ход](#alt-plyIndex-san). Например: "[15. Nxe4](#move-28)" или "[d4](#alt-29-d4)". Без этого ссылки не будут кликабельными!
`;
    } else {
      coachInstructions = `
Вы анализируете игру опытного игрока/эксперта (рейтинг ~${elo}).
- Общайтесь на профессиональном гроссмейстерском уровне. Полностью исключите банальные, очевидные тактические или стратегические объяснения.
- Сосредоточьтесь на глубоких позиционных нюансах, стратегических планах, тонкостях эндшпиля, сложных тактических перегрузках и дебютной теории.
- Активно используйте продвинутую шахматную терминологию.
- Тон должен быть исключительно аналитическим, прямым и лаконичным, как при разборе партии между равными сильными игроками.
- ОБЯЗАТЕЛЬНО оформляйте ходы из партии в виде ссылок [НомерХода. Ход](#move-plyIndex), а альтернативные ходы — в виде [Ход](#alt-plyIndex-san). Например: "[15. Nxe4](#move-28)" или "[d4](#alt-29-d4)". Без этого ссылки не будут кликабельными!
`;
    }

    const prompt = `You are an expert chess coach. Your task is to analyze the following chess game using the provided PGN and a pre-calculated list of critical mistakes.
You must return a highly structured, accurate, and consistent analysis in Russian. Keep the analysis VERY CONCISE to save time.

### ИНСТРУКЦИЯ ДЛЯ ТРЕНЕРА (ВАЖНО! СТРОЙТЕ ОБЪЯСНЕНИЯ ИСХОДЯ ИЗ РЕЙТИНГА ИГРОКА):
${coachInstructions}

### INPUT DATA:
1. PGN: ${pgn}
2. Critical Engine Shifts:
${criticalMomentsText}

### ANALYSIS RULES (MANDATORY):
- Analyze and explain all the critical engine shifts listed above (up to 4-5 key moments).
- **CRITICAL REQUIREMENT**: Pay special attention to the end of the game and any blunder/mistake on the LAST moves of the game if they are listed in the critical shifts. It is extremely important to discuss them, do NOT ignore them!
- If there are no major blunders, highlight just 1 or 2 most important strategic moments.
- For each key moment you discuss, you MUST:
  1. State the move using the mandatory link format for actual moves: [MoveNumber. Move] with href '#move-plyIndex'.
     * Example: If White's 15th move is Nxe4 and it's ply index 28, write: "[15. Nxe4](#move-28)".
  2. Explain very briefly WHY the move was a mistake.
  3. Suggest an alternative better move and format it exactly as: [Move] with href '#alt-plyIndex-san'.
     * Example: "[d4](#alt-29-d4)".

### OUTPUT STRUCTURE (MANDATORY HEADINGS IN RUSSIAN):
You MUST structure your response with these exact markdown headings:

### 📊 Общий обзор партии
Provide a 2-3 sentence summary of the game.

### 🔑 Ключевые моменты
List all identified critical moments (up to 4-5 moments), ensuring you include the final moves if a blunder occurred there. Use the clickable links. Keep them concise but highly informative.

### 💡 Совет тренера
Provide exactly 1 short actionable coaching tip.

### STYLE & FORMATTING RULES:
- Use Markdown. Use bold and lists.
- Tone: Analytical, brief, encouraging.
- LANGUAGE: Answer ONLY in Russian.
- DO NOT print any preamble or internal thoughts. Just start directly with the first heading.`;

    const apiUrl = AI_CONFIG.API_URL;
    const apiModel = AI_CONFIG.API_MODEL;
    if (apiUrl) {
      try {
        console.log(`[AI] Querying alternative API: ${apiUrl} with model: ${apiModel}`);
        const headers: any = { 'Content-Type': 'application/json' };
        if (apiUrl.includes('generativelanguage.googleapis.com')) {
           headers['Authorization'] = `Bearer ${process.env['GEMINI_API_KEY']}`;
        }
        
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: apiModel,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.text;
          if (text && text.trim().length > 0) {
            console.log("[AI] Alternative API explanation generated successfully.");
            return text;
          }
        } else {
          console.warn(`[AI] Alternative API status ${res.status}: ${await res.text()}`);
        }
      } catch (err) {
        console.error("[AI] Alternative API query error, falling back to Gemini:", err);
      }
    }

    // Fallback to Gemini
    console.log("[AI] Querying Gemini API...");
    try {
      const response = await getAiClient().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const text = response.text;
      if (text && text.trim().length > 0) {
        console.log("[AI] Gemini API 2.5-flash explanation generated successfully.");
        return text;
      }
    } catch (geminiErr) {
      console.warn("[AI] Gemini 2.5-flash failed, trying 3.5-flash...", geminiErr);
      try {
        const response = await getAiClient().models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
        });
        const text = response.text;
        if (text && text.trim().length > 0) {
          console.log("[AI] Gemini API 3.5-flash explanation generated successfully.");
          return text;
        }
      } catch (gemini35Err) {
        console.error("[AI] Both 2.5-flash and 3.5-flash failed:", gemini35Err);
      }
    }
  } catch (e) {
    console.error("getFullGameExplanation total error:", e);
  }

  return "Произошла ошибка при получении анализа от ИИ-тренера. Попробуйте позже.";
}

wss.on('connection', (ws) => {
  ws.on('message', async (message: Buffer) => {
    try {
      const payload = JSON.parse(message.toString());
      const type = payload.type || '';
      
      if (type === 'ENGINE_MOVE' || type === 'REQUEST_MOVE') {
        const fen = payload.fen;
        const difficulty = payload.difficulty || 1500;
        const bestMove = await getBestMove(fen, 1000, difficulty);
        if (bestMove) {
          ws.send(JSON.stringify({ type: 'ENGINE_MOVE', move: bestMove }));
        }
      } else if (type === 'EVALUATE_MOVE') {
        const fen = payload.fen;
        const index = payload.index;
        const analysisDepth = payload.depth || 8;
        const evalNode = await getEvaluation(fen, analysisDepth);
        ws.send(JSON.stringify({ 
           type: 'EVALUATION_RESULT', 
           index: index, 
           evaluation: evalNode
        }));
      } else if (type === 'ANALYZE_GAME') {
        const pgn = payload.pgn;
        const fens = payload.fens || [];
        const precomputed = payload.precomputedEvaluations || [];
        const analysisDepth = payload.depth || 8;
        const elo = payload.elo || 1500;
        const evaluations = new Array(fens.length).fill(null);
        const evalValues = new Array(fens.length).fill(0);
        
        // Evaluate sequentially, using precomputed if available
        for (let index = 0; index < fens.length; index++) {
          const fen = fens[index];
          let evalNode = precomputed[index];
          
          if (!evalNode && evalNode !== null) { // precomputed might be explicitly null if failed, but we want to retry if it's strictly undefined or null
             evalNode = await getEvaluation(fen, analysisDepth);
          } else if (evalNode === null) {
             evalNode = await getEvaluation(fen, analysisDepth);
          }
          
          evaluations[index] = evalNode;
          
          let evalValue = 0;
          if (evalNode && evalNode.eval !== undefined && evalNode.eval !== null) {
            evalValue = Math.floor(Number(evalNode.eval) * 100);
          } else if (evalNode && evalNode.mate !== undefined && evalNode.mate !== null) {
            const mate = parseInt(evalNode.mate, 10);
            if (mate === 0) {
              const isWhiteToMove = fens[index].includes(' w ');
              evalValue = isWhiteToMove ? -10000 : 10000;
            } else {
              evalValue = mate > 0 ? 10000 - mate : -10000 - mate;
            }
          } else if (index > 0) {
            evalValue = evalValues[index - 1]; // Inherit previous eval if failed
          }
          evalValues[index] = evalValue;
          
          // Send progress to client
          ws.send(JSON.stringify({ 
            type: 'ANALYSIS_PROGRESS', 
            index: index, 
            evaluation: evalNode,
            total: fens.length
          }));
        }
        
        const formattedEvals = evalValues.map(v => {
          if (v >= 9000) return `M${10000 - v}`;
          if (v <= -9000) return `-M${10000 + v}`;
          const sign = v >= 0 ? '+' : '';
          return sign + (v / 100).toFixed(2);
        });

        // Tell the client that stockfish is done so it can unlock the UI
        ws.send(JSON.stringify({
          type: 'ANALYSIS_EVALUATION_DONE',
          evaluations
        }));

        const aiText = await getFullGameExplanation(pgn, JSON.stringify(formattedEvals), elo);
        
        ws.send(JSON.stringify({
          type: 'ANALYSIS_GAME_RESULT',
          aiExplanation: aiText
        }));
      }
    } catch (e) {
      console.error("WS message error:", e);
    }
  });
});

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws-chess') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// For standalone running, we serve the frontend dist
app.use(express.static('dist/frontend/browser'));
app.get(/.*/, (req, res) => {
  res.sendFile('dist/frontend/browser/index.html', { root: '.' });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
