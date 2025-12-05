from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import json


app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this'
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

# Store game states
games = {}

@app.route('/')
def index():
    return {'status': 'Connect Four Server Running', 'games': len(games)}

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    emit('connected', {'message': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')

@socketio.on('create_game')
def handle_create_game(data):
    game_id = data['gameId']
    player_id = data['playerId']
    
    games[game_id] = {
        'board': [[None for _ in range(7)] for _ in range(6)],
        'currentPlayer': 1,
        'players': {1: player_id},
        'winner': None
    }
    
    join_room(game_id)
    emit('game_created', {'gameId': game_id, 'playerNumber': 1})
    print(f'Game created: {game_id}')

@socketio.on('join_game')
def handle_join_game(data):
    game_id = data['gameId']
    player_id = data['playerId']
    
    if game_id not in games:
        emit('error', {'message': 'Game not found'})
        return
    
    if 2 in games[game_id]['players']:
        emit('error', {'message': 'Game is full'})
        return
    
    games[game_id]['players'][2] = player_id
    join_room(game_id)
    
    emit('game_joined', {
        'gameId': game_id,
        'playerNumber': 2,
        'gameState': games[game_id]
    })
    
    emit('player_joined', {'playerNumber': 2}, room=game_id, skip_sid=request.sid)
    print(f'Player joined game: {game_id}')

@socketio.on('make_move')
def handle_move(data):
    game_id = data['gameId']
    col = data['col']
    player_id = data['playerId']
    
    if game_id not in games:
        emit('error', {'message': 'Game not found'})
        return
    
    game = games[game_id]
    
    # Verify it's the player's turn
    player_number = None
    for num, pid in game['players'].items():
        if pid == player_id:
            player_number = num
            break
    
    if player_number != game['currentPlayer']:
        emit('error', {'message': 'Not your turn'})
        return
    
    # Find the lowest empty row in the column
    for row in range(5, -1, -1):
        if game['board'][row][col] is None:
            game['board'][row][col] = game['currentPlayer']
            
            # Check for winner
            winner = check_winner(game['board'], row, col)
            if winner:
                game['winner'] = winner
            
            # Switch player
            game['currentPlayer'] = 2 if game['currentPlayer'] == 1 else 1
            
            # Broadcast move to all players in the room
            emit('move_made', {
                'board': game['board'],
                'currentPlayer': game['currentPlayer'],
                'winner': game['winner'],
                'lastMove': {'row': row, 'col': col}
            }, room=game_id)
            
            return
    
    emit('error', {'message': 'Column is full'})

@socketio.on('reset_game')
def handle_reset(data):
    game_id = data['gameId']
    
    if game_id in games:
        games[game_id]['board'] = [[None for _ in range(7)] for _ in range(6)]
        games[game_id]['currentPlayer'] = 1
        games[game_id]['winner'] = None
        
        emit('game_reset', games[game_id], room=game_id)

def check_winner(board, row, col):
    player = board[row][col]
    
    # Check horizontal
    for c in range(7 - 3):
        if all(board[row][c + i] == player for i in range(4)):
            return player
    
    # Check vertical
    for r in range(6 - 3):
        if all(board[r + i][col] == player for i in range(4)):
            return player
    
    # Check diagonal (down-right)
    for r in range(6 - 3):
        for c in range(7 - 3):
            if all(board[r + i][c + i] == player for i in range(4)):
                return player
    
    # Check diagonal (down-left)
    for r in range(6 - 3):
        for c in range(3, 7):
            if all(board[r + i][c - i] == player for i in range(4)):
                return player
    
    return None

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)