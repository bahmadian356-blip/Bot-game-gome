// lib/gameService.js
// Manages game sessions, rooms, player pairing, and bot integration.

const supabase = require('./supabase');

function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function createGame({ gameType, hostTelegramId, maxPlayers }) {
  const code = generateGameCode();
  
  // Insert game session
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*') // placeholder to verify structure or use insert
    .limit(1); // just structure check if needed, let's do direct insert

  const { data: createdGame, error: insertError } = await supabase
    .from('games')
    .insert({
      code,
      game_type: gameType,
      host_telegram_id: hostTelegramId,
      max_players: maxPlayers,
      status: 'waiting',
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // Add host as the first player
  await supabase.from('game_players').insert({
    game_id: createdGame.id,
    telegram_id: hostTelegramId,
    is_bot: false,
  });

  return createdGame;
}

async function getGameByCode(code) {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error) return null;
  return data;
}

async function joinGame({ gameCode, telegramId }) {
  const game = await getGameByCode(gameCode);
  if (!game) throw new Error('Game not found');
  if (game.status !== 'waiting') throw new Error('Game has already started or finished');

  // Check current players count
  const { data: players, error: playersError } = await supabase
    .from('game_players')
    .select('*')
    .eq('game_id', game.id);

  if (playersError) throw playersError;

  if (players.some((p) => p.telegram_id === telegramId)) {
    return { game, player: players.find((p) => p.telegram_id === telegramId) };
  }

  if (players.length >= game.max_players) {
    throw new Error('Game is full');
  }

  const { data: newPlayer, error: joinError } = await supabase
    .from('game_players')
    .insert({
      game_id: game.id,
      telegram_id: telegramId,
      is_bot: false,
    })
    .select()
    .single();

  if (joinError) throw joinError;

  return { game, player: newPlayer };
}

async function fillRemainingSeatsWithBots(gameId, maxPlayers, pickBotNameFn) {
  const { data: players } = await supabase
    .from('game_players')
    .select('*')
    .eq('game_id', gameId);

  const currentCount = players ? players.length : 0;
  const needed = maxPlayers - currentCount;

  for (let i = 0; i < needed; i++) {
    const botTelegramId = -1 * Math.floor(Math.random() * 1000000000); // Dummy negative ID for bots
    const botName = pickBotNameFn ? pickBotNameFn() : `Bot_${i + 1}`;

    await supabase.from('game_players').insert({
      game_id: gameId,
      telegram_id: botTelegramId,
      is_bot: true,
      bot_name: botName,
    });
  }
}

async function setGameStatus(gameId, status) {
  await supabase.from('games').update({ status }).eq('id', gameId);
}

async function listPlayers(gameId) {
  const { data } = await supabase.from('game_players').select('*').eq('game_id', gameId);
  return data || [];
}

async function recordGameResult({ gameId, winnerTelegramId, resultData }) {
  await supabase
    .from('games')
    .update({ status: 'finished', winner_telegram_id: winnerTelegramId, result_data: resultData })
    .eq('id', gameId);
}

module.exports = {
  createGame,
  getGameByCode,
  joinGame,
  fillRemainingSeatsWithBots,
  setGameStatus,
  listPlayers,
  recordGameResult,
};
