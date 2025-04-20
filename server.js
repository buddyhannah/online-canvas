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
  email: { type: String, unique: true }
});


const User = mongoose.model('User', userSchema);

const server = http.createServer(app);

const io = socketIO(server,
  {cors: {
    origin: "*",
  }})
const PORT = 3000;

//const authRoutes = require('./routes/auth')
app.use(express.json());
app.use(express.static('public'));
//app.use('/api', authRoutes)

const rooms = {} // Stores room state {roomId: [{id, username}]}
const canvasStates = {} // Canvas states {roomId: [ Fabric objects ]}

const generateRoomId = () => Math.random().toString(36).substr(2, 6).toUpperCase();
const MAX_USERS = 2;
const publicRooms = [];
const privateRooms = {}; // { pin: roomId }

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
      email: email || null
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

    socket.on('draw', (data) => {
      canvasStates[roomId].push(data);
      socket.to(roomId).emit('draw', data);
    });

    socket.on('disconnect', () => {
      if (!rooms[roomId]) return;
      rooms[roomId] = rooms[roomId].filter(u => u.id !== socket.id);
      io.to(roomId).emit('room-users', rooms[roomId]);
    });
  });
});



server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`))

mongoose.connect('mongodb://localhost:27017/drawapp').then(() => {
  console.log('MongoDB connected');
  app.listen(3000, () => console.log('Server running on http://localhost:3000'));
});