const express = require('express');
const mongoose = require('mongoose');
const http = require('http');


const socketIO = require('socket.io');
const app = express();

const server = http.createServer(app);
const io = socketIO(server)
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// TODO: Change this to the db for the actual project -R 4/20/25
mongoose.connect('mongodb://localhost:27017/fabricCanvasApp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});


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
  } catch (err) {
    res.status(400).json({ error: 'Invalid ID format' });
  }
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`))
// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });