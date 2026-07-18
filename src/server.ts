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
    aiClient = new GoogleGenAI({
      apiKey: key || undefined,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
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

function getDepthForSkillLevel(skillLevel: number): number {
  if (skillLevel <= 1) return 1;
  if (skillLevel === 2) return 2;
  if (skillLevel === 3) return 3;
  if (skillLevel === 4) return 4;
  if (skillLevel === 5) return 5;
  if (skillLevel === 6) return 6;
  if (skillLevel === 7) return 7;
  if (skillLevel === 8) return 8;
  if (skillLevel === 9) return 9;
  if (skillLevel === 10) return 10;
  if (skillLevel === 11) return 11;
  if (skillLevel === 12) return 12;
  if (skillLevel === 13) return 13;
  if (skillLevel === 14) return 14;
  return 15;
}

function getBlunderProbabilityForSkillLevel(skillLevel: number): number {
  if (skillLevel <= 1) return 0.25;
  if (skillLevel === 2) return 0.20;
  if (skillLevel === 3) return 0.15;
  if (skillLevel === 4) return 0.12;
  if (skillLevel === 5) return 0.10;
  if (skillLevel === 6) return 0.08;
  if (skillLevel === 7) return 0.06;
  if (skillLevel === 8) return 0.04;
  if (skillLevel === 9) return 0.02;
  if (skillLevel === 10) return 0.01;
  return 0.0;
}

function isSquareAttackedByOpponentPawn(chess: Chess, square: string, turn: 'w' | 'b'): boolean {
  const colChar = square[0];
  const rowNum = parseInt(square[1], 10);
  const colIndex = colChar.charCodeAt(0) - 97; // a -> 0, b -> 1, ..., h -> 7

  const oppColor = turn === 'w' ? 'b' : 'w';
  const oppPawnRow = oppColor === 'w' ? rowNum - 1 : rowNum + 1;

  if (oppPawnRow < 1 || oppPawnRow > 8) return false;

  const attackCols = [];
  if (colIndex > 0) attackCols.push(String.fromCharCode(97 + colIndex - 1));
  if (colIndex < 7) attackCols.push(String.fromCharCode(97 + colIndex + 1));

  for (const c of attackCols) {
    const p = chess.get((c + oppPawnRow) as any);
    if (p && p.type === 'p' && p.color === oppColor) {
      return true;
    }
  }
  return false;
}

function scoreMove(chess: Chess, m: any, bestMoveLan: string): number {
  const lan = m.from + m.to + (m.promotion || '');
  if (lan === bestMoveLan) {
    return 1000; // Stockfish best move
  }

  let score = 500; // Base score for legal, safe-looking moves

  // Heuristic: Castling is almost always a great move for humans
  if (m.flags.includes('k') || m.flags.includes('q')) {
    score += 300; // Castling is beautiful
  }

  // Heuristic: Captures are very attractive to humans
  if (m.captured) {
    const pieceValues: { [key: string]: number } = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };
    const victimVal = pieceValues[m.captured] || 100;
    const attackerVal = pieceValues[m.piece] || 100;
    
    if (victimVal >= attackerVal) {
      // Capturing a piece of equal or higher value
      score += 250 + (victimVal - attackerVal) / 10;
    } else {
      // Capturing a lower-value piece (e.g. bishop takes pawn)
      score += 150;
    }
  }

  // Heuristic: Checks are highly attractive to humans
  if (m.san.includes('+')) {
    score += 180;
  }

  // Heuristic: Development in the opening
  const isOpening = chess.history().length < 12;
  const isWhite = m.color === 'w';
  const fromRow = parseInt(m.from[1], 10);
  const toRow = parseInt(m.to[1], 10);

  if (isOpening) {
    // Developing Knights and Bishops
    if (m.piece === 'n' || m.piece === 'b') {
      const isBackRank = isWhite ? fromRow === 1 : fromRow === 8;
      if (isBackRank) {
        score += 120; // Developing from starting square
      }
    }
    // Controlling the center with pawns
    if (m.piece === 'p') {
      const isCenterCol = m.to[0] === 'd' || m.to[0] === 'e';
      if (isCenterCol && (toRow === 4 || toRow === 5)) {
        score += 100; // Center pawn push
      }
    }
    // Queen moves in early opening are usually bad/suboptimal
    if (m.piece === 'q' && fromRow === (isWhite ? 1 : 8)) {
      score -= 100; // Premature queen move
    }
  }

  // Heuristic: Avoid putting pieces on squares attacked by opponent pawns for free
  const toSquare = m.to;
  if (isSquareAttackedByOpponentPawn(chess, toSquare, m.color)) {
    const pieceValues: { [key: string]: number } = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 1000 };
    const myVal = pieceValues[m.piece] || 100;
    if (myVal > 100) {
      // Hanging a piece to a pawn is a major blunder!
      score -= (myVal + 100);
    } else if (!m.captured) {
      // Pawn moving to where it can be captured by another pawn
      score -= 80;
    }
  }

  // Heuristic: Knight on the rim is dim
  if (m.piece === 'n') {
    const rimCols = ['a', 'h'];
    if (rimCols.includes(m.to[0])) {
      score -= 50;
    }
  }

  // Keep score within reasonable bounds [10, 1000]
  return Math.max(10, Math.min(1000, score));
}

function selectMoveBasedOnElo(bestMoveLan: string, legalMoves: any[], chess: Chess, targetElo: number): string {
  if (legalMoves.length === 0) return '';
  if (legalMoves.length === 1) {
    const onlyMove = legalMoves[0];
    return onlyMove.lan || onlyMove.from + onlyMove.to + (onlyMove.promotion || '');
  }

  // Score all legal moves
  const scoredMoves = legalMoves.map(m => {
    const lan = m.from + m.to + (m.promotion || '');
    const score = scoreMove(chess, m, bestMoveLan);
    return { move: m, lan, score };
  });

  // Separate into buckets
  const bestMoveItem = scoredMoves.find(item => item.lan === bestMoveLan);
  const otherMoves = scoredMoves.filter(item => item.lan !== bestMoveLan);

  // If we can't find the best move in legal moves for some reason, fallback
  if (!bestMoveItem) {
    scoredMoves.sort((a, b) => b.score - a.score);
    return scoredMoves[0].lan;
  }

  const goodMoves = otherMoves.filter(item => item.score >= 650);
  const normalMoves = otherMoves.filter(item => item.score >= 350 && item.score < 650);
  const mistakeMoves = otherMoves.filter(item => item.score >= 150 && item.score < 350);
  const blunderMoves = otherMoves.filter(item => item.score < 150);

  // Determine probabilities based on target ELO
  let pBest = 1.0;
  let pGood = 0.0;
  let pNormal = 0.0;
  let pMistake = 0.0;
  let pBlunder = 0.0;

  if (targetElo >= 2200) {
    pBest = 0.98;
    pGood = 0.02;
  } else if (targetElo >= 1800) {
    pBest = 0.85;
    pGood = 0.12;
    pNormal = 0.03;
  } else if (targetElo >= 1500) {
    pBest = 0.65;
    pGood = 0.22;
    pNormal = 0.10;
    pMistake = 0.03;
  } else if (targetElo >= 1200) {
    pBest = 0.45;
    pGood = 0.30;
    pNormal = 0.15;
    pMistake = 0.08;
    pBlunder = 0.02;
  } else {
    // Beginner (<= 1199 ELO)
    pBest = 0.30;
    pGood = 0.35;
    pNormal = 0.20;
    pMistake = 0.10;
    pBlunder = 0.05;
  }

  // Roll a dice to select a bucket
  const rand = Math.random();
  
  const attemptSelectFromBucket = (bucket: typeof otherMoves) => {
    if (bucket.length > 0) {
      const chosen = bucket[Math.floor(Math.random() * bucket.length)];
      return chosen.lan;
    }
    return null;
  };

  let cumulativeProb = 0;

  cumulativeProb += pBest;
  if (rand < cumulativeProb) {
    return bestMoveItem.lan;
  }

  cumulativeProb += pGood;
  if (rand < cumulativeProb) {
    const move = attemptSelectFromBucket(goodMoves);
    if (move) return move;
  }

  cumulativeProb += pNormal;
  if (rand < cumulativeProb) {
    const move = attemptSelectFromBucket(normalMoves);
    if (move) return move;
  }

  cumulativeProb += pMistake;
  if (rand < cumulativeProb) {
    const move = attemptSelectFromBucket(mistakeMoves);
    if (move) return move;
  }

  cumulativeProb += pBlunder;
  if (rand < cumulativeProb) {
    const move = attemptSelectFromBucket(blunderMoves);
    if (move) return move;
  }

  // Fallback: if selected bucket was empty, try to select from the closest non-empty bucket
  const allBucketsOrdered = [
    { name: 'best', moves: [bestMoveItem] },
    { name: 'good', moves: goodMoves },
    { name: 'normal', moves: normalMoves },
    { name: 'mistake', moves: mistakeMoves },
    { name: 'blunder', moves: blunderMoves }
  ];

  for (const b of allBucketsOrdered) {
    if (b.moves.length > 0) {
      const chosen = b.moves[Math.floor(Math.random() * b.moves.length)];
      return chosen.lan;
    }
  }

  return bestMoveItem.lan;
}

