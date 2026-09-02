// server.js
// Main entrypoint: Express API + static Mini App hosting + Telegram webhook
// + Socket.io realtime bridge, all in one Render service.

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server: SocketIOServer } = require('socket.io');

const { createBot } = require('./bot/bot');
const { requireTelegramAuth } = require('./lib/telegramAuth');
const { getOrCreateProfile, getLeaderboard } = require('./lib/userService');
const gameService = require('./lib/gameService');
const battleship = require('./games/battleship/battleship');
const { pickBotName } = require('./lib/aiPlayerService');
const supabase = require('./lib/supabase');

// ---- Detect this service's own public URL automatically (no manual env var) ----
// Render injects RENDER_EXTERNAL_URL automatically at runtime.
function detectBaseUrl() {
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
  if (process.env.BASE_URL) return process.env.BASE_URL; // manual override, optional
  return null; // local dev — bot falls back to polling, Mini App served on localhost
}

const BASE_URL = detectBaseUrl();
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Health check (required by Render) ----
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// ---- Telegram Bot ----
const bot = createBot(BASE_URL);
if (bot && bot._webhookPath) {
  app.post(bot._webhookPath, express.json(), (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
}

// ---- Runtime config exposed to the Mini App (no secrets) ----
app.get('/api/config', (req, res) => {
  res.json({
    botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
    baseUrl: BASE_URL,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || null,
  });
});

// ---- Auth: exchange initData for a trusted profile ----
app.post('/api/auth/verify', requireTelegramAuth, async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.telegramUser);
    res.json({ profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ---- Leaderboard ----
app.get('/api/leaderboard', async (req, res) => {
  try {
    const board = await getLeaderboard(50);
    res.json({ leaderboard: board });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ---- Create a game (any type) ----
app.post('/api/games', requireTelegramAuth, async (req, res) => {
  const { gameType, maxPlayers } = req.body;
  const validTypes = { battleship: 2, ludo: 4, tictactoe: 2, rps: 2 };
  if (!validTypes[gameType]) return res.status(400).json({ error: 'Unknown game type' });

  try {
    const game = await gameService.createGame({
      gameType,
      hostTelegramId: req.telegramUser.id,
      maxPlayers: maxPlayers || validTypes[gameType],
    });
    res.json({ game, inviteLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=game_${game.code}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// ---- Join a game by code ----
app.post('/api/games/:code/join', requireTelegramAuth, async (req, res) => {
  try {
    const { game, player } = await gameService.joinGame({
      gameCode: req.params.code,
      telegramId: req.telegramUser.id,
    });
    io.to(`game:${game.id}`).emit('player_joined', { player });
    res.json({ game, player });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- Start a game vs Bot (fills remaining seats with Bots immediately) ----
app.post('/api/games/:code/start-vs-bot', requireTelegramAuth, async (req, res) => {
  try {
    const game = await gameService.getGameByCode(req.params.code);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    await gameService.fillRemainingSeatsWithBots(game.id, game.max_players, pickBotName);

    if (game.game_type === 'battleship') {
      const players = await gameService.listPlayers(game.id);
      const botPlayer = players.find((p) => p.is_bot);
      if (botPlayer) {
        const { board } = battleship.randomShipPlacement();
        const ships = battleship.randomShipPlacement().ships;
        await battleship.saveBoard(game.id, null, true, ships);
      }
    }

    await gameService.setGameStatus(game.id, 'active');
    io.to(`game:${game.id}`).emit('game_started', { gameId: game.id });
    res.json({ status: 'active' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start game vs bot' });
  }
});

// ---- Battleship: submit ship placement ----
app.post('/api/games/:code/battleship/place', requireTelegramAuth, async (req, res) => {
  try {
    const game = await gameService.getGameByCode(req.params.code);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const { ships } = req.body;
    if (!battleship.validatePlacement(ships)) {
      return res.status(400).json({ error: 'Invalid ship placement' });
    }

    await battleship.saveBoard(game.id, req.telegramUser.id, false, ships);
    io.to(`game:${game.id}`).emit('player_ready', { telegramId: req.telegramUser.id });
    res.json({ status: 'placed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save placement' });
  }
});

// ---- Battleship: fire a shot ----
app.post('/api/games/:code/battleship/shoot', requireTelegramAuth, async (req, res) => {
  try {
    const game = await gameService.getGameByCode(req.params.code);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const { row, col, targetIsBot } = req.body;
    const shotResult = await battleship.applyShot({
      gameId: game.id,
      shooterTelegramId: req.telegramUser.id,
      targetIsBot: Boolean(targetIsBot),
      row,
      col,
    });

    io.to(`game:${game.id}`).emit('shot_fired', { row, col, ...shotResult, by: req.telegramUser.id });

    if (shotResult.allSunk) {
      await gameService.recordGameResult({
        gameId: game.id,
        winnerTelegramId: req.telegramUser.id,
        resultData: { finalRow: row, finalCol: col },
      });
      const { applyGameResult } = require('./lib/userService');
      await applyGameResult(req.telegramUser.id, true);
      io.to(`game:${game.id}`).emit('game_over', { winnerTelegramId: req.telegramUser.id });
    } else if (targetIsBot) {
      // Bot's turn: pick and apply its shot after a human-like delay
      const botShot = await battleship.pickBotShot(game.id);
      setTimeout(async () => {
        try {
          const botResult = await battleship.applyShot({
            gameId: game.id,
            shooterTelegramId: null,
            targetIsBot: false,
            row: botShot.row,
            col: botShot.col,
          });
          io.to(`game:${game.id}`).emit('shot_fired', {
            row: botShot.row,
            col: botShot.col,
            ...botResult,
            by: 'bot',
          });
          if (botResult.allSunk) {
            await gameService.recordGameResult({ gameId: game.id, winnerTelegramId: null, resultData: {} });
            const { applyGameResult: applyLoss } = require('./lib/userService');
            await applyLoss(req.telegramUser.id, false);
            io.to(`game:${game.id}`).emit('game_over', { winnerTelegramId: null });
          }
        } catch (e) {
          console.error('[bot shot] error:', e.message);
        }
      }, botShot.delayMs);
    }

    res.json(shotResult);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process shot' });
  }
});

// ---- Chat: send + fetch messages for a game room ----
app.post('/api/games/:code/chat', requireTelegramAuth, async (req, res) => {
  try {
    const game = await gameService.getGameByCode(req.params.code);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const { message } = req.body;
    const { data, error } = await supabase
      .from('game_chat_messages')
      .insert({ game_id: game.id, telegram_id: req.telegramUser.id, message })
      .select()
      .single();
    if (error) throw error;

    io.to(`game:${game.id}`).emit('chat_message', data);
    res.json({ chatMessage: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ---- Socket.io: room join for realtime game/chat updates ----
io.on('connection', (socket) => {
  socket.on('join_room', (gameId) => {
    socket.join(`game:${gameId}`);
  });
  socket.on('leave_room', (gameId) => {
    socket.leave(`game:${gameId}`);
  });
});

// SPA fallback: unmatched non-API routes serve the Mini App shell
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/telegram-webhook')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`[server] BEHI PLAY listening on port ${PORT}`);
  console.log(`[server] Base URL: ${BASE_URL || '(not detected — local dev mode)'}`);
});
