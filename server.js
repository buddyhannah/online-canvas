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
  socket.on('join-room', ({roomId, username}) => {
    console.log(`${username} connected`);
    rooms[roomId] = rooms[roomId] || [];
    canvasStates[roomId] = canvasStates[roomId] || [];

    // Denies connection
    // TODO: AS of now this just breaks the app, so fix to requery for a valid roomID
    if (rooms[roomId].length >= 4) {
      socket.emit('room-full');
      return;
    }

    rooms[roomId].push({ id: socket.id, username });
    socket.join(roomId);

    socket.join(roomId);
    console.log(`Client joined room: ${roomId}`);

    // Notify others
    io.to(roomId).emit('room-users', rooms[roomId]);

    // Send current canvas state to new user
    socket.emit('canvas-init', canvasStates[roomId]);

    socket.on('draw', (data) => {
      // Broadcast to everyone else in the room
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