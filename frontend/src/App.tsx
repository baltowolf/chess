import { useState } from 'react'
import { Home } from './components/Home'
import { Game } from './components/Game'
import { Analysis } from './components/Analysis'
import './App.css'

function App() {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'analysis'>('setup')
  const [gameSettings, setGameSettings] = useState<any>(null)
  const [gameHistory, setGameHistory] = useState<any[]>([])

  const handleStartGame = (settings: any) => {
    setGameSettings(settings)
    setGameState('playing')
  }

  const handleAnalyze = (history: any[]) => {
    setGameHistory(history)
    setGameState('analysis')
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white w-full">
      {gameState === 'setup' && (
        <Home onStartGame={handleStartGame} />
      )}

      {gameState === 'playing' && gameSettings && (
        <Game
          settings={gameSettings}
          onGoBack={() => setGameState('setup')}
          onAnalyze={handleAnalyze}
        />
      )}

      {gameState === 'analysis' && (
        <Analysis
          history={gameHistory}
          onGoBack={() => setGameState('setup')}
        />
      )}
    </div>
  )
}

export default App