async function getMultiPvLines(fen: string, depth: number, count: number = 5): Promise<Array<{ move: any; lan: string; san: string; score: number }>> {
  try {
    const chess = new Chess(fen);
    const activeColor = chess.turn(); // 'w' or 'b'
    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) return [];

    // 1. Get the absolute best move from Chess API (Stockfish 1st PV)
    const bestMoveNode = await getEvaluation(fen, depth, 'high');
    if (!bestMoveNode) return [];

    const bestMoveLan = bestMoveNode.move; // e.g. 'e2e4'
    const bestMoveObj = legalMoves.find(m => {
      const lan = m.from + m.to + (m.promotion || '');
      return lan === bestMoveLan;
    });

    if (!bestMoveObj) return [];

    const pvs: Array<{ move: any; lan: string; san: string; score: number }> = [];

    // Score of the best move is the engine evaluation
    const bestEvalStr = bestMoveNode.eval !== undefined ? String(bestMoveNode.eval) : '0';
    let bestScoreNum = parseEvaluationScore(bestEvalStr);
    if (bestMoveNode.mate !== undefined && bestMoveNode.mate !== null) {
      const m = parseInt(String(bestMoveNode.mate), 10);
      bestScoreNum = m > 0 ? (10000 - m) : (-10000 + Math.abs(m));
    }

    // Convert to relative score for descending sort
    const bestRelativeScore = activeColor === 'w' ? bestScoreNum : -bestScoreNum;

    pvs.push({
      move: bestMoveObj,
      lan: bestMoveLan,
      san: bestMoveNode.san || bestMoveObj.san,
      score: bestRelativeScore
    });

    // 2. Identify and rank other moves to evaluate the next candidate moves
    const otherMoves = legalMoves.filter(m => {
      const lan = m.from + m.to + (m.promotion || '');
      return lan !== bestMoveLan;
    });

    if (otherMoves.length > 0) {
      const pieceValues: { [key: string]: number } = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

      // Use a fast heuristic score to rank which moves to query Stockfish for
      const rankedOther = otherMoves.map(m => {
        let hScore = 0;
        
        if (m.captured) {
          const victimValue = pieceValues[m.captured] || 1;
          const attackerValue = pieceValues[m.piece] || 1;
          hScore += 100 + victimValue - (attackerValue / 100);
        }

        if (m.san.includes('O-O')) {
          hScore += 90;
        }

        if (m.san.includes('+')) {
          hScore += 85;
        }

        const toRow = parseInt(m.to[1], 10);
        const fromRow = parseInt(m.from[1], 10);
        const isWhite = m.color === 'w';
        const advanced = isWhite ? (toRow - fromRow) : (fromRow - toRow);
        
        if (m.piece === 'p') {
          if (m.to[0] === 'd' || m.to[0] === 'e') {
            hScore += 40 + advanced * 5;
          } else {
            hScore += 20 + advanced * 5;
          }
        } else if (m.piece === 'n' || m.piece === 'b') {
          const isFromBackRank = isWhite ? fromRow === 1 : fromRow === 8;
          if (isFromBackRank) {
            hScore += 50;
          } else {
            hScore += 30;
          }
        } else if (m.piece === 'q') {
          hScore += 15;
        }

        return { move: m, hScore };
      });

      // Sort by heuristic score and take the top (count - 1) candidates
      rankedOther.sort((a, b) => b.hScore - a.hScore);
      const candidatesToQuery = rankedOther.slice(0, count - 1);

      // Evaluate them in parallel using Promise.all
      const candidatePromises = candidatesToQuery.map(async (item) => {
        const moveObj = item.move;
        const tempChess = new Chess(fen);
        const performedMove = tempChess.move({
          from: moveObj.from,
          to: moveObj.to,
          promotion: moveObj.promotion
        });

        if (!performedMove) return null;

        const nextFen = tempChess.fen();
        const nextEvalNode = await getEvaluation(nextFen, depth, 'high');
        if (!nextEvalNode) return null;

        const nextEvalStr = nextEvalNode.eval !== undefined ? String(nextEvalNode.eval) : '0';
        let candidateScoreNum = parseEvaluationScore(nextEvalStr);
        if (nextEvalNode.mate !== undefined && nextEvalNode.mate !== null) {
          const m = parseInt(String(nextEvalNode.mate), 10);
          candidateScoreNum = m > 0 ? (10000 - m) : (-10000 + Math.abs(m));
        }

        // Relative score for the active player
        const relativeScore = activeColor === 'w' ? candidateScoreNum : -candidateScoreNum;

        return {
          move: moveObj,
          lan: moveObj.from + moveObj.to + (moveObj.promotion || ''),
          san: performedMove.san,
          score: relativeScore
        };
      });

      const candidateResults = await Promise.all(candidatePromises);
      for (const res of candidateResults) {
        if (res) {
          pvs.push(res);
        }
      }
    }

    // Sort all PVs so that the best move for the active turn comes first
    pvs.sort((a, b) => b.score - a.score);

    return pvs.slice(0, count);
  } catch (err) {
    console.error("[getMultiPvLines] Error generating multi-PV:", err);
    return [];
  }
}

