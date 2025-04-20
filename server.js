const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const jwt = require('jsonwebtoken');

const socketIO = require('socket.io');
const app = express();

const server = http.createServer(app);

const JWT_SECRET = 'secret';

const io = socketIO(server,
  {cors: {
    origin: "*",
  }})
const PORT = 3000;

const authRoutes = require('./routes/auth')
app.use(express.json());
app.use(express.static('public'));
app.use('/api', authRoutes)

const rooms = {} // Stores room state {roomId: [{id, username}]}
const canvasStates = {} // Canvas states {roomId: [ Fabric objects ]}

const generateRoomId = () => Math.random().toString(36).substr(2, 6).toUpperCase();
const MAX_USERS = 2;
const publicRooms = [];
const privateRooms = {}; // { pin: roomId }


io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log(token)
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
  socket.on('join-public', ({ username }) => {
    let roomId = publicRooms.find(r => rooms[r] && rooms[r].length < MAX_USERS);

    if (!roomId) {
      roomId = 'public_' + generateRoomId();
      publicRooms.push(roomId);
    }

    socket.emit('room-assigned', roomId);
  });

  socket.on('create-private-room', ({ username }) => {
    const pin = generateRoomId();
    const roomId = 'private_' + pin;
    privateRooms[pin] = roomId;

    socket.emit('private-room-created', pin);
    socket.emit('room-assigned', roomId);
  });

  socket.on('join-private-room', ({ username, pin }) => {
    const roomId = privateRooms[pin];
    if (!roomId) {
      socket.emit('room-error', { error: "Invalid PIN" });
      return;
    }
  
    if (rooms[roomId] && rooms[roomId].length >= MAX_USERS) {
      socket.emit('room-error', { error: "Private room is full." });
      return;
    }

    socket.emit('room-assigned', roomId);
  });

  socket.on('join-room', ({ roomId, username }) => {
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