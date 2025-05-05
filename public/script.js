const canvas = new fabric.Canvas('c', {fireMiddleClick: true});
let zoomLevel = 1;
let selectedId = '';

// Set canvas dimensions to full window
canvas.setHeight(window.innerHeight);
canvas.setWidth(window.innerWidth);
canvas.isDrawingMode = true;

// UI Elements
const drawBtn = document.getElementById('draw');
const eraseBtn = document.getElementById('erase');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');

// Set initial brush settings
canvas.freeDrawingBrush.width = parseInt(brushSize.value, 10);
canvas.freeDrawingBrush.color = colorPicker.value;

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


// Save canvas to image
document.getElementById('save_to_pc').addEventListener('click', () => {
  // Create a temororary canvas to add a white background to any downloaded image
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');

  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;

  // Fill background with white
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Draw Fabric canvas onto it
  ctx.drawImage(canvas.lowerCanvasEl, 0, 0);

	const dataURL = tempCanvas.toDataURL({
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
    const saveDiv = document.getElementById('save_to_cloud_confirm');
    const message = document.getElementById('saveMessage');
    message.textContent = 'Enter a file name';
    
    saveDiv.style.display = 'flex';
    
    return new Promise((resolve) => {
      document.getElementById('save').onclick = async () => {
        let file_name = document.getElementById("save_name").value;
        console.log(file_name);

        if (file_name == ""){
          message.textContent = "Enter a valid file name.";
          return;
        }

        saveDiv.style.display = 'none';

        let user_name = payload.name || payload.username;
        console.log(user_name)
        
        const canvasJson = JSON.stringify(canvas.toJSON());

        const response = await fetch('/api/canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({user: user_name, name: file_name, data: canvasJson })
        });

        const result = await response.json();
        alert(`Saved! Your canvas ID is: ${result.id}`);

        resolve(true);
      };
      
      document.getElementById('cancel').onclick = () => {
        saveDiv.style.display = 'none';
        resolve(false);
      };
    });
  });
  
function parseJWT(token){
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
  ).join(''));

  return JSON.parse(jsonPayload);
}


document.getElementById('canvasSelect').addEventListener('change', (e) => {
  selectedId = e.target.value;
});

document.getElementById('load_from_cloud').addEventListener('click', async () => {
  let name = payload.name || payload.username;
  console.log(name)
  const res = await fetch(`/api/canvases/${name}`); // assumes user is already authenticated
  const canvases = await res.json();
  console.log(canvases)

  const load_menu = document.getElementById('load_menu')

  const select = document.getElementById('canvasSelect');
  select.innerHTML = ''; // clear previous options

  canvases.forEach(c => {
    const option = document.createElement('option');
    console.log(c)
    option.value = c._id;
    option.textContent = c.name;
    select.appendChild(option);
  });

  if (select.childElementCount > 0){
    selectedId = select.children[0].value
  }

  load_menu.style.display = 'block';


  return new Promise((resolve) => {
    document.getElementById('load').onclick = async () => {
      const id = selectedId
      console.log(id)
      const response = await fetch(`/api/canvas/${id}`);
      if (!response.ok){
        alert('Failed to load canvas. Check the ID.');
        return;
      }

      const { data } = await response.json();
      await canvas.loadFromJSON(data, () => {
        canvas.renderAll();
      });

      let canvasObjects = canvas.getObjects('path')
      socket.emit('load_canvas', {room: roomId, canvasObjects})

      load_menu.style.display = 'none';
      resolve(true);
    };
    
    document.getElementById('cancelLoad').onclick = () => {
      load_menu.style.display = 'none';
      resolve(false);
    };
  });


});

// Zoom in/out logic -- buttons deprecated but keeping for future reference as of now
// document.getElementById('zoomIn').onclick = () => {
//   zoomLevel = Math.min(zoomLevel + 0.1, 3); // max 300%
//   canvas.setZoom(zoomLevel);
//   centerViewport();
// };

