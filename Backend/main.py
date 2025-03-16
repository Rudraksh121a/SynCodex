from flask import Flask, request, jsonify, render_template
from flask_socketio import SocketIO, join_room, leave_room, send, emit
from flask_cors import CORS
import uuid

app = Flask(__name__, template_folder="templates") 
CORS(app)  
socketio = SocketIO(app, cors_allowed_origins="*")


rooms = {}

@app.route('/')
def index():
    """Render the HTML chat UI."""
    return render_template('index.html')

@app.route('/create-room', methods=['POST'])
def create_room():
    """Create a new chat room."""
    room_id = str(uuid.uuid4())[:8]
    rooms[room_id] = {"users": [], "messages": []}
    return jsonify({"room_id": room_id, "message": "Room created successfully"}), 201

@app.route('/join-room', methods=['POST'])
def join_room_api():
    """Join an existing room."""
    data = request.get_json()
    room_id = data.get("room_id")
    username = data.get("username")

    if not room_id or not username:
        return jsonify({"error": "Room ID and username are required"}), 400

    if room_id not in rooms:
        return jsonify({"error": "Room does not exist"}), 404

    if username not in rooms[room_id]["users"]:
        rooms[room_id]["users"].append(username)

    return jsonify({"message": f"{username} joined room {room_id}"}), 200

@app.route('/messages/<room_id>', methods=['GET'])
def get_messages(room_id):
    """Get chat history of a room."""
    if room_id in rooms:
        return jsonify({"room_id": room_id, "messages": rooms[room_id]["messages"]})
    return jsonify({"error": "Room not found"}), 404

# WebSocket Events
@socketio.on('join')
def handle_join(data):
    room_id = data["room_id"]
    username = data["username"]

    if room_id in rooms:
        join_room(room_id)
        send(f"{username} has joined the chat", room=room_id)
    else:
        send("Room does not exist", room=request.sid)

@socketio.on('send-message')
def handle_message(data):
    room_id = data["room_id"]
    username = data["username"]
    message = data["message"]

    if room_id in rooms:
        chat_message = {"user": username, "message": message}
        rooms[room_id]["messages"].append(chat_message)
        emit("receive-message", chat_message, room=room_id)
    else:
        send("Room does not exist", room=request.sid)

@socketio.on('leave')
def handle_leave(data):
    room_id = data["room_id"]
    username = data["username"]

    leave_room(room_id)
    send(f"{username} has left the chat", room=room_id)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)


# Create Room: http://localhost:5000/create-room
# Join Room: http://localhost:5000/join-room
# Get Messages: http://localhost:5000/messages/<room_id>
# WebSocket Server: http://localhost:5000

# Check the Backend/templates/index.html file for referencec
