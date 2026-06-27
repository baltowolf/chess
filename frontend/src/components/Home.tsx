import React, { useState } from 'react';
import { Settings, Play } from 'lucide-react';

interface HomeProps {
  onStartGame: (settings: any) => void;
}

export const Home: React.FC<HomeProps> = ({ onStartGame }) => {
  const [difficulty, setDifficulty] = useState(1500);
  const [side, setSide] = useState<'white' | 'black' | 'random'>('white');
  const [timeControl, setTimeControl] = useState('10+0');

  const handleStart = () => {
    let finalSide = side;
    if (side === 'random') {
      finalSide = Math.random() > 0.5 ? 'white' : 'black';
    }

    onStartGame({
      difficulty,
      side: finalSide,
      timeControl
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100 p-4">
      <div className="max-w-md w-full bg-neutral-800 rounded-xl shadow-2xl overflow-hidden border border-neutral-700">
        <div className="p-6 bg-neutral-750 border-b border-neutral-700">
          <h1 className="text-3xl font-bold text-center text-white flex items-center justify-center gap-2">
            <Settings className="w-8 h-8 text-blue-500" />
            Play vs Computer
          </h1>
        </div>

        <div className="p-6 space-y-6">
          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Engine Difficulty (ELO)</label>
            <input
              type="range"
              min="800"
              max="3200"
              step="100"
              value={difficulty}
              onChange={(e) => setDifficulty(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="text-center font-semibold text-blue-400">{difficulty} ELO</div>
          </div>

          {/* Side Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Play as</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSide('white')}
                className={`p-3 rounded-lg border flex justify-center items-center ${side === 'white' ? 'border-blue-500 bg-blue-500/20' : 'border-neutral-600 hover:bg-neutral-700'}`}
              >
                <div className="w-6 h-6 rounded-full bg-white border-2 border-neutral-300"></div>
              </button>
              <button
                onClick={() => setSide('random')}
                className={`p-3 rounded-lg border font-bold text-xl flex justify-center items-center ${side === 'random' ? 'border-blue-500 bg-blue-500/20' : 'border-neutral-600 hover:bg-neutral-700'}`}
              >
                ?
              </button>
              <button
                onClick={() => setSide('black')}
                className={`p-3 rounded-lg border flex justify-center items-center ${side === 'black' ? 'border-blue-500 bg-blue-500/20' : 'border-neutral-600 hover:bg-neutral-700'}`}
              >
                <div className="w-6 h-6 rounded-full bg-black border-2 border-neutral-600"></div>
              </button>
            </div>
          </div>

          {/* Time Control (Visual only for now) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Time Control</label>
            <select
              value={timeControl}
              onChange={(e) => setTimeControl(e.target.value)}
              className="w-full bg-neutral-700 border border-neutral-600 text-white rounded-lg p-3 outline-none focus:border-blue-500"
            >
              <option value="3+0">Blitz (3 min)</option>
              <option value="3+2">Blitz (3+2)</option>
              <option value="5+0">Blitz (5 min)</option>
              <option value="10+0">Rapid (10 min)</option>
              <option value="15+10">Rapid (15+10)</option>
              <option value="unlimited">Unlimited</option>
            </select>
          </div>

          <button
            onClick={handleStart}
            className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition-colors flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Play fill="currentColor" />
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
};
