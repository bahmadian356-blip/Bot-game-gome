// bot/bot.js
// Telegram Bot client setup, command handlers, and Webhook/Polling configuration.

const TelegramBot = require('node-telegram-bot-api');

function createBot(baseUrl) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[bot] Missing TELEGRAM_BOT_TOKEN in environment.');
    return null;
  }

  let bot;
  if (baseUrl) {
    // Production mode: use webhook
    bot = new TelegramBot(token, { webHook: true });
    const webhookUrl = `${baseUrl}/telegram-webhook-${token}`;
    bot.setWebHook(webhookUrl);
    bot._webhookPath = `/telegram-webhook-${token}`;
    console.log(`[bot] Webhook configured at ${webhookUrl}`);
  } else {
    // Local development mode: use long polling
    bot = new TelegramBot(token, { polling: true });
    console.log('[bot] Running in polling mode for local development');
  }

  // Handle /start command
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const startPayload = match[1]; // e.g. game_XYZ123

    const webAppUrl = process.env.RENDER_EXTERNAL_URL || 'https://example.com';

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎮 Play BEHI PLAY',
              web_app: { url: webAppUrl },
            },
          ],
        ],
      },
    };

    if (startPayload && startPayload.startsWith('game_')) {
      const gameCode = startPayload.replace('game_', '');
      opts.reply_markup.inline_keyboard.unshift([
        {
          text: `🚀 Join Game (${gameCode})`,
          web_app: { url: `${webAppUrl}?join=${gameCode}` },
        },
      ]);
    }

    await bot.sendMessage(
      chatId,
      'Welcome to **BEHI PLAY**! 🚢🎮\n\nChallenge your friends or play against AI right inside Telegram.',
      { parse_mode: 'Markdown', ...opts }
    );
  });

  return bot;
}

module.exports = { createBot };
