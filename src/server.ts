import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import crypto from 'crypto';

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

async function getBestMove(fen: string, moveTimeMs: number) {
  try {
    const response = await fetch('https://chess-api.com/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth: currentDepth })
    });
    if (!response.ok) return null;
    const text = await response.text();
    const root = JSON.parse(text);
    if (root.lan) {
      return root.lan;
    }
  } catch (e) {
    console.error("getBestMove error:", e);
  }
  return null;
}

async function getEvaluation(fen: string) {
  try {
    const response = await fetch('https://chess-api.com/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth: 10 })
    });
    if (!response.ok) return null;
    const text = await response.text();
    const root = JSON.parse(text);
    
    if (root.type === 'error') {
      return null;
    }

    const mapped: any = {};
    if (root.eval !== undefined && root.eval !== null) {
      mapped.eval = Number(root.eval);
    }
    if (root.mate !== undefined && root.mate !== null) {
      mapped.mate = Number(root.mate);
    }
    if (root.lan) {
      mapped.move = root.lan;
    }
    return mapped;
  } catch (e) {
    console.error("getEvaluation error:", e);
    return null;
  }
}

async function getFullGameExplanation(pgn: string, evaluations: string) {
  try {
    const prompt = `You are an expert chess coach. Analyze the following game and provide a concise review in Russian language, pointing out key moments and giving recommendations.
    
IMPORTANT: Keep your answer relatively brief (max 3-4 paragraphs). Answer ONLY in Russian. Do NOT output internal thoughts or reasoning.

PGN: ${pgn}
Evaluations (centipawns): ${evaluations}`;
    
    const apiUrl = process.env['AI_API_URL'] || 'https://text.pollinations.ai/openai/v1/chat/completions';
    const apiModel = process.env['AI_API_MODEL'] || 'openai';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: apiModel,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) return "Произошла ошибка при получении анализа от ИИ-тренера (ошибка сети). Попробуйте позже.";
    const text = await response.text();
    const root = JSON.parse(text);
    if (root.choices && root.choices.length > 0) {
      const msg = root.choices[0].message;
      if (msg.content && msg.content.trim().length > 0) {
        return msg.content;
      } else {
        return "Извините, ИИ-тренер не смог завершить анализ (возможно, партия слишком длинная).";
      }
    }
  } catch (e) {
    console.error("getFullGameExplanation error:", e);
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
        const evaluations = new Array(fens.length).fill(null);
        const evalValues = new Array(fens.length).fill(0);
        
        // Evaluate incrementally with delay to avoid rate limiting
        for (let i = 0; i < fens.length; i++) {
          const evalNode = await getEvaluation(fens[i]);
          evaluations[i] = evalNode;
          
          let evalValue = 0;
          if (evalNode && evalNode.eval !== undefined && evalNode.eval !== null) {
            evalValue = Math.floor(Number(evalNode.eval) * 100);
          } else if (evalNode && evalNode.mate !== undefined && evalNode.mate !== null) {
            const mate = parseInt(evalNode.mate, 10);
            if (mate === 0) {
              const isWhiteToMove = fens[i].includes(' w ');
              evalValue = isWhiteToMove ? -10000 : 10000;
            } else {
              evalValue = mate > 0 ? 10000 - mate : -10000 - mate;
            }
          } else if (i > 0) {
            evalValue = evalValues[i - 1]; // Inherit previous eval if failed
          }
          evalValues[i] = evalValue;
          
          // Send progress to client
          ws.send(JSON.stringify({ 
            type: 'ANALYSIS_PROGRESS', 
            index: i, 
            evaluation: evalNode,
            total: fens.length
          }));

          // Add small delay to avoid overwhelming the chess API
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const aiText = await getFullGameExplanation(pgn, JSON.stringify(evalValues));
        
        ws.send(JSON.stringify({
          type: 'ANALYSIS_GAME_RESULT',
          evaluations,
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
