const { OAuth2Client } = require('google-auth-library');
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); 


const GOOGLE_CLIENT_ID = '285764603520-vs2t9u0d04ntigqenoj607dk02iv9i39.apps.googleusercontent.com';
const JWT_SECRET = 'secret';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);


const socketIO = require('socket.io');
const app = express();

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  email: { 
    type: String, 
    unique: true,
    sparse: true // This allows multiple null values
  }
});


const clearVotes = {}; // { roomId: Set of usernames who voted to clear }
const clearVoteSessions = {}; // { [roomId]: { voters: Set<socket.id>, voteCount: number } }




const User = mongoose.model('User', userSchema);

const server = http.createServer(app);

const io = socketIO(server,
  {cors: {
    origin: "*",
  }})
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));


const rooms = {} // Stores room state {roomId: [{id, username}]}
const canvasStates = {} // Canvas states {roomId: [ Fabric objects ]}

const generateRoomId = () => Math.random().toString(36).substr(2, 6).toUpperCase();
const MAX_USERS = 4;
const publicRooms = [];
const privateRooms = {}; // { pin: roomId }

const chatHistory = {}; // { roomId: [ { username, message } ] }


// Registration endpoint
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = new User({
      username,
      passwordHash,
      email: email || undefined 
    });

    await newUser.save();

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Manual login endpoint
app.post('/api/manual-login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});



app.post('/api/google-login', async (req, res) => {
  const { id_token } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const username = payload.name;

    let user = await User.findOne({ username });

    if (!user) {
      user = new User({ username, email: payload.email });
      await user.save();
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Invalid ID token' });
  }
});



io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  //console.log(token)
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload; // store user info
    next();
  } catch (err) {
    console.log(err)
    console.log("Unauthorized")
    next(new Error("Unauthorized"));
  }
});

