const express = require('express');
const http = require('http');

const socketIO = require('socket.io');
const app = express();

const server = http.createServer(app);
const io = socketIO(server)
const PORT = 3000;

app.use(express.static('public'));

const rooms = {} // Stores room state {roomId: [{id, username}]}
const canvasStates = {} // Canvas states {roomId: [ Fabric objects ]}

io.on('connection', (socket) => {
  socket.on('join-room', ({roomId, username}) => {
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
// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });