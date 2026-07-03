import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { getWebSocketUrl } from '../utils/config';

interface GameProps {
  settings: {
    difficulty: number;
    side: 'white' | 'black';
    timeControl: string;
  };
  onGoBack: () => void;
  onAnalyze: (history: any[]) => void;
}

export const Game: React.FC<GameProps> = ({ settings, onGoBack, onAnalyze }) => {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState<any[]>([]);
  const ws = useRef<WebSocket | null>(null);

  // Customization state
  const [boardTheme, setBoardTheme] = useState('classic');
  const [showSettings, setShowSettings] = useState(false);

  const getThemeColors = () => {
    switch (boardTheme) {
      case 'wood':
        return { dark: '#b58863', light: '#f0d9b5' };
      case 'blue':
        return { dark: '#4b7399', light: '#eae9d2' };
      case 'purple':
        return { dark: '#7b5b8d', light: '#f0e6f5' };
      case 'classic':
      default:
        return { dark: '#779556', light: '#ebecd0' };
    }
  };

  useEffect(() => {
    // Connect to WebSocket
    // Use window.location.hostname in production, localhost for dev
    ws.current = new WebSocket(getWebSocketUrl());

    ws.current.onopen = () => {
      console.log('Connected to chess engine');
      // If player chose black, ask engine to make the first move
      if (settings.side === 'black' && game.moveNumber() === 1 && game.turn() === 'w') {
        requestEngineMove(game.fen());
      }
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ENGINE_MOVE') {
        const engineMove = data.move; // e.g. e2e4

        const from = engineMove.substring(0, 2);
        const to = engineMove.substring(2, 4);

        const moveObj: { from: string; to: string; promotion?: string } = { from, to };
        if (engineMove.length > 4) {
          moveObj.promotion = engineMove.substring(4, 5);
        }

        makeAMove(moveObj, true);
      }
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const requestEngineMove = (currentFen: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'REQUEST_MOVE',
        fen: currentFen,
        difficulty: settings.difficulty
      }));
    }
  };

  function makeAMove(move: any, isEngine: boolean = false) {
    const gameCopy = new Chess(game.fen());
    try {
      const result = gameCopy.move(move);
      setGame(gameCopy);
      setFen(gameCopy.fen());

      setMoveHistory(prev => [...prev, { ...result, fenAfter: gameCopy.fen() }]);

      if (!isEngine && !gameCopy.isGameOver()) {
        requestEngineMove(gameCopy.fen());
      }

      return result;
    } catch (e) {
      return null;
    }
  }

  function onDrop(sourceSquare: string, targetSquare: string, piece: string) {
    // Prevent moves if it's engine's turn or game over
    if (game.isGameOver()) return false;
    if ((settings.side === 'white' && game.turn() === 'b') ||
        (settings.side === 'black' && game.turn() === 'w')) {
      return false;
    }

    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: piece ? piece[1].toLowerCase() : 'q',
    });

    if (move === null) return false;
    return true;
  }

  const isGameOver = game.isGameOver();

  return (
    <div className="flex flex-col md:flex-row items-start justify-center gap-8 w-full max-w-6xl mx-auto p-4">

      {/* Sidebar Left: Settings / Info */}
      <div className="w-full md:w-64 bg-neutral-800 p-4 rounded-xl border border-neutral-700">
        <h3 className="font-bold text-lg mb-4 text-white">Match Info</h3>
        <div className="space-y-2 text-neutral-300 text-sm">
          <p>Playing as: <span className="text-white font-semibold capitalize">{settings.side}</span></p>
          <p>Engine: <span className="text-white font-semibold">Stockfish {settings.difficulty} ELO</span></p>
          <p>Time: <span className="text-white font-semibold">{settings.timeControl}</span></p>
        </div>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white transition-colors"
          >
            Board Settings
          </button>

          {showSettings && (
            <div className="p-3 bg-neutral-900 rounded border border-neutral-700 text-sm">
              <label className="text-neutral-300 block mb-1">Board Theme</label>
              <select
                value={boardTheme}
                onChange={(e) => setBoardTheme(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-600 text-white rounded p-2 mb-3"
              >
                <option value="classic">Classic (Green)</option>
                <option value="wood">Wood</option>
                <option value="blue">Blue</option>
                <option value="purple">Purple</option>
              </select>
            </div>
          )}

          <button onClick={onGoBack} className="w-full py-2 bg-red-600/80 hover:bg-red-600 rounded text-white transition-colors mt-4">
            Resign & Back
          </button>
          <button
            disabled={!isGameOver}
            onClick={() => onAnalyze(moveHistory)}
            className={`w-full py-2 rounded text-white transition-colors ${isGameOver ? 'bg-blue-600 hover:bg-blue-500' : 'bg-neutral-700 opacity-50 cursor-not-allowed'}`}
          >
            Analyze Game
          </button>
        </div>
      </div>

      {/* Main Board */}
      <div className="w-full max-w-[600px] flex-shrink-0">
        {/* Opponent Info */}
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-700 rounded flex items-center justify-center">🤖</div>
            <div>
              <div className="font-bold text-white">Stockfish</div>
              <div className="text-xs text-neutral-400">{settings.difficulty} ELO</div>
            </div>
          </div>
        </div>

        <div className="rounded overflow-hidden shadow-2xl">
          <Chessboard
            position={fen}
            onPieceDrop={onDrop}
            boardOrientation={settings.side}
            customDarkSquareStyle={{ backgroundColor: getThemeColors().dark }}
            customLightSquareStyle={{ backgroundColor: getThemeColors().light }}
          />
        </div>

        {/* Player Info */}
        <div className="flex items-center justify-between mt-2 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-700 rounded flex items-center justify-center">👤</div>
            <div>
              <div className="font-bold text-white">Guest</div>
              <div className="text-xs text-neutral-400">Unrated</div>
            </div>
          </div>
        </div>

        {isGameOver && (
          <div className="mt-4 p-4 bg-neutral-800 rounded-lg text-center border border-neutral-700">
            <h3 className="text-xl font-bold text-white mb-2">Game Over</h3>
            {game.isCheckmate() && <p className="text-neutral-300">Checkmate!</p>}
            {game.isDraw() && <p className="text-neutral-300">Draw</p>}
          </div>
        )}
      </div>

      {/* Sidebar Right: Move History */}
      <div className="w-full md:w-64 bg-neutral-800 p-4 rounded-xl border border-neutral-700 h-[600px] overflow-y-auto">
        <h3 className="font-bold text-lg mb-4 text-white">Move History</h3>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm font-mono text-neutral-300">
          {moveHistory.reduce((result: any[], move: any, index: number) => {
            if (index % 2 === 0) {
              result.push([move]);
            } else {
              result[result.length - 1].push(move);
            }
            return result;
          }, []).map((pair: any[], i: number) => (
            <React.Fragment key={i}>
              <div className="col-span-2 text-neutral-500 text-xs mt-1">{i + 1}.</div>
              <div className="px-2 py-1 bg-neutral-700 rounded">{pair[0].san}</div>
              <div className="px-2 py-1 bg-neutral-700 rounded">{pair[1] ? pair[1].san : ''}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
