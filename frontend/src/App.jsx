import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Users, Copy, Check, RefreshCw, Trophy, Sparkles, Wifi, WifiOff, Clock, Volume2, VolumeX, User, RotateCcw, Signal, SignalLow, SignalMedium, SignalHigh } from 'lucide-react';
import soundManager from './sounds';

// IMPORTANT: Change this to your deployed backend URL
// For local testing, use: 'http://localhost:5000'
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://connect-four-game-mzys.onrender.com'
  : 'http://localhost:5000';

const ConnectFour = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [board, setBoard] = useState(Array(6).fill(null).map(() => Array(7).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [winner, setWinner] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [playerId] = useState(() => {
    const stored = localStorage.getItem('playerId');
    return stored || Math.random().toString(36).substring(2, 15);
  });
  const [playerName, setPlayerName] = useState(() => {
    const stored = localStorage.getItem('playerName');
    return stored || `Player ${playerId.substring(0, 6)}`;
  });
  const [playerNumber, setPlayerNumber] = useState(null);
  const [players, setPlayers] = useState({});
  const [copied, setCopied] = useState(false);
  const [hoveredCol, setHoveredCol] = useState(null);
  const [winningCells, setWinningCells] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [moveTimer, setMoveTimer] = useState(30);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [showNameInput, setShowNameInput] = useState(false);
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    const stored = localStorage.getItem('soundsEnabled');
    return stored !== 'false';
  });
  const [animatingCells, setAnimatingCells] = useState(new Set());
  const [connectionQuality, setConnectionQuality] = useState('good'); // 'poor', 'fair', 'good', 'excellent'
  const [reconnecting, setReconnecting] = useState(false);
  const [gameState, setGameState] = useState(null); // Store game state for reconnection
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  const [swipeStart, setSwipeStart] = useState(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('playerId', playerId);
  }, [playerId]);

  useEffect(() => {
    localStorage.setItem('playerName', playerName);
  }, [playerName]);

  useEffect(() => {
    localStorage.setItem('soundsEnabled', soundsEnabled.toString());
    soundManager.enabled = soundsEnabled;
  }, [soundsEnabled]);

  // Timer effect
  useEffect(() => {
    if (winner || !gameId || waitingForPlayer || !connected) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (playerNumber && playerNumber === currentPlayer) {
      setTimeRemaining(moveTimer);
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            showMessage('Time\'s up! Your turn was skipped.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentPlayer, playerNumber, winner, gameId, waitingForPlayer, connected, moveTimer]);

  // Monitor connection quality function (must be defined before useEffect)
  const monitorConnectionQuality = (socket) => {
    if (!socket) return;
    
    let pingCount = 0;
    let pings = [];
    let timeoutId = null;
    
    const checkPing = () => {
      if (!socket || !socket.connected) {
        if (timeoutId) clearTimeout(timeoutId);
        return;
      }
      
      const startTime = Date.now();
      socket.emit('ping', { timestamp: startTime }, (response) => {
        if (response && response.timestamp) {
          const latency = Date.now() - startTime;
          pings.push(latency);
          if (pings.length > 10) pings.shift();
          
          const avgLatency = pings.reduce((a, b) => a + b, 0) / pings.length;
          
          if (avgLatency < 50) {
            setConnectionQuality('excellent');
          } else if (avgLatency < 100) {
            setConnectionQuality('good');
          } else if (avgLatency < 200) {
            setConnectionQuality('fair');
          } else {
            setConnectionQuality('poor');
          }
        }
      });
      
      pingCount++;
      if (pingCount < 100 && socket.connected) {
        timeoutId = setTimeout(checkPing, 2000);
      }
    };
    
    timeoutId = setTimeout(checkPing, 1000);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  };

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
        setReconnecting(false);
        setSocket(newSocket);
        
        // Recover game state if reconnecting
        if (gameState && gameId) {
          if (playerNumber === 1) {
            newSocket.emit('create_game', {
              gameId: gameId,
              playerId: playerId,
              playerName: playerName
            });
          } else if (playerNumber === 2) {
            newSocket.emit('join_game', {
              gameId: gameId,
              playerId: playerId,
              playerName: playerName
            });
          }
        }
        
        // Monitor connection quality
        monitorConnectionQuality(newSocket);
      });

      newSocket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
        setConnected(false);
        setConnectionQuality('poor');
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Reconnecting... (attempt ${attemptNumber})`);
        setReconnecting(true);
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt ${attemptNumber}`);
        setReconnecting(true);
      });

      newSocket.on('reconnect_error', (error) => {
        console.log('❌ Reconnection error:', error);
        setReconnecting(true);
      });

      newSocket.on('reconnect_failed', () => {
        console.log('❌ Reconnection failed');
        setReconnecting(false);
        setConnectionQuality('poor');
        showMessage('Connection lost. Please refresh the page.');
      });

      newSocket.on('connected', (data) => {
        console.log('Server confirmed:', data);
      });

      newSocket.on('game_created', (data) => {
        console.log('🎮 Game created:', data);
        if (data.gameState) {
          setBoard(data.gameState.board);
          setCurrentPlayer(data.gameState.currentPlayer);
          setWinner(data.gameState.winner);
        }
        if (data.players) {
          setPlayers(data.players);
        }
        setWaitingForPlayer(true);
        setGameState(data.gameState);
        soundManager.playJoin();
      });

      newSocket.on('game_joined', (data) => {
        console.log('🎮 Game joined:', data);
        if (data.gameState) {
          setBoard(data.gameState.board);
          setCurrentPlayer(data.gameState.currentPlayer);
          setWinner(data.gameState.winner);
        }
        if (data.players) {
          setPlayers(data.players);
        }
        setWaitingForPlayer(false);
        setGameState(data.gameState);
        soundManager.playJoin();
      });

      newSocket.on('player_joined', (data) => {
        console.log('👤 Another player joined:', data);
        const player2Name = data.playerName || data.players?.[2]?.name || 'Player 2';
        showMessage(`${player2Name} joined the game!`);
        // Update game state when player 2 joins to ensure synchronization
        if (data.gameState) {
          setBoard(data.gameState.board);
          setCurrentPlayer(data.gameState.currentPlayer);
          setWinner(data.gameState.winner);
        }
        if (data.players) {
          setPlayers(data.players);
        }
        setWaitingForPlayer(false);
        setGameState(data.gameState);
        soundManager.playJoin();
      });

      newSocket.on('move_made', (data) => {
        console.log('🎯 Move made:', data);
        
        if (data.lastMove) {
          // Animate piece drop
          const cellKey = `${data.lastMove.row}-${data.lastMove.col}`;
          setAnimatingCells(prev => new Set(prev).add(cellKey));
          setTimeout(() => {
            setAnimatingCells(prev => {
              const newSet = new Set(prev);
              newSet.delete(cellKey);
              return newSet;
            });
          }, 600);
          
          setLastMove([data.lastMove.row, data.lastMove.col]);
          setTimeout(() => setLastMove(null), 1000);
        }

        setBoard(data.board);
        setCurrentPlayer(data.currentPlayer);
        setWinner(data.winner);
        
        if (data.players) {
          setPlayers(data.players);
        }

        // Store game state for reconnection
        setGameState({
          board: data.board,
          currentPlayer: data.currentPlayer,
          winner: data.winner,
          players: data.players
        });

        if (data.winner) {
          const result = checkWinnerLocal(data.board);
          if (result) {
            setWinningCells(result.cells);
          }
          soundManager.playWin();
        } else {
          soundManager.playMove();
        }
      });

      newSocket.on('game_reset', (data) => {
        console.log('🔄 Game reset:', data);
        setBoard(data.board);
        setCurrentPlayer(data.currentPlayer);
        setWinner(data.winner);
        setWinningCells([]);
        setLastMove(null);
        setRematchPending(false);
        setRematchRequested(false);
        // Store game state for reconnection
        setGameState({
          board: data.board,
          currentPlayer: data.currentPlayer,
          winner: data.winner
        });
      });

      newSocket.on('error', (data) => {
        console.error('❌ Socket error:', data);
        showMessage(data.message || 'An error occurred');
        soundManager.playError();
      });

      newSocket.on('rematch_requested', (data) => {
        console.log('🔄 Rematch requested:', data);
        setRematchPending(true);
        showMessage(`${data.playerName || 'Opponent'} requested a rematch!`);
      });

      newSocket.on('rematch_accepted', (data) => {
        console.log('✅ Rematch accepted:', data);
        setRematchPending(false);
        setRematchRequested(false);
        if (data.switchSides) {
          setPlayerNumber(playerNumber === 1 ? 2 : 1);
        }
        if (data.gameState) {
          setBoard(data.gameState.board);
          setCurrentPlayer(data.gameState.currentPlayer);
          setWinner(data.gameState.winner);
        }
        if (data.players) {
          setPlayers(data.players);
        }
        setWinningCells([]);
        setLastMove(null);
        showMessage('Rematch started!');
      });

      newSocket.on('rematch_declined', (data) => {
        console.log('❌ Rematch declined:', data);
        setRematchPending(false);
        setRematchRequested(false);
        showMessage('Rematch declined');
      });

      newSocket.on('pong', (data) => {
        // Pong received, connection quality monitoring handles this
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      soundManager.playError();
      return;
    }

    if (waitingForPlayer) {
      showMessage("Waiting for another player to join!");
      soundManager.playError();
      return;
    }

    if (winner) {
      showMessage("Game is over!");
      soundManager.playError();
      return;
    }

    if (playerNumber && playerNumber !== currentPlayer) {
      showMessage("It's not your turn!");
      soundManager.playError();
      return;
    }

    if (board[0][col] !== null) {
      showMessage("Column is full!");
      soundManager.playError();
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
    
    // Don't reset board locally - wait for server to send the state
    socket.emit('create_game', {
      gameId: newGameId,
      playerId: playerId,
      playerName: playerName
    });
    
    // Reset local state, but server will send the actual state
    setBoard(Array(6).fill(null).map(() => Array(7).fill(null)));
    setCurrentPlayer(1);
    setWinner(null);
    setWinningCells([]);
    setLastMove(null);
    setWaitingForPlayer(true);
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
      playerId: playerId,
      playerName: playerName
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

  const isAnimating = (row, col) => {
    return animatingCells.has(`${row}-${col}`);
  };

  const toggleSounds = () => {
    setSoundsEnabled(!soundsEnabled);
  };

  // Rematch functions
  const requestRematch = (switchSides = false) => {
    if (!socket || !gameId) return;
    
    setRematchRequested(true);
    socket.emit('request_rematch', {
      gameId: gameId,
      playerId: playerId,
      switchSides: switchSides
    });
  };

  // Touch/Swipe handlers for mobile
  const handleTouchStart = (e, colIndex) => {
    if (winner || waitingForPlayer) return;
    if (playerNumber && playerNumber !== currentPlayer) return;
    if (board[0][colIndex] !== null) return;
    
    setSwipeStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      col: colIndex
    });
  };

  const handleTouchMove = (e) => {
    if (!swipeStart) return;
    // Prevent scrolling while swiping on board
    e.preventDefault();
  };

  const handleTouchEnd = (e) => {
    if (!swipeStart) return;
    
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - swipeStart.x;
    const deltaY = endY - swipeStart.y;
    
    // If it's a tap (small movement), make the move
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      makeMove(swipeStart.col);
    }
    
    setSwipeStart(null);
  };

  if (!gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2YzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMCAwIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="relative max-w-md w-full">
          <div className="absolute -top-12 right-0 flex gap-2">
            <button
              onClick={toggleSounds}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 transition-all"
              title={soundsEnabled ? 'Disable sounds' : 'Enable sounds'}
            >
              {soundsEnabled ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-white" />}
            </button>
            <button
              onClick={() => setShowNameInput(!showNameInput)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 transition-all"
              title="Change name"
            >
              <User className="w-4 h-4 text-white" />
            </button>
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

            {showNameInput && (
              <div className="mb-4 p-4 bg-white/10 border border-white/20 rounded-xl">
                <label className="block text-sm text-blue-200 mb-2">Your Name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  maxLength={20}
                />
                <button
                  onClick={() => setShowNameInput(false)}
                  className="mt-2 w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 py-2 rounded-xl text-sm transition-all"
                >
                  Done
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-400 text-center text-sm animate-pulse">
                {errorMsg}
              </div>
            )}

            <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-200">Playing as:</span>
                <span className="text-white font-semibold">{playerName}</span>
              </div>
            </div>

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
        <div className="absolute -top-12 right-0 flex flex-col sm:flex-row gap-2">
          {reconnecting && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 text-yellow-400 backdrop-blur-xl border border-yellow-400/30">
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-yellow-400 border-t-transparent"></div>
              <span className="text-xs font-semibold">Reconnecting...</span>
            </div>
          )}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} backdrop-blur-xl border ${connected ? 'border-green-400/30' : 'border-red-400/30'}`}>
            {connected ? (
              <>
                {connectionQuality === 'excellent' && <SignalHigh className="w-4 h-4" />}
                {connectionQuality === 'good' && <Signal className="w-4 h-4" />}
                {connectionQuality === 'fair' && <SignalMedium className="w-4 h-4" />}
                {(connectionQuality === 'poor' || !connectionQuality) && <SignalLow className="w-4 h-4" />}
              </>
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span className="text-xs font-semibold">
              {connected ? (connectionQuality === 'poor' ? 'Poor Connection' : 'Connected') : 'Disconnected'}
            </span>
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
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold">
                  <Trophy className="w-8 h-8 text-yellow-400 animate-bounce" />
                  <span className={winner === 1 ? "text-red-400" : "text-yellow-400"}>
                    {players[winner]?.name || `Player ${winner}`} Wins! 🎉
                  </span>
                </div>
                {!rematchPending && (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                    <button
                      onClick={() => requestRematch(false)}
                      className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Rematch
                    </button>
                    <button
                      onClick={() => requestRematch(true)}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition-all border border-white/20"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Rematch & Switch Sides
                    </button>
                  </div>
                )}
                {rematchPending && (
                  <div className="text-blue-200 text-sm">
                    Waiting for opponent to accept rematch...
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xl text-white font-semibold">
                  Current Turn: <span className={currentPlayer === 1 ? "text-red-400" : "text-yellow-400"}>
                    {players[currentPlayer]?.name || `Player ${currentPlayer}`}
                  </span>
                </div>
                {playerNumber && (
                  <div className="text-sm text-blue-200">
                    You are <span className={playerNumber === 1 ? "text-red-400 font-bold" : "text-yellow-400 font-bold"}>
                      {playerName}
                    </span>
                  </div>
                )}
                {playerNumber && playerNumber === currentPlayer && !winner && !waitingForPlayer && (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Clock className={`w-4 h-4 ${timeRemaining <= 5 ? 'text-red-400 animate-pulse' : 'text-blue-300'}`} />
                    <span className={timeRemaining <= 5 ? 'text-red-400 font-bold' : 'text-blue-300'}>
                      {timeRemaining}s
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <div 
              className="inline-block bg-gradient-to-br from-blue-600 to-blue-800 p-4 sm:p-6 rounded-3xl shadow-2xl touch-none"
              onTouchMove={handleTouchMove}
            >
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                {board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className="relative"
                      onMouseEnter={() => !winner && setHoveredCol(colIndex)}
                      onMouseLeave={() => setHoveredCol(null)}
                      onTouchStart={(e) => handleTouchStart(e, colIndex)}
                      onTouchEnd={handleTouchEnd}
                    >
                      <button
                        onClick={() => makeMove(colIndex)}
                        disabled={winner || (playerNumber && playerNumber !== currentPlayer) || waitingForPlayer}
                        className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full transition-all duration-300 touch-manipulation ${
                          !cell ? 'bg-white/90 hover:bg-white active:bg-white shadow-inner' : ''
                        } ${
                          hoveredCol === colIndex && !winner && (!playerNumber || playerNumber === currentPlayer) && !cell && !waitingForPlayer
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
                          } ${
                            isAnimating(rowIndex, colIndex) ? 'animate-drop' : ''
                          }`}
                          style={isAnimating(rowIndex, colIndex) ? {
                            animation: 'dropPiece 0.6s ease-out',
                            transform: 'translateY(-100%)'
                          } : {}}
                          >
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

          <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
            <div className={`flex items-center gap-2 ${playerNumber === 1 ? 'ring-2 ring-red-400/50 rounded-full px-4 py-2' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg"></div>
              <div className="flex flex-col">
                <span className="text-white font-semibold">{players[1]?.name || 'Player 1'}</span>
                {playerNumber === 1 && <span className="text-xs text-blue-200">You</span>}
              </div>
            </div>
            <div className={`flex items-center gap-2 ${playerNumber === 2 ? 'ring-2 ring-yellow-400/50 rounded-full px-4 py-2' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg"></div>
              <div className="flex flex-col">
                <span className="text-white font-semibold">{players[2]?.name || 'Waiting...'}</span>
                {playerNumber === 2 && <span className="text-xs text-blue-200">You</span>}
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-4">
            <button
              onClick={toggleSounds}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 transition-all"
              title={soundsEnabled ? 'Disable sounds' : 'Enable sounds'}
            >
              {soundsEnabled ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-white" />}
            </button>
          </div>

          {showStats && (
            <div className="mt-4 p-4 bg-white/10 border border-white/20 rounded-xl">
              <h3 className="text-white font-semibold mb-3 text-center">Statistics</h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-400">{stats.wins}</div>
                  <div className="text-xs text-blue-200">Wins</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{stats.losses}</div>
                  <div className="text-xs text-blue-200">Losses</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">{stats.gamesPlayed}</div>
                  <div className="text-xs text-blue-200">Games</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0}%
                  </div>
                  <div className="text-xs text-blue-200">Win Rate</div>
                </div>
              </div>
            </div>
          )}
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