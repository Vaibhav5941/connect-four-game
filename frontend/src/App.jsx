import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Gamepad2, Users, Copy, Check, RefreshCw, Trophy, Sparkles } from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const ConnectFour = () => {
  const [board, setBoard] = useState(Array(6).fill(null).map(() => Array(7).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [winner, setWinner] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerNumber, setPlayerNumber] = useState(null);
  const [copied, setCopied] = useState(false);
  const [hoveredCol, setHoveredCol] = useState(null);
  const [winningCells, setWinningCells] = useState([]);
  const [lastMove, setLastMove] = useState(null);

  const checkWinner = (board) => {
    // Check horizontal
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        if (board[row][col] && 
            board[row][col] === board[row][col + 1] &&
            board[row][col] === board[row][col + 2] &&
            board[row][col] === board[row][col + 3]) {
          return {
            winner: board[row][col],
            cells: [[row, col], [row, col + 1], [row, col + 2], [row, col + 3]]
          };
        }
      }
    }

    // Check vertical
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) {
        if (board[row][col] &&
            board[row][col] === board[row + 1][col] &&
            board[row][col] === board[row + 2][col] &&
            board[row][col] === board[row + 3][col]) {
          return {
            winner: board[row][col],
            cells: [[row, col], [row + 1, col], [row + 2, col], [row + 3, col]]
          };
        }
      }
    }

    // Check diagonal (down-right)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        if (board[row][col] &&
            board[row][col] === board[row + 1][col + 1] &&
            board[row][col] === board[row + 2][col + 2] &&
            board[row][col] === board[row + 3][col + 3]) {
          return {
            winner: board[row][col],
            cells: [[row, col], [row + 1, col + 1], [row + 2, col + 2], [row + 3, col + 3]]
          };
        }
      }
    }

    // Check diagonal (down-left)
    for (let row = 0; row < 3; row++) {
      for (let col = 3; col < 7; col++) {
        if (board[row][col] &&
            board[row][col] === board[row + 1][col - 1] &&
            board[row][col] === board[row + 2][col - 2] &&
            board[row][col] === board[row + 3][col - 3]) {
          return {
            winner: board[row][col],
            cells: [[row, col], [row + 1, col - 1], [row + 2, col - 2], [row + 3, col - 3]]
          };
        }
      }
    }

    return null;
  };

  const makeMove = (col) => {
    if (winner || (playerNumber && playerNumber !== currentPlayer)) return;

    for (let row = 5; row >= 0; row--) {
      if (!board[row][col]) {
        const newBoard = board.map(r => [...r]);
        newBoard[row][col] = currentPlayer;
        setBoard(newBoard);
        setLastMove([row, col]);

        const result = checkWinner(newBoard);
        if (result) {
          setWinner(result.winner);
          setWinningCells(result.cells);
        } else {
          setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
        }
        break;
      }
    }
  };

  const resetGame = () => {
    setBoard(Array(6).fill(null).map(() => Array(7).fill(null)));
    setCurrentPlayer(1);
    setWinner(null);
    setWinningCells([]);
    setLastMove(null);
  };

  const createGame = () => {
    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newPlayerId = Math.random().toString(36).substring(2, 15);
    setGameId(newGameId);
    setPlayerId(newPlayerId);
    setPlayerNumber(1);
    resetGame();
  };

  const joinGame = (id) => {
    const newPlayerId = Math.random().toString(36).substring(2, 15);
    setGameId(id);
    setPlayerId(newPlayerId);
    setPlayerNumber(2);
  };

  const copyGameId = () => {
    navigator.clipboard.writeText(gameId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isWinningCell = (row, col) => {
    return winningCells.some(([r, c]) => r === row && c === col);
  };

  const isLastMove = (row, col) => {
    return lastMove && lastMove[0] === row && lastMove[1] === col;
  };

  if (!gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2YzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMCAwIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="relative max-w-md w-full">
          <div className="absolute -top-20 left-1/2 transform -translate-x-1/2">
            <div className="relative">
              <Sparkles className="w-16 h-16 text-yellow-400 animate-pulse" />
              <div className="absolute inset-0 blur-xl bg-yellow-400 opacity-50"></div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl mb-4 shadow-lg">
                <Gamepad2 className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">Connect Four</h1>
              <p className="text-blue-200">Real-time Multiplayer Game</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={createGame}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-5 h-5" />
                  Create New Game
                </div>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-blue-200">or</span>
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter Game ID"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.target.value) {
                      joinGame(e.target.value.toUpperCase());
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = e.target.previousElementSibling;
                    if (input.value) joinGame(input.value.toUpperCase());
                  }}
                  className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-semibold transition-all duration-300 border border-white/20"
                >
                  Join Game
                </button>
              </div>
            </div>

            <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-sm text-blue-200 text-center">
                💡 Create a game and share the ID with a friend to play together
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2YzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMCAwIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
      
      <div className="relative max-w-4xl w-full">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                <Gamepad2 className="w-8 h-8" />
                Connect Four
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-200">Game ID:</span>
                <code className="bg-white/10 px-3 py-1 rounded-lg text-white font-mono">{gameId}</code>
                <button
                  onClick={copyGameId}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-blue-300" />}
                </button>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition-all border border-white/20"
            >
              <RefreshCw className="w-4 h-4" />
              New Game
            </button>
          </div>

          {/* Game Status */}
          <div className="mb-6 text-center">
            {winner ? (
              <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                <Trophy className="w-8 h-8 text-yellow-400 animate-bounce" />
                <span className={winner === 1 ? "text-red-400" : "text-yellow-400"}>
                  Player {winner} Wins! 🎉
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xl text-white font-semibold">
                  Current Turn: <span className={currentPlayer === 1 ? "text-red-400" : "text-yellow-400"}>
                    Player {currentPlayer}
                  </span>
                </div>
                {playerNumber && (
                  <div className="text-sm text-blue-200">
                    You are <span className={playerNumber === 1 ? "text-red-400" : "text-yellow-400"}>
                      Player {playerNumber}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Game Board */}
          <div className="inline-block mx-auto bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-3xl shadow-2xl">
            <div className="grid grid-cols-7 gap-3">
              {board.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className="relative"
                    onMouseEnter={() => setHoveredCol(colIndex)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <button
                      onClick={() => makeMove(colIndex)}
                      disabled={winner || (playerNumber && playerNumber !== currentPlayer)}
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-300 ${
                        !cell ? 'bg-white/90 hover:bg-white shadow-inner' : ''
                      } ${
                        hoveredCol === colIndex && !winner && (!playerNumber || playerNumber === currentPlayer) && !cell
                          ? 'ring-4 ring-white/50 transform scale-110'
                          : ''
                      } ${
                        isWinningCell(rowIndex, colIndex) ? 'ring-4 ring-green-400 animate-pulse' : ''
                      } disabled:cursor-not-allowed relative overflow-hidden`}
                    >
                      {cell && (
                        <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
                          cell === 1
                            ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-500/50'
                            : 'bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg shadow-yellow-500/50'
                        } ${
                          isLastMove(rowIndex, colIndex) ? 'animate-bounce' : ''
                        }`}>
                          <div className="absolute inset-2 bg-white/20 rounded-full"></div>
                        </div>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Player Legend */}
          <div className="mt-6 flex justify-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg"></div>
              <span className="text-white font-semibold">Player 1</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg"></div>
              <span className="text-white font-semibold">Player 2</span>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
          <p className="text-sm text-blue-200 text-center">
            🎮 Connect four pieces in a row (horizontal, vertical, or diagonal) to win!
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectFour;