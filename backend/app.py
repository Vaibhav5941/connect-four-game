from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import time



app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production'
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

# Store game states
games = {}

@app.route('/')
def index():
    return {'status': 'Connect Four Server Running', 'games': len(games), 'active_games': list(games.keys())}

@app.route('/health')
def health():
    return {'status': 'healthy'}

@socketio.on('connect')
def handle_connect():
    print(f'✅ Client connected: {request.sid}')
    emit('connected', {'message': 'Connected to server', 'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'❌ Client disconnected: {request.sid}')

@socketio.on('create_game')
def handle_create_game(data):
    game_id = data['gameId']
    player_id = data['playerId']
    player_name = data.get('playerName', f'Player {player_id[:6]}')
    
    games[game_id] = {
        'board': [[None for _ in range(7)] for _ in range(6)],
        'currentPlayer': 1,
        'players': {1: {'id': player_id, 'name': player_name}},
        'winner': None,
        'room_members': [request.sid],
        'moveTimer': None,
        'moveStartTime': None
    }
    
    join_room(game_id)
    
    # Send full game state to Player 1
    emit('game_created', {
        'gameId': game_id,
        'playerNumber': 1,
        'playerName': player_name,
        'gameState': {
            'board': games[game_id]['board'],
            'currentPlayer': games[game_id]['currentPlayer'],
            'winner': games[game_id]['winner']
        },
        'players': {1: {'name': player_name}}
    })
    print(f'🎮 Game created: {game_id} by {player_name}')

@socketio.on('join_game')
def handle_join_game(data):
    game_id = data['gameId']
    player_id = data['playerId']
    player_name = data.get('playerName', f'Player {player_id[:6]}')
    
    print(f'🔍 Attempting to join game: {game_id}')
    print(f'📋 Available games: {list(games.keys())}')
    
    if game_id not in games:
        print(f'❌ Game not found: {game_id}')
        emit('error', {'message': f'Game {game_id} not found. Please check the Game ID.'})
        return
    
    if 2 in games[game_id]['players']:
        print(f'❌ Game full: {game_id}')
        emit('error', {'message': 'Game is full. Maximum 2 players allowed.'})
        return
    
    games[game_id]['players'][2] = {'id': player_id, 'name': player_name}
    games[game_id]['room_members'].append(request.sid)
    join_room(game_id)
    
    # Get player names for response
    players_info = {
        1: {'name': games[game_id]['players'][1]['name']},
        2: {'name': player_name}
    }
    
    # Send game state to the joining player (Player 2)
    emit('game_joined', {
        'gameId': game_id,
        'playerNumber': 2,
        'playerName': player_name,
        'gameState': {
            'board': games[game_id]['board'],
            'currentPlayer': games[game_id]['currentPlayer'],
            'winner': games[game_id]['winner']
        },
        'players': players_info
    })
    
    # Notify Player 1 with full game state to ensure synchronization
    emit('player_joined', {
        'playerNumber': 2,
        'playerName': player_name,
        'gameState': {
            'board': games[game_id]['board'],
            'currentPlayer': games[game_id]['currentPlayer'],
            'winner': games[game_id]['winner']
        },
        'players': players_info
    }, room=game_id, skip_sid=request.sid)
    print(f'✅ Player 2 ({player_name}) joined game: {game_id}')

@socketio.on('make_move')
def handle_move(data):
    game_id = data['gameId']
    col = data['col']
    player_id = data['playerId']
    
    print(f'🎯 Move attempt: game={game_id}, col={col}, player={player_id}')
    
    if game_id not in games:
        emit('error', {'message': 'Game not found'})
        return
    
    game = games[game_id]
    
    # Check if both players have joined
    if len(game['players']) < 2:
        print(f'❌ Waiting for second player')
        emit('error', {'message': 'Waiting for second player to join'})
        return
    
    # Verify it's the player's turn
    player_number = None
    for num, player_info in game['players'].items():
        if player_info['id'] == player_id:
            player_number = num
            break
    
    if player_number is None:
        print(f'❌ Player not in game')
        emit('error', {'message': 'You are not in this game'})
        return
    
    if player_number != game['currentPlayer']:
        print(f'❌ Not player turn. Current: {game["currentPlayer"]}, Attempted: {player_number}')
        emit('error', {'message': 'Not your turn'})
        return
    
    # Check if column is full
    if game['board'][0][col] is not None:
        emit('error', {'message': 'Column is full'})
        return
    
    # Find the lowest empty row in the column
    row_played = None
    for row in range(5, -1, -1):
        if game['board'][row][col] is None:
            game['board'][row][col] = game['currentPlayer']
            row_played = row
            break
    
    if row_played is None:
        emit('error', {'message': 'Column is full'})
        return
    
    print(f'✅ Move made: row={row_played}, col={col}, player={game["currentPlayer"]}')
    
    # Check for winner
    winner = check_winner(game['board'])
    if winner:
        game['winner'] = winner
        print(f'🏆 Winner: Player {winner}')
    
    # Switch player
    game['currentPlayer'] = 2 if game['currentPlayer'] == 1 else 1
    game['moveStartTime'] = time.time() if 'time' in __builtins__ else None
    
    # Get player names
    players_info = {
        1: {'name': game['players'][1]['name']},
        2: {'name': game['players'][2]['name']}
    }
    
    # Broadcast move to ALL players in the room
    emit('move_made', {
        'board': game['board'],
        'currentPlayer': game['currentPlayer'],
        'winner': game['winner'],
        'lastMove': {'row': row_played, 'col': col},
        'players': players_info
    }, room=game_id, include_self=True)

@socketio.on('reset_game')
def handle_reset(data):
    game_id = data['gameId']
    
    print(f'🔄 Resetting game: {game_id}')
    
    if game_id in games:
        games[game_id]['board'] = [[None for _ in range(7)] for _ in range(6)]
        games[game_id]['currentPlayer'] = 1
        games[game_id]['winner'] = None
        
        emit('game_reset', {
            'board': games[game_id]['board'],
            'currentPlayer': games[game_id]['currentPlayer'],
            'winner': games[game_id]['winner']
        }, room=game_id, include_self=True)

def check_winner(board):
    """Check all possible winning conditions"""
    
    # Check horizontal
    for row in range(6):
        for col in range(4):  # Only need to check up to column 3
            if (board[row][col] is not None and
                board[row][col] == board[row][col + 1] and
                board[row][col] == board[row][col + 2] and
                board[row][col] == board[row][col + 3]):
                return board[row][col]
    
    # Check vertical
    for row in range(3):  # Only need to check up to row 2
        for col in range(7):
            if (board[row][col] is not None and
                board[row][col] == board[row + 1][col] and
                board[row][col] == board[row + 2][col] and
                board[row][col] == board[row + 3][col]):
                return board[row][col]
    
    # Check diagonal (down-right)
    for row in range(3):
        for col in range(4):
            if (board[row][col] is not None and
                board[row][col] == board[row + 1][col + 1] and
                board[row][col] == board[row + 2][col + 2] and
                board[row][col] == board[row + 3][col + 3]):
                return board[row][col]
    
    # Check diagonal (down-left)
    for row in range(3):
        for col in range(3, 7):
            if (board[row][col] is not None and
                board[row][col] == board[row + 1][col - 1] and
                board[row][col] == board[row + 2][col - 2] and
                board[row][col] == board[row + 3][col - 3]):
                return board[row][col]
    
    return None

if __name__ == '__main__':
    print('🚀 Starting Connect Four Server...')
    print('📡 Server will be available at http://0.0.0.0:5000')
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)