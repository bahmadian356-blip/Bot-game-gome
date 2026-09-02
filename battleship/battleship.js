// games/battleship/battleship.js
// Authoritative server-side Battleship logic. Board state and hits/misses are
// always computed and stored here — the client only renders what the server sends.

const supabase = require('../../lib/supabase');
const { randomChoice, humanLikeDelayMs } = require('../../lib/aiPlayerService');

const BOARD_SIZE = 10;
const SHIP_SIZES = [5, 4, 3, 3, 2]; // Carrier, Battleship, Cruiser, Submarine, Destroyer

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

/** Randomly places all ships for a board (used for Bot players). */
function randomShipPlacement() {
  const board = emptyBoard();
  const ships = [];

  for (const size of SHIP_SIZES) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);
      const cells = [];
      let fits = true;

      for (let i = 0; i < size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        if (r >= BOARD_SIZE || c >= BOARD_SIZE || board[r][c] !== 0) {
          fits = false;
          break;
        }
        cells.push([r, c]);
      }

      if (fits) {
        cells.forEach(([r, c]) => (board[r][c] = 1));
        ships.push({ size, cells, hits: [] });
        placed = true;
      }
    }
  }

  return { board, ships };
}

/** Validates a manual placement submitted by a human player. */
function validatePlacement(ships) {
  if (!Array.isArray(ships) || ships.length !== SHIP_SIZES.length) return false;
  const occupied = new Set();
  const sizesUsed = [...SHIP_SIZES].sort();
  const givenSizes = ships.map((s) => s.cells.length).sort();
  if (JSON.stringify(sizesUsed) !== JSON.stringify(givenSizes)) return false;

  for (const ship of ships) {
    for (const [r, c] of ship.cells) {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
      const key = `${r},${c}`;
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }
  return true;
}

/** Stores a player's board (ships + cells) for a given game. */
async function saveBoard(gameId, telegramId, isBot, ships) {
  const { error } = await supabase.from('battleship_boards').insert({
    game_id: gameId,
    telegram_id: isBot ? null : telegramId,
    is_bot: isBot,
    ships,
  });
  if (error) throw error;
}

async function getBoard(gameId, ownerKey) {
  const { data, error } = await supabase
    .from('battleship_boards')
    .select('*')
    .eq('game_id', gameId)
    .eq('is_bot', ownerKey.isBot)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Applies a shot at (row,col) against the target's ships. Returns {result, sunk, allSunk}. */
async function applyShot({ gameId, shooterTelegramId, targetIsBot, row, col }) {
  const { data: targetBoard, error } = await supabase
    .from('battleship_boards')
    .select('*')
    .eq('game_id', gameId)
    .eq('is_bot', targetIsBot)
    .single();
  if (error) throw error;

  const ships = targetBoard.ships;
  let result = 'miss';
  let sunkShip = null;

  for (const ship of ships) {
    const idx = ship.cells.findIndex(([r, c]) => r === row && c === col);
    if (idx !== -1) {
      if (!ship.hits.some(([r, c]) => r === row && c === col)) {
        ship.hits.push([row, col]);
      }
      result = ship.hits.length === ship.cells.length ? 'sunk' : 'hit';
      if (result === 'sunk') sunkShip = ship;
      break;
    }
  }

  await supabase.from('battleship_boards').update({ ships }).eq('id', targetBoard.id);

  await supabase.from('battleship_shots').insert({
    game_id: gameId,
    shooter_telegram_id: shooterTelegramId,
    target_is_bot: targetIsBot,
    row,
    col,
    result,
  });

  const allSunk = ships.every((s) => s.hits.length === s.cells.length);

  return { result, sunkShip, allSunk };
}

/** Picks the Bot's next shot: simple hunt-and-target AI (not fully random once a hit lands). */
async function pickBotShot(gameId) {
  const { data: shots, error } = await supabase
    .from('battleship_shots')
    .select('*')
    .eq('game_id', gameId)
    .eq('target_is_bot', false);
  if (error) throw error;

  const shotCells = new Set(shots.map((s) => `${s.row},${s.col}`));
  const lastHit = [...shots].reverse().find((s) => s.result === 'hit');

  const candidates = [];
  if (lastHit) {
    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of deltas) {
      const r = lastHit.row + dr;
      const c = lastHit.col + dc;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && !shotCells.has(`${r},${c}`)) {
        candidates.push([r, c]);
      }
    }
  }

  if (candidates.length === 0) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!shotCells.has(`${r},${c}`)) candidates.push([r, c]);
      }
    }
  }

  const [row, col] = randomChoice(candidates);
  return { row, col, delayMs: humanLikeDelayMs() };
}

module.exports = {
  BOARD_SIZE,
  SHIP_SIZES,
  randomShipPlacement,
  validatePlacement,
  saveBoard,
  getBoard,
  applyShot,
  pickBotShot,
};
