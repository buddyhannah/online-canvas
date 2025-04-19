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
  
function parseJWT(token){
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  ).join(''));

  return JSON.parse(jsonPayload);
}

const token = localStorage.getItem('token');
console.log(token)
if (!token) {
  location.href = '/login.html';
}

const userData = parseJWT(token);
console.log(userData)

//const socket = io()
const socket = io({ auth: { token } }); // connects to same host
const username = userData.displayName;
// const username = prompt("Enter your username:");
const roomId = prompt("Enter room ID:");
socket.emit('join-room', { roomId, username });

document.getElementById('usernameDisplay').textContent = `Logged in as: ${username}`;

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