// public/app.js
const socket = io();
const tg = window.Telegram.WebApp;

tg.ready();
tg.expand();

const initData = tg.initData || '';
let currentUser = null;
let currentGameCode = null;

// Authenticate and load profile on start
async function initApp() {
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData })
    });
    const data = await res.json();
    if (data.profile) {
      currentUser = data.profile;
      document.getElementById('user-info').innerText = `سلام، ${currentUser.first_name}!`;
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
    document.getElementById('user-info').innerText = 'کاربر مهمان';
  }
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

async function startBattleshipGame() {
  try {
    const res = await fetch('/api/games/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, gameType: 'battleship', maxPlayers: 1 })
    });
    const data = await res.json();
    if (data.game) {
      currentGameCode = data.game.code;
      document.getElementById('code-text').innerText = currentGameCode;
      showScreen('lobby-screen');
      socket.emit('join_room', { gameCode: currentGameCode });
    }
  } catch (err) {
    alert('خطا در ایجاد بازی');
  }
}

async function startVsBot() {
  socket.emit('start_vs_bot', { gameCode: currentGameCode });
  showScreen('game-screen');
  renderBattleshipBoard();
}

function renderBattleshipBoard() {
  const container = document.getElementById('battleship-board-container');
  container.innerHTML = '';
  
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(5, 40px)';
  grid.style.gap = '4px';
  grid.style.margin = '0 auto';

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = document.createElement('div');
      cell.style.width = '40px';
      cell.style.height = '40px';
      cell.style.background = 'rgba(255,255,255,0.1)';
      cell.style.borderRadius = '4px';
      cell.style.cursor = 'pointer';
      cell.onclick = () => alert(`شلیک به خانه: ردیف ${r}، ستون ${c}`);
      grid.appendChild(cell);
    }
  }
  container.appendChild(grid);
}

socket.on('player_joined', (data) => {
  document.getElementById('players-list').innerText = `بازیکنان حاضر: ${data.players.length}`;
});

initApp();
