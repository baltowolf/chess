import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import stockfish from 'stockfish';

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
  const request = req.body;
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

let currentDepth = 5;
function setDifficulty(elo: number) {
  currentDepth = Math.max(1, Math.min(15, Math.floor((elo - 800) * 14 / 2400) + 1));
}

function countPieces(fen: string): number {
  const piecePlacement = fen.split(' ')[0];
  const pieces = piecePlacement.replace(/[^a-zA-Z]/g, '');
  return pieces.length;
}

async function queryLichessTablebase(fen: string) {
  try {
    const url = `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Tablebase] Lichess tablebase returned status ${res.status} for FEN: ${fen}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[Tablebase] queryLichessTablebase error:", err);
    return null;
  }
}

async function getBestMove(fen: string, moveTimeMs: number) {
  try {
    if (countPieces(fen) <= 7) {
      console.log(`[Tablebase] Checking 7-or-fewer pieces endgame for FEN: ${fen}`);
      const tbData = await queryLichessTablebase(fen);
      if (tbData && tbData.moves && tbData.moves.length > 0) {
        // Sort moves to find the absolutely best move (minimizes opponent's WDL and DTM/DTZ)
        const sortedMoves = [...tbData.moves].sort((a: any, b: any) => {
          if (a.wdl !== b.wdl) {
            return a.wdl - b.wdl; // Lower wdl from opponent perspective is better for us
          }
          const dtmA = a.dtm !== undefined && a.dtm !== null ? a.dtm : (a.dtz || 0);
          const dtmB = b.dtm !== undefined && b.dtm !== null ? b.dtm : (b.dtz || 0);
          return dtmB - dtmA; // Descending dtm/dtz
        });
        const bestMove = sortedMoves[0];
        console.log(`[Tablebase] Found perfect move: ${bestMove.uci} with opponent WDL: ${bestMove.wdl}`);
        return bestMove.uci;
      }
    }
  } catch (err) {
    console.error("[Tablebase] getBestMove tablebase error:", err);
  }

  try {
    const res = await sharedEngine.evaluate(fen, currentDepth);
    if (res && res.move) {
      return res.move;
    }
  } catch (e) {
    console.error("getBestMove error:", e);
  }
  return null;
}

class StockfishEngine {
  engine: any;
  ready: Promise<void>;
  resolvers: any[];

  constructor() {
    this.resolvers = [];
    this.ready = new Promise(async (resolve) => {
      this.engine = await stockfish();
      const oldPrint = this.engine.print;
      this.engine.print = (line: string) => {
        if (oldPrint) oldPrint(line);
        this.onMessage(line);
      };
      resolve();
    });
  }
  onMessage(line: string) {
    for (const resolver of this.resolvers) {
      resolver(line);
    }
  }
  async evaluate(fen: string, depth: number): Promise<any> {
    await this.ready;
    return new Promise(resolve => {
      let evalScore = 0;
      let mateScore: number | null = null;
      let bestMove = '';

      const listener = (line: string) => {
        if (line.includes('score cp')) {
          const match = line.match(/score cp (-?\d+)/);
          if (match) evalScore = parseInt(match[1]);
          mateScore = null;
        }
        if (line.includes('score mate')) {
          const match = line.match(/score mate (-?\d+)/);
          if (match) mateScore = parseInt(match[1]);
        }
        if (line.startsWith('bestmove')) {
          const match = line.match(/bestmove ([a-h1-8a-zA-Z]+)/);
          if (match) bestMove = match[1];
          
          this.resolvers = this.resolvers.filter(r => r !== listener);
          
          resolve({
            eval: evalScore / 100, // chess-api returns eval in pawns
            mate: mateScore,
            move: bestMove
          });
        }
      };
      this.resolvers.push(listener);
      this.engine.sendCommand('position fen ' + fen);
      this.engine.sendCommand('go depth ' + depth);
    });
  }
}

const sharedEngine = new StockfishEngine();

async function getEvaluation(fen: string, depth: number = 8) {
  try {
    if (countPieces(fen) <= 7) {
      console.log(`[Tablebase] Evaluating 7-or-fewer pieces endgame for FEN: ${fen}`);
      const tbData = await queryLichessTablebase(fen);
      if (tbData) {
        const mapped: any = { isTablebase: true };
        
        const isWhiteToMove = fen.split(' ')[1] === 'w';
        const wdl = tbData.wdl;
        const dtm = tbData.dtm;
        
        let isWhiteWinning = false;
        let isBlackWinning = false;

        if (wdl > 0) {
          if (isWhiteToMove) {
            isWhiteWinning = true;
          } else {
            isBlackWinning = true;
          }
        } else if (wdl < 0) {
          if (isWhiteToMove) {
            isBlackWinning = true;
          } else {
            isWhiteWinning = true;
          }
        }

        if (isWhiteWinning) {
          if (dtm !== undefined && dtm !== null && dtm !== 0) {
            mapped.mate = Math.ceil(Math.abs(dtm) / 2);
          } else {
            mapped.eval = 10.0;
          }
        } else if (isBlackWinning) {
          if (dtm !== undefined && dtm !== null && dtm !== 0) {
            mapped.mate = -Math.ceil(Math.abs(dtm) / 2);
          } else {
            mapped.eval = -10.0;
          }
        } else {
          mapped.eval = 0.0;
        }

        if (tbData.moves && tbData.moves.length > 0) {
          const sortedMoves = [...tbData.moves].sort((a: any, b: any) => {
            if (a.wdl !== b.wdl) {
              return a.wdl - b.wdl;
            }
            const dtmA = a.dtm !== undefined && a.dtm !== null ? a.dtm : (a.dtz || 0);
            const dtmB = b.dtm !== undefined && b.dtm !== null ? b.dtm : (b.dtz || 0);
            return dtmB - dtmA;
          });
          mapped.move = sortedMoves[0].uci;
        }

        console.log(`[Tablebase] Endgame position successfully mapped to:`, mapped);
        return mapped;
      }
    }
  } catch (err) {
    console.error("[Tablebase] getEvaluation tablebase error:", err);
  }

  try {
    return await sharedEngine.evaluate(fen, depth);
  } catch (e) {
    console.error("getEvaluation error:", e);
    return null;
  }
}

function parseEvaluationScore(e: string): number {
  if (!e || typeof e !== 'string') return 0;
  if (e.startsWith("M")) return 10000 - parseInt(e.substring(1), 10);
  if (e.startsWith("-M")) return -10000 + Math.abs(parseInt(e.substring(2), 10));
  return parseFloat(e) || 0;
}

async function getFullGameExplanation(pgn: string, evaluationsJson: string) {
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

    const prompt = `You are an expert chess coach. Your task is to analyze the following chess game using the provided PGN and a pre-calculated list of critical mistakes.
You must return a highly structured, accurate, and consistent analysis in Russian. Keep the analysis VERY CONCISE to save time.

### INPUT DATA:
1. PGN: ${pgn}
2. Critical Engine Shifts:
${criticalMomentsText}

### ANALYSIS RULES (MANDATORY):
- Focus YOUR review ONLY on the top 1 or 2 critical engine shifts provided above. Do not over-analyze.
- If there are no major blunders, highlight just one most important strategic moment.
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
List ONLY the 1-2 most critical moments. Use the clickable links. Keep it brief.

### 💡 Совет тренера
Provide exactly 1 short actionable coaching tip.

### STYLE & FORMATTING RULES:
- Use Markdown. Use bold and lists.
- Tone: Analytical, brief, encouraging.
- LANGUAGE: Answer ONLY in Russian.
- DO NOT print any preamble or internal thoughts. Just start directly with the first heading.`;

    // Try alternative API first if configured
    const apiUrl = process.env['AI_API_URL'];
    const apiModel = process.env['AI_API_MODEL'] || 'openai';
    if (apiUrl) {
      try {
        console.log(`[AI] Querying alternative API: ${apiUrl} with model: ${apiModel}`);
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    const response = await getAiClient().models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });
    
    const text = response.text;
    if (text && text.trim().length > 0) {
      console.log("[AI] Gemini API explanation generated successfully.");
      return text;
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
        setDifficulty(difficulty);
        const bestMove = await getBestMove(fen, 1000);
        if (bestMove) {
          ws.send(JSON.stringify({ type: 'ENGINE_MOVE', move: bestMove }));
        }
      } else if (type === 'ANALYZE_GAME') {
        const pgn = payload.pgn;
        const fens = payload.fens || [];
        const analysisDepth = payload.depth || 8;
        const evaluations = new Array(fens.length).fill(null);
        const evalValues = new Array(fens.length).fill(0);
        
        // Evaluate sequentially since we share a single Stockfish instance
        for (let index = 0; index < fens.length; index++) {
          const fen = fens[index];
          const evalNode = await getEvaluation(fen, analysisDepth);
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

        const aiText = await getFullGameExplanation(pgn, JSON.stringify(formattedEvals));
        
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

const PORT = Number(process.env['PORT']) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