io.on('connection', (socket) => {
  socket.on('join-public', () => {
    const username = socket.user.username;
    let roomId = publicRooms.find(r => rooms[r] && rooms[r].length < MAX_USERS);

    if (!roomId) {
      roomId = 'public_' + generateRoomId();
      publicRooms.push(roomId);
    }

    socket.emit('room-assigned', { roomId, username });
  });

  socket.on('create-private-room', () => {
    const pin = generateRoomId();
    const roomId = 'private_' + pin;
    privateRooms[pin] = roomId;
    const username = socket.user.username;

    socket.emit('private-room-created', pin);
    socket.emit('room-assigned', { roomId, username });
  });

  socket.on('join-private-room', ({ pin }) => {
    const roomId = privateRooms[pin];
    const username = socket.user.username;

    if (!roomId) {
      socket.emit('room-error', { error: "Invalid PIN" });
      return;
    }
  
    if (rooms[roomId] && rooms[roomId].length >= MAX_USERS) {
      socket.emit('room-error', { error: "Private room is full." });
      return;
    }

    socket.emit('room-assigned', { roomId, username });
  });

  socket.on('join-room', ({ roomId }) => {
    const username = socket.user.username;
    rooms[roomId] = rooms[roomId] || [];
    clearVotes[roomId] = new Set();
    canvasStates[roomId] = canvasStates[roomId] || [];

    if (rooms[roomId].length >= MAX_USERS) {
      socket.emit('room-full');
      return;
    }

    rooms[roomId].push({ id: socket.id, username });
    socket.join(roomId);

    console.log(`User ${username} joined room: ${roomId}`);

    io.to(roomId).emit('room-users', rooms[roomId]);
    socket.emit('canvas-init', canvasStates[roomId]);

    // Display the previous chat messages
    socket.emit('chat-history', chatHistory[roomId] || []);

    socket.on('draw', (data) => {
      canvasStates[roomId].push(data);
      socket.to(roomId).emit('draw', data);
    });


    // for clearing 
    socket.on('request-clear', () => {
      const userIds = rooms[roomId].map(s => s.id); // get current user IDs in room
      clearVoteSessions[roomId] = {
        voters: new Set(userIds),
        voteCount: 1
      };
      clearVotes[roomId] = new Set([socket.id]);
    
      // Ask others to confirm
      socket.broadcast.to(roomId).emit('confirm-clear-request');
    
      // Notify all of vote status
      io.to(roomId).emit('clear-vote-update', {
        totalVotes: 1,
        totalUsers: userIds.length
      });
    
      if (userIds.length === 1) {
        // Auto-clear if only one person
        canvasStates[roomId] = [];
        io.to(roomId).emit('clear-canvas');
        delete clearVoteSessions[roomId];
        clearVotes[roomId].clear();
      }
    });
    
    
    socket.on('confirm-clear-vote', (confirmed) => {
      const session = clearVoteSessions[roomId];
      if (!session || !session.voters.has(socket.id)) return; // Ignore latecomers
    
      if (!confirmed) {
        io.to(roomId).emit('clear-canceled');
        delete clearVoteSessions[roomId];
        clearVotes[roomId].clear();
        return;
      }
    
      clearVotes[roomId].add(socket.id);
      session.voteCount = clearVotes[roomId].size;
    
      io.to(roomId).emit('clear-vote-update', {
        totalVotes: session.voteCount,
        totalUsers: session.voters.size
      });
    
      if (session.voteCount === session.voters.size) {
        canvasStates[roomId] = [];
        io.to(roomId).emit('clear-canvas');
        delete clearVoteSessions[roomId];
        clearVotes[roomId].clear();
      }
    });
    
    
    socket.on('cancel-clear-vote', () => {
      clearVotes[roomId].delete(socket.user.username);
      const votes = clearVotes[roomId].size;
      const totalUsers = rooms[roomId].length;
      io.to(roomId).emit('clear-vote-update', { totalVotes: votes, totalUsers });
    });
    
   
  
    socket.on('disconnect', () => {
      if (!rooms[roomId]) return;

      // Remove user from room
      rooms[roomId] = rooms[roomId].filter(u => u.id !== socket.id);
      io.to(roomId).emit('room-users', rooms[roomId]);

      // If room is empty, clean up
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        delete canvasStates[roomId];
        delete clearVotes[roomId];
        delete chatHistory[roomId];


        if (roomId.startsWith('public_')) {
          const index = publicRooms.indexOf(roomId);
          if (index !== -1) publicRooms.splice(index, 1);
        } else if (roomId.startsWith('private_')) {
          const pin = roomId.split('_')[1];
          delete privateRooms[pin];
        }

        console.log(`Deleted ${roomId}`);
      }
    });

    if (clearVoteSessions[roomId]) {
      io.to(roomId).emit('clear-canceled');
      delete clearVoteSessions[roomId];
      clearVotes[roomId].clear();
    }
    
      
    // Chat message sent
    socket.on('chat-message', (message) => {
      const username = socket.user.username;
      const userRoom = Object.entries(rooms).find(([roomId, users]) =>
        users.some(u => u.id === socket.id)
      );
      if (userRoom) {
        const roomId = userRoom[0];
        const chatEntry = { username, message };

        chatHistory[roomId] = chatHistory[roomId] || [];

        // Only store the latest 20 chats
        chatHistory[roomId].push(chatEntry);
        if (chatHistory[roomId].length > 20) {
          chatHistory[roomId].shift();
        }

        io.to(roomId).emit('chat-message', chatEntry);
      }
    });

  });
});

// define schema
const canvasSchema = new mongoose.Schema({
  data: String
});

const Canvas = mongoose.model('Canvas', canvasSchema);

// Save canvas (POST)
app.post('/api/canvas', async (req, res) => {
  const newCanvas = new Canvas({ data: req.body.data });
  const savedCanvas = await newCanvas.save();
  res.json({ id: savedCanvas._id });
});

// Load canvas by ID (GET)
app.get('/api/canvas/:id', async (req, res) => {
  try {
    const canvas = await Canvas.findById(req.params.id);
    if (!canvas) return res.status(404).json({ error: 'Canvas not found' });
    res.json({ data: canvas.data });
  } catch (error) {
    res.status(400).json({ error: 'Invalid ID format' });
  }
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`))

mongoose.connect('mongodb://localhost:27017/drawapp').then(() => {
  console.log('MongoDB connected');
  //app.listen(3000, () => console.log('Server running on http://localhost:3000'));
});