async function getBestMove(fen: string, moveTimeMs: number, elo: number = 1500, skillLevel?: number) {
  const depth = skillLevel !== undefined ? getDepthForSkillLevel(skillLevel) : getDepthForElo(elo);
  const blunderProb = skillLevel !== undefined ? getBlunderProbabilityForSkillLevel(skillLevel) : getBlunderProbability(elo);
  const triggerBlunder = Math.random() < blunderProb;

  if (triggerBlunder) {
    console.log(`[ELO ${elo} / Skill ${skillLevel}] Blunder triggered (probability: ${blunderProb.toFixed(2)})`);
    try {
      const chess = new Chess(fen);
      const moves = chess.moves({ verbose: true });
      if (moves.length > 0) {
        // Shuffle and pick a random legal move
        const shuffled = [...moves].sort(() => Math.random() - 0.5);
        const selected = shuffled[0];
        const lanMove = selected.lan || selected.from + selected.to + (selected.promotion || '');
        console.log(`[ELO ${elo} / Skill ${skillLevel}] Blunder chosen: ${lanMove}`);
        return lanMove;
      }
    } catch (e) {
      console.error("[ELO Blunder] Error picking random move:", e);
    }
  }

  // Get multi-PV lines to pick opponent moves
  try {
    let targetElo = elo;
    if (skillLevel !== undefined) {
      if (skillLevel <= 1) targetElo = 800;
      else if (skillLevel >= 20) targetElo = 3200;
      else targetElo = 800 + (skillLevel - 1) * 120;
    }

    console.log(`[ELO Simulation] targetElo: ${targetElo} / depth: ${depth}. Generating top 5 engine lines (Multi-PV)...`);
    const pvs = await getMultiPvLines(fen, depth, 5);

    if (pvs && pvs.length > 0) {
      // Determine probabilities based on target ELO
      let probs = [1.0, 0.0, 0.0, 0.0, 0.0];

      if (targetElo >= 2200) {
        probs = [0.95, 0.04, 0.01, 0.0, 0.0];
      } else if (targetElo >= 1800) {
        probs = [0.80, 0.15, 0.04, 0.01, 0.0];
      } else if (targetElo >= 1500) {
        probs = [0.60, 0.25, 0.10, 0.04, 0.01];
      } else if (targetElo >= 1200) {
        probs = [0.45, 0.25, 0.15, 0.10, 0.05];
      } else {
        // Beginner (< 1200 ELO)
        probs = [0.30, 0.25, 0.20, 0.15, 0.10];
      }

      // Normalize probabilities based on the number of actually available lines
      const availableCount = pvs.length;
      const rawProbs = probs.slice(0, availableCount);
      const sum = rawProbs.reduce((a, b) => a + b, 0);

      let finalProbs: number[] = [];
      if (sum > 0) {
        finalProbs = rawProbs.map(p => p / sum);
      } else {
        finalProbs = new Array(availableCount).fill(1 / availableCount);
      }

      // Select line based on final probability weights
      const rand = Math.random();
      let cumulative = 0;
      let selectedIndex = 0;
      for (let i = 0; i < finalProbs.length; i++) {
        cumulative += finalProbs[i];
        if (rand < cumulative) {
          selectedIndex = i;
          break;
        }
      }

      const chosenPv = pvs[selectedIndex];
      console.log(`[ELO Simulation] Chosen line rank: ${selectedIndex + 1}/${availableCount} (Prob: ${(finalProbs[selectedIndex] * 100).toFixed(1)}%). Selected move: ${chosenPv.lan} (Stockfish top was: ${pvs[0].lan})`);
      return chosenPv.lan;
    }
  } catch (err) {
    console.error("[ELO Simulation] Multi-PV selection failed, falling back to basic evaluation:", err);
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

function getSanFromLan(fen: string, lan: string): string {
  if (!lan) return '';
  try {
    const chess = new Chess(fen);
    const from = lan.substring(0, 2);
    const to = lan.substring(2, 4);
    const promotion = lan.length > 4 ? lan.substring(4, 5) : undefined;
    const move = chess.move({ from, to, promotion });
    if (move) {
      return move.san;
    }
  } catch (e) {
    // ignore
  }
  return lan;
}

async function getEvaluation(fen: string, depth: number = 8, priority: 'high' | 'low' = 'low') {
  const data = await apiQueue.enqueue(fen, depth, priority);
  if (data) {
    const move = data.move;
    let san = '';
    if (move) {
      san = getSanFromLan(fen, move);
    }
    return {
      eval: data.eval !== undefined ? data.eval : 0,
      mate: data.mate,
      move: move,
      san: san || data.san || move,
      continuationArr: data.continuationArr || []
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

function squareToCoords(square: string) {
  const f = square.charCodeAt(0) - 97; // 'a' = 97
  const r = parseInt(square.charAt(1), 10) - 1;
  return { f, r };
}

function coordsToSquare(f: number, r: number) {
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return String.fromCharCode(f + 97) + (r + 1);
}

function translateTheme(t: string): string {
  if (t === 'pin') return 'pin (связка)';
  if (t === 'fork') return 'fork (вилка)';
  if (t === 'skewer') return 'skewer (сквозной удар)';
  return t;
}

function detectTactics(fenBefore: string, moveFrom: string, moveTo: string): string[] {
  const themes: string[] = [];
  try {
    const chess = new Chess(fenBefore);
    const pieceObj = chess.get(moveFrom as any);
    if (!pieceObj) return themes;
    
    const color = pieceObj.color;
    const oppColor = color === 'w' ? 'b' : 'w';
    const pieceType = pieceObj.type; // 'p', 'n', 'b', 'r', 'q', 'k'

    const chessAfter = new Chess(fenBefore);
    const moveRes = chessAfter.move({ from: moveFrom, to: moveTo, promotion: 'q' });
    if (!moveRes) return themes;

    // Helper to get piece at (f, r)
    const getPieceAt = (f: number, r: number) => {
      const sq = coordsToSquare(f, r);
      if (!sq) return null;
      return chessAfter.get(sq as any);
    };

    const { f: toF, r: toR } = squareToCoords(moveTo);

    // 1. PIN and SKEWER detection
    if (pieceType === 'b' || pieceType === 'r' || pieceType === 'q') {
      const dirs: [number, number][] = [];
      if (pieceType === 'r' || pieceType === 'q') {
        dirs.push([0, 1], [0, -1], [1, 0], [-1, 0]);
      }
      if (pieceType === 'b' || pieceType === 'q') {
        dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
      }

      for (const [df, dr] of dirs) {
        let f = toF + df;
        let r = toR + dr;
        let p1: any = null;
        let p2: any = null;

        // Find first piece
        while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
          const p = getPieceAt(f, r);
          if (p) {
            p1 = p;
            break;
          }
          f += df;
          r += dr;
        }

        // If first piece is an opponent piece, continue to find second piece
        if (p1 && p1.color === oppColor) {
          f += df;
          r += dr;
          while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
            const p = getPieceAt(f, r);
            if (p) {
              p2 = p;
              break;
            }
            f += df;
            r += dr;
          }

          // If second piece is also an opponent piece
          if (p2 && p2.color === oppColor) {
            const val = (p: any) => {
              if (p.type === 'p') return 1;
              if (p.type === 'n' || p.type === 'b') return 3;
              if (p.type === 'r') return 5;
              if (p.type === 'q') return 9;
              if (p.type === 'k') return 1000;
              return 0;
            };

            const v1 = val(p1);
            const v2 = val(p2);

            if (v1 < v2 || p2.type === 'k') {
              themes.push('pin');
            } else if (v1 > v2 && p1.type !== 'k') {
              themes.push('skewer');
            }
          }
        }
      }
    }

    // 2. FORK detection
    const attackedPieces: string[] = [];

    if (pieceType === 'n') {
      const knightOffsets = [
        [1, 2], [1, -2], [-1, 2], [-1, -2],
        [2, 1], [2, -1], [-2, 1], [-2, -1]
      ];
      for (const [df, dr] of knightOffsets) {
        const p = getPieceAt(toF + df, toR + dr);
        if (p && p.color === oppColor) {
          attackedPieces.push(p.type);
        }
      }
    } else if (pieceType === 'p') {
      const dy = color === 'w' ? 1 : -1;
      for (const df of [-1, 1]) {
        const p = getPieceAt(toF + df, toR + dy);
        if (p && p.color === oppColor) {
          attackedPieces.push(p.type);
        }
      }
    } else if (pieceType === 'b' || pieceType === 'r' || pieceType === 'q') {
      const dirs: [number, number][] = [];
      if (pieceType === 'r' || pieceType === 'q') {
        dirs.push([0, 1], [0, -1], [1, 0], [-1, 0]);
      }
      if (pieceType === 'b' || pieceType === 'q') {
        dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
      }

      for (const [df, dr] of dirs) {
        let f = toF + df;
        let r = toR + dr;
        while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
          const p = getPieceAt(f, r);
          if (p) {
            if (p.color === oppColor) {
              attackedPieces.push(p.type);
            }
            break;
          }
          f += df;
          r += dr;
        }
      }
    }

    const valuableAttacks = attackedPieces.filter(t => t !== 'p' || pieceType === 'n' || pieceType === 'b' || pieceType === 'r' || pieceType === 'q');
    if (attackedPieces.length >= 2 && (valuableAttacks.length >= 2 || attackedPieces.some(t => t === 'k' || t === 'q' || t === 'r'))) {
      themes.push('fork');
    }

  } catch (err) {
    console.error("Error in detectTactics:", err);
  }
  
  return Array.from(new Set(themes));
}

function findPlayedMove(fenBefore: string, fenAfter: string): { from: string; to: string; san: string } | null {
  try {
    const chess = new Chess(fenBefore);
    const moves = chess.moves({ verbose: true });
    const targetBoard = fenAfter.split(' ')[0];
    
    for (const m of moves) {
      const testChess = new Chess(fenBefore);
      const res = testChess.move(m);
      if (res && testChess.fen().split(' ')[0] === targetBoard) {
        return {
          from: m.from,
          to: m.to,
          san: m.san
        };
      }
    }
  } catch (e) {
    console.error("Error in findPlayedMove:", e);
  }
  return null;
}

async function generateAiContent(prompt: string): Promise<string> {
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro'];
  for (const model of models) {
    try {
      console.log(`[AI] Attempting generation with model: ${model}...`);
      const response = await getAiClient().models.generateContent({
        model,
        contents: prompt,
      });
      const text = response.text;
      if (text && text.trim().length > 0) {
        console.log(`[AI] Generation successful with model: ${model}`);
        return text;
      }
    } catch (err: any) {
      console.error(`[AI] Model ${model} failed:`, err.message || err);
    }
  }
  throw new Error("All Gemini models failed or are out of quota.");
}

async function getFullGameExplanation(
  pgn: string, 
  evaluationsJson: string, 
  elo: number = 1500,
  fens: string[] = [],
  engineEvals: any[] = [],
  lang: string = 'ru'
) {
  try {
    const evaluations: string[] = JSON.parse(evaluationsJson);
    const totalPlies = evaluations.length - 1;

    // Pre-calculate critical shifts
    const shifts: { ply: number; drop: number; evalBefore: string; evalAfter: string; importance: number }[] = [];
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
        const activePlayerScoreBefore = (i % 2 === 0) ? evalBefore : -evalBefore;
        let weight = 1.0;
        if (activePlayerScoreBefore < -1.0) {
          // If the player was already significantly losing, subsequent blunders are less important
          weight = Math.max(0.05, 1.0 - 0.22 * (Math.abs(activePlayerScoreBefore) - 1.0));
        }
        const importance = drop * weight;
        shifts.push({ ply: i, drop, evalBefore: evalBeforeStr, evalAfter: evalAfterStr, importance });
      }
    }

    // Sort by largest importance score and take top 5
    shifts.sort((a, b) => b.importance - a.importance);
    const topShifts = shifts.slice(0, 5);
    // Sort chronologically
    topShifts.sort((a, b) => a.ply - b.ply);

    const isEn = lang === 'en';
    let criticalMomentsText = isEn 
      ? "The engine identified the following critical mistakes/blunders and recommended the best moves:\n"
      : "The engine identified the following critical mistakes/blunders and recommended the best moves:\n"; // AI parses this internally, so English is perfect

    if (topShifts.length === 0) {
      criticalMomentsText += isEn 
        ? "- No major blunders detected. A very solid game!\n"
        : "- No major blunders detected. A very solid game!\n";
    } else {
      topShifts.forEach(shift => {
        const side = shift.ply % 2 === 0 ? "White" : "Black";
        const moveNum = Math.floor(shift.ply / 2) + 1;
        
        let engineSuggestion = "N/A";
        if (engineEvals && engineEvals[shift.ply]) {
          const node = engineEvals[shift.ply];
          if (node.san) {
            engineSuggestion = node.san;
          } else if (node.move) {
            engineSuggestion = getSanFromLan(fens[shift.ply], node.move);
          }
        }

        // Detect tactics for the move actually played
        let playedThemes: string[] = [];
        let playedSan = "";
        if (fens[shift.ply] && fens[shift.ply + 1]) {
          const played = findPlayedMove(fens[shift.ply], fens[shift.ply + 1]);
          if (played) {
            playedSan = played.san;
            playedThemes = detectTactics(fens[shift.ply], played.from, played.to);
          }
        }

        // Detect tactics for the engine's recommended move
        let recThemes: string[] = [];
        if (engineEvals && engineEvals[shift.ply]) {
          const node = engineEvals[shift.ply];
          const recMoveLan = node.move;
          if (recMoveLan && recMoveLan.length >= 4) {
            recThemes = detectTactics(fens[shift.ply], recMoveLan.substring(0, 2), recMoveLan.substring(2, 4));
          }
        }

        let tacticsText = "";
        if (playedThemes.length > 0) {
          tacticsText += ` [Played Move Tactical Themes: ${playedThemes.map(translateTheme).join(', ')}]`;
        }
        if (recThemes.length > 0) {
          tacticsText += ` [Recommended Move Tactical Themes: ${recThemes.map(translateTheme).join(', ')}]`;
        }
        
        criticalMomentsText += `- Ply index ${shift.ply} (Move ${moveNum} for ${side}): Played move is ${playedSan || 'N/A'}. Evaluation shifted from ${shift.evalBefore} to ${shift.evalAfter}.${tacticsText} The engine's recommended best move in this position was ${engineSuggestion}.\n`;
      });
    }

    // Prepare final move analysis text
    const finalPly = totalPlies - 1; // index of the last move played
    let finalMoveText = "None";
    if (finalPly >= 0) {
      const side = finalPly % 2 === 0 ? "White" : "Black";
      const moveNum = Math.floor(finalPly / 2) + 1;
      const evalBeforeStr = evaluations[finalPly];
      const evalAfterStr = evaluations[finalPly + 1];
      
      let engineSuggestion = "N/A";
      if (engineEvals && engineEvals[finalPly]) {
        const node = engineEvals[finalPly];
        if (node.san) {
          engineSuggestion = node.san;
        } else if (node.move) {
          engineSuggestion = getSanFromLan(fens[finalPly], node.move);
        }
      }

      // Detect tactics for the final move actually played
      let finalPlayedThemes: string[] = [];
      let finalPlayedSan = "";
      if (fens[finalPly] && fens[finalPly + 1]) {
        const played = findPlayedMove(fens[finalPly], fens[finalPly + 1]);
        if (played) {
          finalPlayedSan = played.san;
          finalPlayedThemes = detectTactics(fens[finalPly], played.from, played.to);
        }
      }

      // Detect tactics for the final recommended move
      let finalRecThemes: string[] = [];
      if (engineEvals && engineEvals[finalPly]) {
        const node = engineEvals[finalPly];
        const recMoveLan = node.move;
        if (recMoveLan && recMoveLan.length >= 4) {
          finalRecThemes = detectTactics(fens[finalPly], recMoveLan.substring(0, 2), recMoveLan.substring(2, 4));
        }
      }

      let finalTacticsText = "";
      if (finalPlayedThemes.length > 0) {
        finalTacticsText += ` [Played Move Tactical Themes: ${finalPlayedThemes.map(translateTheme).join(', ')}]`;
      }
      if (finalRecThemes.length > 0) {
        finalTacticsText += ` [Recommended Move Tactical Themes: ${finalRecThemes.map(translateTheme).join(', ')}]`;
      }
      
      finalMoveText = `Ply index ${finalPly} (Move ${moveNum} for ${side}): Played move is ${finalPlayedSan || 'N/A'}. Evaluation shifted from ${evalBeforeStr} to ${evalAfterStr}.${finalTacticsText} Engine's recommended best move was: ${engineSuggestion}.`;
    }

    let coachInstructions = "";
    if (isEn) {
      if (elo < 1200) {
        coachInstructions = `
You are analyzing a beginner/low-rated player's game (~${elo} ELO).
- Explain recommendations in VERY simple, accessible language. Do not overload with jargon.
- Focus on basic piece safety (blunders, direct capture threats, double attacks, mates in 1-2 moves).
- MUST explicitly highlight tactical themes like **Pin** or **Fork** in bold.
- Do not mention complex strategic ideas like "minority attack" or "fine pawn structures".
- Explain why a move is bad in terms of material losses ("this move drops a rook", "loses a bishop").
- Speak in a friendly, supportive, and encouraging tone, like a patient teacher.
- MUST format moves as clickable links: played moves as [MoveNumber. Move](#move-plyIndex), and alternative moves as [Move](#alt-plyIndex-san) with the SAME plyIndex. E.g., "[15. Nxe4](#move-28)" or "[d4](#alt-28-d4)".
`;
      } else if (elo < 1800) {
        coachInstructions = `
You are analyzing an intermediate player's game (~${elo} ELO).
- Explain standard tactical motifs (pins, forks, skewers, deflections, discovered checks) and basic positional concepts (open file control, pawn weaknesses, outposts, piece activity).
- MUST explicitly highlight tactical themes like **Pin**, **Fork**, or **Skewer** in bold.
- Standard chess terminology is fine (fianchetto, tempo, outpost, castling).
- Assess moves in terms of piece coordination, 2-3 moves ahead planning, and king safety.
- Keep the tone analytical, professional, and educational.
- MUST format moves as clickable links: played moves as [MoveNumber. Move](#move-plyIndex), and alternative moves as [Move](#alt-plyIndex-san) with the SAME plyIndex.
`;
      } else {
        coachInstructions = `
You are analyzing an experienced/expert player's game (~${elo} ELO).
- Speak on a professional grandmaster level. Exclude simple tactical or strategic explanations.
- MUST explicitly highlight advanced tactical themes like **Pin**, **Fork**, or **Skewer** in bold.
- Focus on deep positional nuances, strategic plans, endgame subtleties, tactical overloads, and opening theory.
- Actively use advanced chess terminology.
- Keep the tone highly analytical, direct, and concise.
- MUST format moves as clickable links: played moves as [MoveNumber. Move](#move-plyIndex), and alternative moves as [Move](#alt-plyIndex-san) with the SAME plyIndex.
`;
      }
    } else {
      if (elo < 1200) {
        coachInstructions = `
Вы анализируете игру новичка или слабого игрока (рейтинг ~${elo}).
- Стройте рекомендации и объяснения на ОЧЕНЬ простом и доступном языке. Не перегружайте терминами.
- Сосредоточьтесь на базовой безопасности фигур (зевки, прямые угрозы взятия, двойные удары, маты в 1-2 хода).
- ОБЯЗАТЕЛЬНО явно находите и маркируйте тактические темы, такие как **Связка** (Pin) или **Вилка** (Fork), если они упомянуты в тактических темах.
- Не говорите про сложные стратегические идеи (типа "борьба за поля", "миноритарная атака", "тонкая пешечная структура").
- Объясняйте, почему ход плохой, на языке материальных потерь ("этот ход отдает ладью", "теряется слон").
- Общайтесь максимально дружелюбно, поддерживающе и ободряюще, как терпеливый учитель.
- ОБЯЗАТЕЛЬНО оформляйте ходы из партии в виде ссылок [НомерХода. Ход](#move-plyIndex), а альтернативные ходы — в виде [Ход](#alt-plyIndex-san) с ТЕМ ЖЕ plyIndex. Например: "[15. Nxe4](#move-28)" или "[d4](#alt-28-d4)". Без этого ссылки не будут работать!
`;
      } else if (elo < 1800) {
        coachInstructions = `
Вы анализируете игру игрока среднего уровня (рейтинг ~${elo}).
- Объясняйте стандартные тактические мотивы (связки, вилки, отвлечения, открытые шахи) и базовые позиционные концепции (контроль открытых линий, пешечные слабости, форпосты, активность фигур).
- ОБЯЗАТЕЛЬНО явно находите и маркируйте тактические темы, такие как **Связка** (Pin), **Вилка** (Fork) или **Сквозной удар** (Skewer), используя жирный шрифт, если они упомянуты в тактических темах.
- Можно использовать стандартную шахматную терминологию (фианкетто, темп, форпост, рокировка).
- Оценивайте ходы с точки зрения координации фигур, планов игры на 2-3 хода вперед и безопасности короля.
- Тон должен быть аналитическим, профессиональным и обучающим.
- ОБЯЗАТЕЛЬНО оформляйте ходы из партии в виде ссылок [НомерХода. Ход](#move-plyIndex), а альтернативные ходы — в виде [Ход](#alt-plyIndex-san) с ТЕМ ЖЕ plyIndex. Например: "[15. Nxe4](#move-28)" или "[d4](#alt-28-d4)". Без этого ссылки не будут работать!
`;
      } else {
        coachInstructions = `
Вы анализируете игру опытного игрока/эксперта (рейтинг ~${elo}).
- Общайтесь на профессиональном гроссмейстерском уровне. Полностью исключите банальные, очевидные тактические или стратегические объяснения.
- ОБЯЗАТЕЛЬНО явно находите и маркируйте продвинутые тактические темы, такие как **Связка** (Pin), **Вилка** (Fork) или **Сквозной удар** (Skewer), используя жирный шрифт, если они упомянуты в тактических темах.
- Сосредоточьтесь на глубоких позиционных нюансах, стратегических планах, тонкостях эндшпиля, сложных тактических перегрузках и дебютной теории.
- Активно используйте продвинутую шахматную терминологию.
- Тон должен быть исключительно аналитическим, прямым и лаконичным, как при разборе партии между равными сильными игроками.
- ОБЯЗАТЕЛЬНО оформляйте ходы из партии в виде ссылок [НомерХода. Ход](#move-plyIndex), а альтернативные ходы — в виде [Ход](#alt-plyIndex-san) с ТЕМ ЖЕ plyIndex. Например: "[15. Nxe4](#move-28)" или "[d4](#alt-28-d4)". Без этого ссылки не будут работать!
`;
      }
    }

    const prompt = isEn ? `You are an expert chess coach. Your task is to analyze the following chess game using the provided PGN and a pre-calculated list of critical mistakes.
You must return a highly structured, accurate, and professional chess analysis in English. Your analysis must be strictly evaluation-driven, treating the engine's numerical scores as the absolute source of truth.

### STRICT STRUCTURE & SOURCE OF TRUTH (MANDATORY):
1. **NUMERICAL EVALUATIONS AS COMPASS**: Every explanation in the "Key Moments" section must directly stem from the Stockfish evaluation change (centipawn loss / mate).
   - For example, if the evaluation changed from +1.5 to -2.0, point out this drop (3.5 pawns difference).
   - Explain this drop in clear, human language: "blundered a piece / material", "missed tactical opportunity to win material", "weakened king safety", "lost control of key square".
   - **PRIORITIZE CRITICAL SHIFTS (MANDATORY)**: Focus on critical moments where the evaluation made the largest leap. Pay special attention to moves that shifted the game (e.g. from equal ~0.0 to losing ~-3.0). The initial mistakes that lost equality or advantage are THE MOST IMPORTANT and should be commented on first. Avoid focusing only on late blunders in a completely lost position.
2. **NO HALLUCINATIONS**:
   - Do not make up coordinates or pieces that are not in the description. Be precise.
   - Only describe things in terms of the played move (e.g., "The move [15. Nxe4]...") and the recommended best move (e.g., "...instead, d4 was better").
3. **SIMPLE GAME END DESCRIPTION**:
   - If the game ended in checkmate or forced mate (evaluation became Mate), do not describe the coordinates of the mate to prevent errors. Simply write: "The game ended in checkmate" or "A blunder was made leading to forced checkmate in X moves."

### TACTICAL THEMES & TEMPLATES (MANDATORY):
- Highlight tactics like **Pin**, **Fork**, or **Skewer** in bold.
- Explain clearly how they occurred (e.g., "this move pinned our rook to the king", "you blundered a knight fork", "the recommended move delivered a skewer").

### COACH INSTRUCTIONS (ELO SPECIFIC):
${coachInstructions}

### INPUT DATA:
1. PGN: ${pgn}
2. Critical Engine Shifts and Recommended Moves:
${criticalMomentsText}
3. Last/Final Move of the Game:
${finalMoveText}

### ANALYSIS RULES (MANDATORY):
- Analyze and explain all the critical engine shifts listed above (up to 4-5 key moments).
- **NEVER invent alternative moves yourself!** Use ONLY the recommended moves from Stockfish.
- Clickable links MUST be formatted strictly: played move as [MoveNumber. Move](#move-plyIndex), and alternative best move as [Move](#alt-plyIndex-san) with the EXACT SAME plyIndex.

### OUTPUT STRUCTURE (MANDATORY HEADINGS IN ENGLISH):
You MUST structure your response with these exact markdown headings:

### 📊 General Game Overview
Provide a 2-3 sentence summary of the game.

### 🔑 Key Moments
Analyze the key moments from the shifts listed above, starting with the most important shifts. Explain why the played move is bad and why the engine alternative is better. Use clickable links.

### 💡 Coach's Advice
Provide exactly 1 short actionable coaching tip.

### STYLE & FORMATTING RULES:
- Use Markdown. Use bold and lists.
- Tone: Analytical, brief, encouraging.
- LANGUAGE: Answer ONLY in English.
- DO NOT print any preamble or internal thoughts. Just start directly with the first heading.` : `You are an expert chess coach. Your task is to analyze the following chess game using the provided PGN and a pre-calculated list of critical mistakes.
You must return a highly structured, accurate, and professional chess analysis in Russian. Your analysis must be strictly evaluation-driven, treating the engine's numerical scores as the absolute source of truth.

### ЖЕСТКАЯ СТРУКТУРА И ИСТОЧНИК ПРАВДЫ (ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ):
1. **ЧИСЛЕННЫЕ ОЦЕНКИ — ГЛАВНЫЙ ОРИЕНТИР**: Каждое объяснение в разделе "Ключевые моменты" должно прямо отталкиваться от численного изменения оценки Stockfish (centipawn loss / mate).
   - Например, если оценка изменилась с +1.5 до -2.0, укажите это падение (разница в 3.5 пешки).
   - Объясните это падение понятным человеческим языком: "зевок фигуры / материала", "упущенная тактическая возможность выиграть материал", "ослабление безопасности короля", "потеря ключевого поля".
   - **ПРИОРИТЕТ КЛЮЧЕВЫМ ПЕРЕЛОМАМ (ОБЯЗАТЕЛЬНО)**: Фокусируйте анализ на критических моментах, в которых оценка совершила самый сильный скачок (наибольшее изменение centipawn loss). Особое внимание уделяйте ходам, которые переломили ход игры (например, сместили оценку от полного равенства ~0.0 в сторону проигрыша ~-3.0). Первые ошибки, упустившие равенство или перевес, ЯВЛЯЮТСЯ САМЫМИ ВАЖНЫМИ и должны быть прокомментированы в первую очередь. Избегайте концентрирования внимания только на поздних зевках в безнадежной позиции (например, переход оценки с -4.0 до -7.0 вторичен по сравнению с первоначальной ключевой ошибкой с 0.0 до -3.0).
2. **ЗАПРЕТ НА ГАЛЛЮЦИНАЦИИ И ФАНТАЗИИ**:
   - Строго запрещено придумывать или домысливать позиции фигур на доске, которых нет в тексте ходов!
   - Не придумывайте координаты клеток (например, f7, h8, c5), если они не указаны в самом ходе или в рекомендованном лучшем ходе Stockfish.
   - Описывайте события на доске только в рамках сыгранного хода (например: "Ход [15. Nxe4]...") и рекомендованного лучшего хода (например: "...вместо этого следовало играть [d4]...").
3. **ПРОСТОЕ И ТОЧНОЕ ОПИСАНИЕ ОКОНЧАНИЯ ИГРЫ**:
   - Если игра завершилась матом или неизбежным матом в несколько ходов (оценка перешла в Mate), НЕ расписывайте подробно, какими фигурами и по каким полям ставился мат, чтобы исключить ошибки в координатах. Достаточно написать простую констатацию: "Игра завершилась матом" или "Допущен зевок, ведущий к неизбежному мату в X ходов".

### ТАКТИЧЕСКИЕ ТЕМЫ И ШАБЛОНЫ (ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ):
- Если для хода указаны тактические темы (например, "pin (связка)", "fork (вилка)", "skewer (сквозной удар)"), вы ДОЛЖНЫ использовать их в своем анализе.
- Явно выделяйте их жирным шрифтом на русском: **Связка** (Pin), **Вилка** (Fork), **Сквозной удар** (Skewer).
- Дайте понятное объяснение, как именно эта тема проявилась (например: "этот ход привел к **Связке** нашей ладьи к королю", "вы зевнули **Вилку** коня на короля и ферзя" или "рекомендованный ход совершал коварный **Сквозной удар** по тяжелым фигурам").

### ИНСТРУКЦИЯ ДЛЯ ТРЕНЕРА (ВАЖНО! СТРОЙТЕ ОБЪЯСНЕНИЯ ИСХОДЯ ИЗ РЕЙТИНГА ИГРОКА):
${coachInstructions}

### INPUT DATA:
1. PGN: ${pgn}
2. Critical Engine Shifts and Recommended Moves:
${criticalMomentsText}
3. Last/Final Move of the Game:
${finalMoveText}

### ANALYSIS RULES (MANDATORY):
- Analyze and explain all the critical engine shifts listed above (up to 4-5 key moments).
- **NEVER invent alternative moves yourself!** You MUST use ONLY the engine's recommended best moves specified in the Critical Engine Shifts list (e.g., if the engine says the best move is Nf3, only recommend Nf3). This prevents recommending blunders or illegal moves.
- For each key moment you discuss, you MUST format the clickable links as:
  1. State the actual move played in the game using the format: [MoveNumber. Move](#move-plyIndex).
     * Example: If White's 15th move is Nxe4 and its ply index is 28, write: "[15. Nxe4](#move-28)".
  2. Suggest the engine's alternative best move and format it exactly as: [Move](#alt-plyIndex-san) using the EXACT SAME plyIndex as the original move.
     * Example: If the original move is at '#move-28' and the recommended alternative is d4, the alternative link MUST be "[d4](#alt-28-d4)". Never use a different plyIndex for the alternative!

### КРИТИЧЕСКАЯ САМОПРОВЕРКА И ПРЕДОТВРАЩЕНИЕ ОШИБОК С ИМЕНАМИ ФИГУР (ОБЯЗАТЕЛЬНО ДЛЯ ВЫПОЛНЕНИЯ):
Пожалуйста, перед выводом текста выполните внутренний аудит вашего ответа:
1. **БЕЗОШИБОЧНЫЙ ПЕРЕВОД БУКВ ФИГУР НА РУССКИЙ ЯЗЫК**:
   В шахматной нотации буквы фигур переводятся строго следующим образом:
   - "Q" (Queen) — это всегда ФЕРЗЬ! Никогда не называйте ферзя "ладьей", "слоном" или "королевой". Например, ход Qc2 — это ход ФЕРЗЕМ на c2, а не ладьей!
   - "R" (Rook) — это всегда ЛАДЬЯ! Никогда не называйте ладью "ферзем" или "замком".
   - "B" (Bishop) — это всегда СЛОН! Никогда не называйте слона "офицером", "конем" или "ладьей".
   - "N" (Knight) — это всегда КОНЬ! Никогда не называйте коня "рыцарем" или "слоном".
   - "K" (King) — это всегда КОРОЛЬ!
   Если вы обсуждаете ход фигурой, обязательно посмотрите на букву в PGN/нотации. Если там стоит Q, напишите слово "Ферзь" в русском тексте! Если вы перепутаете ферзя и ладью, это уничтожит ценность анализа!
2. **ПРОВЕРКА ИНДЕКСА В ССЫЛКАХ**: Убедитесь, что для оригинального хода в '#move-X' альтернативный ход в '#alt-Y-move' имеет ровно тот же индекс, т.е. Y = X. Например, для move-28 альтернатива должна быть alt-28-d4.

### OUTPUT STRUCTURE (MANDATORY HEADINGS IN RUSSIAN):
You MUST structure your response with these exact markdown headings:

### 📊 Общий обзор партии
Provide a 2-3 sentence summary of the game.

### 🔑 Ключевые моменты
В первую очередь перечислите и подробно проанализируйте ключевые переломные моменты партии с наибольшим изменением оценки (centipawn loss), особенно те, которые увели позицию от равенства (около 0.0) к поражению (отыщите первый критический промах, определивший исход партии). Только после этого можно кратко упомянуть финальный зевок или упущенную возможность последнего хода. Обязательно используйте кликабельные ссылки. Объясняйте, почему сыгранный ход плох (с указанием точного падения оценки) и почему альтернатива от движка лучше.

### 💡 Совет тренера
Provide exactly 1 short actionable coaching tip.

### STYLE & FORMATTING RULES:
- Use Markdown. Use bold and lists.
- Tone: Analytical, brief, encouraging.
- LANGUAGE: Answer ONLY in Russian.
- DO NOT print any preamble or internal thoughts. Just start directly with the first heading.`;

    console.log(`[AI] Querying Gemini API (with fallback models) in ${isEn ? 'EN' : 'RU'}...`);
    try {
      const text = await generateAiContent(prompt);
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch (geminiErr) {
      console.error("[AI] All Gemini models failed in getFullGameExplanation:", geminiErr);
    }
  } catch (e) {
    console.error("getFullGameExplanation total error:", e);
  }

  return lang === 'en' 
    ? "An error occurred while generating the AI coach analysis. Please try again later."
    : "Произошла ошибка при получении анализа от ИИ-тренера. Попробуйте позже.";
}

wss.on('connection', (ws) => {
  ws.on('message', async (message: Buffer) => {
    try {
      const payload = JSON.parse(message.toString());
      const type = payload.type || '';
      
      if (type === 'ENGINE_MOVE' || type === 'REQUEST_MOVE') {
        const fen = payload.fen;
        const difficulty = payload.difficulty || 1500;
        const skillLevel = payload.skillLevel;
        const bestMove = await getBestMove(fen, 1000, difficulty, skillLevel);
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
        const lang = payload.lang || 'ru';
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

        console.log(`[AI] Generating full game analysis in ${lang}...`);
        const aiText = await getFullGameExplanation(
          pgn,
          JSON.stringify(formattedEvals),
          elo,
          fens,
          evaluations,
          lang
        );
        
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

app.post('/api/chess/explain-move', async (req, res) => {
  try {
    const {
      moveIndex,
      playedMove,
      recommendedMove,
      evalBefore,
      evalAfter,
      elo,
      lang
    } = req.body;

    const parseEval = (e: any) => {
      if (!e) return '0.00';
      if (e.mate !== undefined && e.mate !== null) {
        return `M${e.mate}`;
      }
      return typeof e === 'object' && e.eval !== undefined ? e.eval : e;
    };

    const formattedEvalBefore = parseEval(evalBefore);
    const formattedEvalAfter = parseEval(evalAfter);

    const isEn = lang === 'en';
    let coachInstructions = "";
    
    if (isEn) {
      if (elo < 1200) {
        coachInstructions = `The player is a beginner (~${elo} ELO). Explain in VERY simple language, without complex jargon. Focus on piece safety (blunders, material losses). Use bold text for key themes.`;
      } else if (elo < 1800) {
        coachInstructions = `The player is an intermediate level (~${elo} ELO). Explain tactical motifs (pins, forks, skewers, deflections, activity) and basic positional ideas.`;
      } else {
        coachInstructions = `The player is an advanced level (~${elo} ELO). Use professional chess terminology, deep positional nuances, and strategic plans.`;
      }
    } else {
      if (elo < 1200) {
        coachInstructions = `Игрок - новичок (~${elo} ELO). Объясняйте на ОЧЕНЬ простом языке, без сложных терминов. Сосредоточьтесь на безопасности фигур (зевки, материальные потери). Используйте жирный шрифт для ключевых тем.`;
      } else if (elo < 1800) {
        coachInstructions = `Игрок среднего уровня (~${elo} ELO). Объясняйте тактические мотивы (связки, вилки, отвлечения, активность) и базовые позиционные идеи.`;
      } else {
        coachInstructions = `Игрок высокого уровня (~${elo} ELO). Используйте профессиональную шахматную терминологию, глубокие позиционные нюансы, стратегические планы.`;
      }
    }

    const prompt = isEn ? `You are a professional chess coach. Explain why the played move is a mistake and why the recommended move is better.
Player level: ${coachInstructions}

Context:
- Game move: ${playedMove}
- Evaluation BEFORE this move: ${formattedEvalBefore}
- Evaluation AFTER this move: ${formattedEvalAfter} (the engine considers this move an error/blunder)
- Recommended best move from engine: ${recommendedMove}

Rules:
1. Give a short (2-3 sentences), highly concise and professional explanation in English.
2. Explain the reason for the evaluation drop (e.g., loss of tempo, missed tactical strike, weakening of the king, blundered piece).
3. Use bold font to highlight tactical motifs, such as **Pin**, **Fork**, **Skewer**, if applicable.
4. Format clickable links strictly: played move as [MoveNumber. Move](#move-${moveIndex}), and alternative best move as [Move](#alt-${moveIndex}-${recommendedMove}). For example: "The played move [12. Nf3](#move-${moveIndex}) misses an advantage, while [d4](#alt-${moveIndex}-d4) would allow..."
5. Never invent coordinates or pieces that are not in the description. Be precise.

Write only the explanation, with no intro phrases.` : `Вы — профессиональный шахматный тренер. Объясните, почему сыгранный ход является ошибкой и почему рекомендованный ход лучше.
Уровень игрока: ${coachInstructions}

Контекст:
- Ход из партии: ${playedMove}
- Оценка позиции ДО этого хода: ${formattedEvalBefore}
- Оценка позиции ПОСЛЕ этого хода: ${formattedEvalAfter} (движок считает этот ход ошибкой/зевком)
- Рекомендуемый лучший ход от движка: ${recommendedMove}

Правила:
1. Дайте короткое (2-3 предложения), максимально емкое и профессиональное объяснение на русском языке.
2. Объясните причину падения оценки (например, потеря темпа, упущенный тактический удар, ослабление короля, зевок фигуры).
3. Используйте жирный шрифт для выделения тактических мотивов, таких как **Связка** (Pin), **Вилка** (Fork), **Сквозной удар** (Skewer), если они применимы.
4. Оформляйте ссылки на ходы строго: сыгранный ход как [НомерХода. Ход](#move-${moveIndex}), а альтернативный лучший ход как [Ход](#alt-${moveIndex}-${recommendedMove}). Например: "Сыгранный ход [12. Nf3](#move-${moveIndex}) упускает преимущество, тогда как [d4](#alt-${moveIndex}-d4) позволял..."
5. Никогда не придумывайте координаты клеток или фигуры, которых нет в описании. Будьте точны.

Напишите только объяснение, без вводных фраз.`;

    console.log(`[AI Explain] Generating explanation for move index ${moveIndex} in ${isEn ? 'EN' : 'RU'}`);
    
    let explanationText = "";

    try {
      console.log("[AI Explain] Querying Gemini SDK (with fallback models)...");
      explanationText = await generateAiContent(prompt);
    } catch (geminiErr) {
      console.error("[AI Explain] All Gemini models failed:", geminiErr);
    }

    res.json({ explanation: explanationText || (isEn ? "Failed to generate explanation from AI." : "Не удалось сгенерировать объяснение от ИИ.") });
  } catch (e) {
    console.error("Explain move error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/api/chess/pvs', async (req, res) => {
  try {
    const { fen, depth = 8 } = req.body;
    if (!fen) {
      res.status(400).json({ error: 'Missing FEN' });
      return;
    }

    const chess = new Chess(fen);
    const activeColor = chess.turn();

    // 1. Get the absolute best move from the current FEN
    const bestMoveNode = await getEvaluation(fen, depth);
    if (!bestMoveNode) {
      res.json({ pvs: [] });
      return;
    }

    const pvs: any[] = [];
    
    // Add the 1st PV (best move)
    pvs.push({
      move: bestMoveNode.san,
      lan: bestMoveNode.move,
      eval: bestMoveNode.eval,
      mate: bestMoveNode.mate,
      continuation: bestMoveNode.continuationArr || []
    });

    // 2. Generate other legal moves
    const legalMoves = chess.moves({ verbose: true });
    const bestMoveLan = bestMoveNode.move; // 'e2e4'

    const otherMoves = legalMoves.filter(m => {
      const lan = m.from + m.to + (m.promotion || '');
      return lan !== bestMoveLan;
    });

    if (otherMoves.length > 0) {
      const pieceValues: { [key: string]: number } = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

      // Rank other moves using MVV-LVA and heuristics
      const scoredMoves = otherMoves.map(m => {
        let score = 0;
        
        if (m.captured) {
          const victimValue = pieceValues[m.captured] || 1;
          const attackerValue = pieceValues[m.piece] || 1;
          score += 100 + victimValue - (attackerValue / 100);
        }

        if (m.san.includes('O-O')) {
          score += 90;
        }

        if (m.san.includes('+')) {
          score += 85;
        }

        const toRow = parseInt(m.to[1], 10);
        const fromRow = parseInt(m.from[1], 10);
        const isWhite = m.color === 'w';
        const advanced = isWhite ? (toRow - fromRow) : (fromRow - toRow);
        
        if (m.piece === 'p') {
          if (m.to[0] === 'd' || m.to[0] === 'e') {
            score += 40 + advanced * 5;
          } else {
            score += 20 + advanced * 5;
          }
        } else if (m.piece === 'n' || m.piece === 'b') {
          const isFromBackRank = isWhite ? fromRow === 1 : fromRow === 8;
          if (isFromBackRank) {
            score += 50;
          } else {
            score += 30;
          }
        } else if (m.piece === 'q') {
          score += 15;
        }

        return { move: m, score };
      });

      scoredMoves.sort((a, b) => b.score - a.score);

      const candidates = scoredMoves.slice(0, 2);

      const candidatePromises = candidates.map(async (item) => {
        const moveObj = item.move;
        const tempChess = new Chess(fen);
        const performedMove = tempChess.move({
          from: moveObj.from,
          to: moveObj.to,
          promotion: moveObj.promotion
        });

        if (!performedMove) return null;

        const nextFen = tempChess.fen();
        const nextEvalNode = await getEvaluation(nextFen, depth);
        if (!nextEvalNode) return null;

        const candidateContinuation = [nextEvalNode.san, ...(nextEvalNode.continuationArr || [])];

        return {
          move: performedMove.san,
          lan: performedMove.from + performedMove.to + (performedMove.promotion || ''),
          eval: nextEvalNode.eval,
          mate: nextEvalNode.mate,
          continuation: candidateContinuation
        };
      });

      const candidateResults = await Promise.all(candidatePromises);
      for (const res of candidateResults) {
        if (res) {
          pvs.push(res);
        }
      }
    }

    pvs.sort((a, b) => {
      const getVal = (x: any) => {
        if (x.mate !== undefined && x.mate !== null) {
          const m = parseInt(x.mate, 10);
          return m > 0 ? (10000 - m) : (-10000 + Math.abs(m));
        }
        return parseFloat(x.eval || 0);
      };

      const valA = getVal(a);
      const valB = getVal(b);

      return activeColor === 'w' ? (valB - valA) : (valA - valB);
    });

    res.json({ pvs: pvs.slice(0, 3) });
    return;
  } catch (error: any) {
    console.error('[PVs Endpoint] Error:', error);
    res.status(500).json({ error: error.message });
    return;
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