// document.getElementById('zoomOut').onclick = () => {
//   zoomLevel = Math.max(zoomLevel - 0.1, 0.2); // min 20%
//   canvas.setZoom(zoomLevel);
//   centerViewport();
// };

// Adds zoom listener to the slider
document.getElementById('zoomSlider').addEventListener('input', (event) => {
  zoomLevel = parseFloat(event.target.value);

  // Clamp zoom levels between 20% and 300%
  zoomLevel = Math.max(zoomLevel, 0.2)
  zoomLevel = Math.min(zoomLevel, 3)

  console.log(zoomLevel)

  canvas.setZoom(zoomLevel)
})

// Center canvas on load
window.addEventListener('load', () => {
  setTimeout(centerViewport, 100); // slight delay to ensure layout
});

window.addEventListener('resize', handleResize);
function handleResize() {
  // Update canvas dimensions
  canvas.setHeight(window.innerHeight);
  canvas.setWidth(window.innerWidth);
  
  // Recenter the viewport
  centerViewport();
  
  // Force a re-render
  canvas.renderAll();
}

// Center canvas when zoomed
function centerViewport() {
  const wrapper = document.querySelector('.canvas-wrapper');
  if (!wrapper) return;
  
  const canvasWidth = canvas.getWidth() * zoomLevel;
  const canvasHeight = canvas.getHeight() * zoomLevel;
  
  wrapper.scrollLeft = (canvasWidth - wrapper.clientWidth) / 2;
  wrapper.scrollTop = (canvasHeight - wrapper.clientHeight) / 2;
}

window.onload = () => {
  centerViewport();
};

// Samples for scroll and pan taken from here: https://fabricjs.com/docs/old-docs/fabric-intro-part-5/ with minor tweaks
canvas.on('mouse:wheel', function(opt) {
  let delta = opt.e.deltaY;
  let zoom = canvas.getZoom();
  zoom *= 0.999 ** delta;
  zoom = Math.min(3, Math.max(0.2, zoom));
  zoomLevel = zoom;

  document.getElementById('zoomSlider').value = zoomLevel

  canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
  opt.e.preventDefault();
  opt.e.stopPropagation();
});

canvas.on('mouse:down', function(opt) {
  let evt = opt.e;
  console.log(evt.button);
  if (evt.button == 1) {
    this.isDragging = true;
    this.selection = false;
    this.lastPosX = evt.clientX;
    this.lastPosY = evt.clientY;
  }
});

canvas.on('mouse:move', function(opt) {
  if (this.isDragging) {
    let e = opt.e;
    let vpt = this.viewportTransform;
    vpt[4] += e.clientX - this.lastPosX;
    vpt[5] += e.clientY - this.lastPosY;
    this.requestRenderAll();
    this.lastPosX = e.clientX;
    this.lastPosY = e.clientY;
  }
});
canvas.on('mouse:up', function(opt) {
  this.setViewportTransform(this.viewportTransform);
  this.isDragging = false;
  this.selection = true;
});



// Authentication
const token = localStorage.getItem('token'); 
const payload = JSON.parse(atob(token.split('.')[1])); // Decode JWT payload

// Display username
document.getElementById('usernameDisplay').textContent = `Logged in as: ${payload.name || payload.username}`;

console.log(token)
if (!token) {
  location.href = '/login.html';
}
const userData = parseJWT(token);
const username = userData.name || userData.username; 
document.getElementById('usernameDisplay').textContent = `Logged in as: ${username}`;

//const socket = io()
const socket = io({ auth: { token } }); // connects to same host

const roomType = localStorage.getItem('roomType');
let roomId;

socket.on('room-error', ({ error }) => {
  alert(error || "Failed to join room.");
  location.href = "/lobby.html";
});


socket.on('private-room-created', (pin) => {
  localStorage.setItem('roomPin', pin);
  document.getElementById('roomPinDisplay').textContent = `Room PIN: ${pin}`;
});


