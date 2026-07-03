import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { ChevronLeft, ChevronRight, RotateCcw, MessageSquare } from 'lucide-react';

interface AnalysisProps {
  history: any[];
  onGoBack: () => void;
}

export const Analysis: React.FC<AnalysisProps> = ({ history, onGoBack }) => {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(history.length - 1);
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const [isWsReady, setIsWsReady] = useState(false);

  const currentMove = history[currentMoveIndex];
  const fen = currentMove ? currentMove.fenAfter : new Chess().fen();
  const moveNumber = currentMoveIndex >= 0 ? Math.floor(currentMoveIndex / 2) + 1 : 0;
  const isWhiteToMove = currentMoveIndex >= 0 ? currentMoveIndex % 2 !== 0 : true; // Since the move at index 0 is white, the *next* turn is black

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080/ws-chess');
    wsRef.current = ws;

    ws.onopen = () => setIsWsReady(true);
    ws.onclose = () => setIsWsReady(false);
    ws.onerror = () => {
      setExplanation('Failed to load analysis.');
      setIsLoading(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (currentMoveIndex < 0) {
      setExplanation('Start of the game.');
      setIsLoading(false);
      return;
    }

    if (!isWsReady || !wsRef.current) return;

    setIsLoading(true);
    setExplanation('');

    const ws = wsRef.current;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ANALYSIS_RESULT') {
        setExplanation(data.explanation);
        setIsLoading(false);
      }
    };

    // Mock random evaluations for the sake of the demonstration
    // Normally Stockfish evaluates the position before and after the move.
    const mockEvalBefore = Math.floor(Math.random() * 200) - 100;
    const mockEvalAfter = mockEvalBefore + (Math.floor(Math.random() * 150) - 75);

    ws.send(JSON.stringify({
      type: 'ANALYZE_MOVE',
      move: currentMove.san,
      evalBefore: mockEvalBefore,
      evalAfter: mockEvalAfter,
      isWhiteToMove: isWhiteToMove // Whose move was it?
    }));

  }, [currentMoveIndex, currentMove, isWhiteToMove, isWsReady]);
  const goToStart = () => setCurrentMoveIndex(-1);
  const goToPrev = () => setCurrentMoveIndex(Math.max(-1, currentMoveIndex - 1));
  const goToNext = () => setCurrentMoveIndex(Math.min(history.length - 1, currentMoveIndex + 1));
  const goToEnd = () => setCurrentMoveIndex(history.length - 1);

  return (
    <div className="flex flex-col md:flex-row items-start justify-center gap-8 w-full max-w-6xl mx-auto p-4">
      {/* Left Sidebar: Controls */}
      <div className="w-full md:w-64 bg-neutral-800 p-4 rounded-xl border border-neutral-700">
        <h3 className="font-bold text-xl mb-6 text-white border-b border-neutral-700 pb-2">Analysis Board</h3>

        <div className="space-y-4">
          <button onClick={onGoBack} className="w-full py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white transition-colors">
            Exit Analysis
          </button>
        </div>
      </div>

      {/* Main Board */}
      <div className="w-full max-w-[600px] flex-shrink-0">
        <div className="rounded overflow-hidden shadow-2xl">
          <Chessboard
            position={fen}
            arePiecesDraggable={false}
            customDarkSquareStyle={{ backgroundColor: '#779556' }}
            customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
          />
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4 mt-6 bg-neutral-800 p-3 rounded-lg border border-neutral-700">
          <button onClick={goToStart} disabled={currentMoveIndex === -1} className="p-2 hover:bg-neutral-700 rounded text-neutral-300 disabled:opacity-30">
            <RotateCcw className="w-5 h-5" />
          </button>
          <button onClick={goToPrev} disabled={currentMoveIndex === -1} className="p-2 hover:bg-neutral-700 rounded text-neutral-300 disabled:opacity-30">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="font-mono text-lg font-bold min-w-[3rem] text-center">
            {currentMoveIndex >= 0 ? `${moveNumber}${isWhiteToMove ? '...' : '.'}` : '-'}
          </div>
          <button onClick={goToNext} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-neutral-700 rounded text-neutral-300 disabled:opacity-30">
            <ChevronRight className="w-6 h-6" />
          </button>
          <button onClick={goToEnd} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-neutral-700 rounded text-neutral-300 disabled:opacity-30">
            <ChevronRight className="w-6 h-6" style={{marginLeft: '-12px'}}/>
            <ChevronRight className="w-6 h-6 absolute" style={{marginLeft: '-6px', marginTop: '-24px'}} />
          </button>
        </div>
      </div>

      {/* Right Sidebar: AI Analysis */}
      <div className="w-full md:w-80 bg-neutral-800 p-4 rounded-xl border border-neutral-700 flex flex-col h-[600px]">
        <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          AI Coach
        </h3>

        <div className="flex-grow overflow-y-auto bg-neutral-900 rounded p-4 border border-neutral-700">
          {currentMoveIndex < 0 ? (
            <p className="text-neutral-400 italic">Game starting position.</p>
          ) : (
            <div>
              <div className="font-bold text-lg mb-2 text-white">
                Move: {currentMove.san}
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 text-neutral-400 mt-4">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  Analyzing move...
                </div>
              ) : (
                <div className="text-neutral-200 mt-4 leading-relaxed">
                  {explanation}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
