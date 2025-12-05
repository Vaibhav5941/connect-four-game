import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Users, Copy, Check, RefreshCw, Trophy, Sparkles, Wifi, WifiOff } from 'lucide-react';

// IMPORTANT: Change this to your deployed backend URL
const SOCKET_URL = 'http://localhost:5000';

const ConnectFour = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [board, setBoard] = useState(Array(6).fill(null).map(() => Array(7).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [winner, setWinner] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [playerId] = useState(Math.random().toString(36).substring(2, 15));
  const [playerNumber, setPlayerNumber] = useState(null);
  const [copied, setCopied] = useState(false);
  const [hoveredCol, setHoveredCol] = useState(null);
  const [winningCells, setWinningCells] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);
  const socketRef = useRef(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    // Dynamically import socket.io-client
    import('socket.io-client').then(({ io }) => {
      const newSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
      });

      socketRef.current = newSocket;

      newSocket.on('connect', () => {
        console.log('✅ Connected to server');
        setConnected(true);
        setSocket(newSocket);
      });

      newSocket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
        setConnected(false);
      });

      newSocket.on('connected', (data) => {
        console.log('Server confirmed:', data);
      });

      newSocket.on('game_created', (data) => {
        console.log('🎮 Game created:', data);
      });

      newSocket.on('game_joined', (data) => {
        console.log('🎮 Game joined:', data);
        if (data.gameState) {
          setBoard(data.gameState.board);
          setCurrentPlayer(data.gameState.currentPlayer);
          setWinner(data.gameState.winner);
        }
      });

      newSocket.on('player_joined', (data) => {
        console.log('👤 Another player joined:', data);
        showMessage('Player 2 joined the game!');
      });

      newSocket.on('move_made', (data) => {
        console.log('🎯 Move made:', data);
        setBoard(data.board);
        setCurrentPlayer(data.currentPlayer);
        setWinner(data.winner);
        
        if (data.lastMove) {
          setLastMove([data.lastMove.row, data.lastMove.col]);
          setTimeout(() => setLastMove(null), 1000);
        }

        if (data.winner) {
          const result = checkWinnerLocal(data.board);
          if (result) {
            setWinningCells(result.cells);
          }
        }
      });

      newSocket.on('game_reset', (data) => {
        console.log('🔄 Game reset:', data);
        setBoard(data.board);
        setCurrentPlayer(data.currentPlayer);
        setWinner(data.winner);
        setWinningCells([]);
        setLastMove(null);
      });

      newSocket.on('error', (data) => {
        console.error('❌ Socket error:', data);
        showMessage(data.message || 'An error occurred');
      });

      return () => {
        newSocket.close();
      };
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const showMessage = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 3000);
  };

  const checkWinnerLocal = (board) => {
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
    if (!connected) {
      showMessage("Not connected to server!");
      return;
    }

    if (winner) {
      showMessage("Game is over!");
      return;
    }

    if (playerNumber && playerNumber !== currentPlayer) {
      showMessage("It's not your turn!");
      return;
    }

    if (board[0][col] !== null) {
      showMessage("Column is full!");
      return;
    }

    console.log('Sending move:', { gameId, col, playerId });
    socket.emit('make_move', {
      gameId: gameId,
      col: col,
      playerId: playerId
    });
  };

  const resetGame = () => {
    if (socket && gameId) {
      socket.emit('reset_game', { gameId });
    }
    setWinningCells([]);
    setLastMove(null);
    setErrorMsg('');
  };

  const createGame = () => {
    if (!connected) {
      showMessage("Not connected to server!");
      return;
    }

    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGameId(newGameId);
    setPlayerNumber(1);
    
    socket.emit('create_game', {
      gameId: newGameId,
      playerId: playerId
    });
    
    setBoard(Array(6).fill(null).map(() => Array(7).fill(null)));
    setCurrentPlayer(1);
    setWinner(null);
    setWinningCells([]);
    setLastMove(null);
  };

  const joinGame = (id) => {
    if (!connected) {
      showMessage("Not connected to server!");
      return;
    }

    if (!id || id.trim() === '') {
      showMessage('Please enter a game ID');
      return;
    }

    const upperGameId = id.toUpperCase();
    setGameId(upperGameId);
    setPlayerNumber(2);
    
    socket.emit('join_game', {
      gameId: upperGameId,
      playerId: playerId
    });
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
          <div className="absolute -top-12 right-0">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} backdrop-blur-xl border ${connected ? 'border-green-400/30' : 'border-red-400/30'}`}>
              {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span className="text-xs font-semibold">{connected ? 'Connected' : 'Connecting...'}</span>
            </div>
          </div>

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

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-400 text-center text-sm animate-pulse">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={createGame}
                disabled={!connected}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
                  ref={inputRef}
                  type="text"
                  placeholder="Enter Game ID"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all uppercase"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.target.value && connected) {
                      joinGame(e.target.value);
                    }
                  }}
                  disabled={!connected}
                />
                <button
                  onClick={() => {
                    if (inputRef.current && inputRef.current.value) {
                      joinGame(inputRef.current.value);
                    }
                  }}
                  disabled={!connected}
                  className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-semibold transition-all duration-300 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="absolute -top-12 right-0">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} backdrop-blur-xl border ${connected ? 'border-green-400/30' : 'border-red-400/30'}`}>
            {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span className="text-xs font-semibold">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
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

          {errorMsg && (
            <div className="mb-4 p-3 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-200 text-center text-sm animate-pulse">
              {errorMsg}
            </div>
          )}

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
                    You are <span className={playerNumber === 1 ? "text-red-400 font-bold" : "text-yellow-400 font-bold"}>
                      Player {playerNumber}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <div className="inline-block bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-3xl shadow-2xl">
              <div className="grid grid-cols-7 gap-3">
                {board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className="relative"
                      onMouseEnter={() => !winner && setHoveredCol(colIndex)}
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
          </div>

          <div className="mt-6 flex justify-center gap-8">
            <div className={`flex items-center gap-2 ${playerNumber === 1 ? 'ring-2 ring-red-400/50 rounded-full px-4 py-2' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg"></div>
              <span className="text-white font-semibold">Player 1</span>
            </div>
            <div className={`flex items-center gap-2 ${playerNumber === 2 ? 'ring-2 ring-yellow-400/50 rounded-full px-4 py-2' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg"></div>
              <span className="text-white font-semibold">Player 2</span>
            </div>
          </div>
        </div>

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