async function initRoom() {
  if (roomType === "public") {
    // Ask server to assign public room
    socket.emit("join-public");
  } else if (roomType === "createPrivate") {
    socket.emit("create-private-room");
  } else if (roomType === "joinPrivate") {
    const pin = localStorage.getItem("roomPin");
    socket.emit("join-private-room", { pin });
  }
}


socket.on('room-assigned', ({ roomId, username }) => {
  // Display the username
  document.getElementById('usernameDisplay').textContent = `Logged in as: ${username}`;
  
  // Join the room with the authenticated username
  socket.emit('join-room', { roomId });

  if (roomType === "joinPrivate") {
    const pin = localStorage.getItem("roomPin");
    if (pin) {
      // Display room pin
      document.getElementById('roomPinDisplay').textContent = `Room PIN: ${pin}`;
    }
  }
});


initRoom();
// document.getElementById('load_from_cloud').addEventListener('click', async () => {
//     const id = prompt('Enter the ID of the saved canvas:');
//     if (!id) return;

//     const response = await fetch(`/api/canvas/${id}`);
//     if (!response.ok) {
// 		alert('Failed to load canvas. Check the ID.');
// 		return;
//     }

//     const { data } = await response.json();
//     canvas.loadFromJSON(data, () => {
// 		canvas.renderAll();
//     });
// });


// Drawing sync
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

socket.on('clear', () => {
  canvas.clear();
});

socket.on('load_canvas', (paths) => {
  canvas.clear();
  fabric.util.enlivenObjects(paths, objs => {
    objs.forEach(o => canvas.add(o));
  });
});

canvas.freeDrawingBrush.width = parseInt(brushSize.value, 10);
canvas.freeDrawingBrush.color = colorPicker.value;



// chat box
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

function sendMessage(){
  const msg = chatInput.value.trim();
  if (msg) {
    socket.emit('chat-message', msg);
    chatInput.value = '';
    chatInput.focus();
  }
}

chatSend.addEventListener('click', () => {
  sendMessage();
});

chatInput.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendMessage();
  }
});


socket.on('chat-message', ({ username, message }) => {
  const msgElem = document.createElement('div');
  msgElem.textContent = `${username}: ${message}`;
  chatMessages.appendChild(msgElem);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});


