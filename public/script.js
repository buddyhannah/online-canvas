const canvas = new fabric.Canvas('c');
canvas.setHeight(window.innerHeight);
canvas.setWidth(window.innerWidth);

canvas.isDrawingMode = true;

const drawBtn = document.getElementById('draw');
const eraseBtn = document.getElementById('erase');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');


// Drawing brush
drawBtn.addEventListener('click', () => {
    canvas.isDrawingMode = true;
    setActiveTool('draw');
});


// Eraser brush
eraseBtn.addEventListener('click', () => {
    canvas.isDrawingMode = true;
    setActiveTool('erase');
  });


// Set highlight for currently selected tool
function setActiveTool(tool) {
    drawBtn.classList.remove('active');
    eraseBtn.classList.remove('active');
  
    if (tool === 'draw') {
      drawBtn.classList.add('active');
      canvas.freeDrawingBrush.color = colorPicker.value;
    } else if (tool === 'erase') {
      eraseBtn.classList.add('active');
      canvas.freeDrawingBrush.color = 'white';
    }
  }


// Pick drawing color
colorPicker.addEventListener('input', () => {
  canvas.freeDrawingBrush.color = colorPicker.value;
});


// Brush size adjustment slider
brushSize.addEventListener('input', () => {
  canvas.freeDrawingBrush.width = parseInt(brushSize.value, 10);
});


// Clear canvas
document.getElementById('clear').addEventListener('click', () => {
    canvas.clear();
  });

// Save canvas to image
document.getElementById('save_to_pc').addEventListener('click', () => {
	const dataURL = canvas.toDataURL({
		format: 'png',
		quality: 1.0
	});

	// Create a download link
	const link = document.createElement('a');
	link.href = dataURL;
	link.download = 'canvas.png';
	link.click();
  });

//Save canvas to database
document.getElementById('save_to_cloud').addEventListener('click', async () => {
    const canvasJson = JSON.stringify(canvas.toJSON());

    const response = await fetch('/api/canvas', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ data: canvasJson })
    });

    const result = await response.json();
    alert(`Saved! Your canvas ID is: ${result.id}`);
  });
  
document.getElementById('load_from_cloud').addEventListener('click', async () => {
    const id = prompt('Enter the ID of the saved canvas:');
    if (!id) return;

    const response = await fetch(`/api/canvas/${id}`);
    if (!response.ok) {
		alert('Failed to load canvas. Check the ID.');
		return;
    }

    const { data } = await response.json();
    canvas.loadFromJSON(data, () => {
		canvas.renderAll();
    });
});

const socket = io(); // connects to same host
const username = prompt("Enter your username:");
const roomId = prompt("Enter room ID:");
socket.emit('join-room', { roomId, username });

canvas.on('path:created', (e) => {
  const pathData = e.path.toObject();
  socket.emit('draw', pathData);
});

socket.on('draw', (pathData) => {
  fabric.util.enlivenObjects([pathData], objs => {
    objs.forEach(o => canvas.add(o));
  });
});

socket.on('room-users', (users) => {
  const userList = document.getElementById('userList');
  userList.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u.username;
    userList.appendChild(li);
  });
});

socket.on('canvas-init', (paths) => {
  fabric.util.enlivenObjects(paths, objs => {
    objs.forEach(o => canvas.add(o));
  });
});

canvas.freeDrawingBrush.width = parseInt(brushSize.value, 10);
canvas.freeDrawingBrush.color = colorPicker.value;