// games/battleship/battleship.js
// Battleship game rules, ship placement validation, and shot processing logic.

const supabase = require('../../lib/supabase');

function randomShipPlacement() {
  // Simplified random placement generator for bot
  const ships = [
    { size: 3, row: 0, col: 0, horizontal: true },
    { size: 2, row: 2, col: 0, horizontal: false },
  ];
  return { ships };
}

function validatePlacement(ships) {
  if (!Array.isArray(ships) || ships.length === 0) return false;
  // Basic validation rules can be expanded here
  return true;
}

async function saveBoard(gameId, telegramId, isBot, ships) {
  await supabase.from('battleship_boards').insert({
    game_id: gameId,
    telegram_id: isBot ? null : telegramId,
    is_bot: isBot,
    ships_json: ships,
  });
}

async function applyShot({ gameId, shooterTelegramId, targetIsBot, row, col }) {
  // Fetch target board
  const query = supabase.from('battleship_boards').select('*').eq('game_id', gameId);
  if (targetIsBot) {
    query.eq('is_bot', true);
  } else {
    query.neq('is_bot', true).neq('telegram_id', shooterTelegramId);
  }

  const { data: boards } = await query;
  const board = boards ? boards[0] : null;

  if (!board) throw new Error('Target board not found');

  const ships = board.ships_json || [];
  let hit = false;

  for (const ship of ships) {
    for (let i = 0; i < ship.size; i++) {
      const r = ship.row + (ship.horizontal ? 0 : i);
      const c = ship.col + (ship.horizontal ? i : 0);
      if (r === row && c === col) {
        hit = true;
        break;
      }
    }
    if (hit) break;
  }

  return { hit, allSunk: false };
}

async function pickBotShot(gameId) {
  // Pick random coordinates for bot shot
  const row = Math.floor(Math.random() * 5);
  const col = Math.floor(Math.random() * 5);
  return { row, col, delayMs: 1500 };
}

module.exports = {
  randomShipPlacement,
  validatePlacement,
  saveBoard,
  applyShot,
  pickBotShot,
};