socket.on('chat-history', (messages) => {
  messages.forEach(({ username, message }) => {
    const msgElem = document.createElement('div');
    msgElem.textContent = `${username}: ${message}`;
    chatMessages.appendChild(msgElem);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Horizontal scrolling 
const toolbar = document.getElementById('toolbar');
let isDown = false;
let startX;
let scrollLeft;

toolbar.addEventListener('mousedown', (e) => {
  isDown = true;
  startX = e.pageX - toolbar.offsetLeft;
  scrollLeft = toolbar.scrollLeft;
});

toolbar.addEventListener('mouseleave', () => {
  isDown = false;
});

toolbar.addEventListener('mouseup', () => {
  isDown = false;
});

toolbar.addEventListener('mousemove', (e) => {
  if(!isDown) return;
  e.preventDefault();
  const x = e.pageX - toolbar.offsetLeft;
  const walk = (x - startX) * 2;
  toolbar.scrollLeft = scrollLeft - walk;
});

// Touch support for mobile
toolbar.addEventListener('touchstart', (e) => {
  isDown = true;
  startX = e.touches[0].pageX - toolbar.offsetLeft;
  scrollLeft = toolbar.scrollLeft;
});

toolbar.addEventListener('touchend', () => {
  isDown = false;
});

toolbar.addEventListener('touchmove', (e) => {
  if(!isDown) return;
  const x = e.touches[0].pageX - toolbar.offsetLeft;
  const walk = (x - startX) * 2;
  toolbar.scrollLeft = scrollLeft - walk;
});



// Clear canvas button
document.getElementById('clear').addEventListener('click', () => {
  socket.emit('request-clear');
});

// Handle confirmation request (for other users)
socket.on('confirm-clear-request', () => {
  const confirmDiv = document.getElementById('customConfirm');
  const message = document.getElementById('confirmMessage');
  message.textContent = 'Clear canvas?';
  
  confirmDiv.style.display = 'flex';
  
  return new Promise((resolve) => {
    document.getElementById('confirmYes').onclick = () => {
      confirmDiv.style.display = 'none';
      socket.emit('confirm-clear-vote', true);
      resolve(true);
    };
    
    document.getElementById('confirmNo').onclick = () => {
      confirmDiv.style.display = 'none';
      socket.emit('confirm-clear-vote', false);
      resolve(false);
    };
  });
});

// Handle clear cancellation
socket.on('clear-canceled', () => {
  const confirmDiv = document.getElementById('customConfirm');
  confirmDiv.style.display = 'none';
  // alert(`Clear request canceled.`);
  const custAlert = document.getElementById('customAlert')
  const message = document.getElementById('alertMessage');
  message.textContent = "Clear request canceled"
  custAlert.style.display = 'flex';

  return new Promise((resolve) => {
    document.getElementById('confirm').onclick = () => {
      custAlert.style.display = 'none';
      resolve(true);
    };
  });
});

socket.on('waiting-for-confirmation' ,() =>{
  // alert(`Request made to clear the canvas. Waiting for others to confirm.`);
  const custAlert = document.getElementById('customAlert')
  const message = document.getElementById('alertMessage');
  message.textContent = "Request made to clear the canvas. Waiting for others to confirm."
  custAlert.style.display = 'flex';

  return new Promise((resolve) => {
    document.getElementById('confirm').onclick = () => {
      custAlert.style.display = 'none';
      resolve(true);
    };
  });
});

// Handle successful clear
socket.on('clear-canvas', ()=> {
  clearCanvas();
  // alert(`Canvas cleared!`);
  const custAlert = document.getElementById('customAlert')
  const message = document.getElementById('alertMessage');
  message.textContent = "Canvas cleared!"
  custAlert.style.display = 'flex';

  return new Promise((resolve) => {
    document.getElementById('confirm').onclick = () => {
      custAlert.style.display = 'none';
      resolve(true);
    };
  });
});

// Canvas clearing function
function clearCanvas() {
  canvas.clear();
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush.width = parseInt(brushSize.value, 10);
  canvas.freeDrawingBrush.color = colorPicker.value;
  centerViewport();
}



// Quit Room button
document.getElementById('quitRoom').addEventListener('click', () => {
  const confirmDiv = document.getElementById('customConfirm');
  const message = document.getElementById('confirmMessage');
  message.textContent = 'Are you sure you want to leave this room?';
  
  confirmDiv.style.display = 'flex';
  
  return new Promise((resolve) => {
    document.getElementById('confirmYes').onclick = () => {
      confirmDiv.style.display = 'none';
      // Tell server we're leaving
      socket.emit('leave-room');
      // Redirect to lobby
      window.location.href = '/lobby.html';
      resolve(true);
    };
    
    document.getElementById('confirmNo').onclick = () => {
      confirmDiv.style.display = 'none';
      resolve(false);
    };
  });
});

// Logout button
document.getElementById('logout').addEventListener('click', async () => {
  const confirmDiv = document.getElementById('customConfirm');
  const message = document.getElementById('confirmMessage');
  message.textContent = 'Are you sure you want to logout?';
  
  confirmDiv.style.display = 'flex';
  
  return new Promise((resolve) => {
    document.getElementById('confirmYes').onclick = async () => {
      confirmDiv.style.display = 'none';
      try {
          // Call logout endpoint
          await fetch('/api/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        // Clear local storage and redirect
        localStorage.removeItem('token');
        localStorage.removeItem('roomType');
        localStorage.removeItem('roomPin');
        window.location.href = '/';
      } catch (err) {
        console.error('Logout failed:', err);
        alert('Logout failed. Please try again.');
      }

      resolve(true);
    };
    
    document.getElementById('confirmNo').onclick = () => {
      confirmDiv.style.display = 'none';
      resolve(false);
    };
  });
});