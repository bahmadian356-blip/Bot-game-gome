// bot/bot.js
// Initializes the Telegram Bot. Uses webhook mode in production (Render),
// falls back to polling only if no public base URL is available (local dev).

const TelegramBot = require('node-telegram-bot-api');
const { registerCommands } = require('./commands');

function createBot(baseUrl) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[bot] TELEGRAM_BOT_TOKEN is not set — bot will not start.');
    return null;
  }

  const useWebhook = Boolean(baseUrl);
  const bot = new TelegramBot(token, { polling: !useWebhook });

  if (useWebhook) {
    const webhookPath = `/telegram-webhook/${token}`;
    bot.setWebHook(`${baseUrl}${webhookPath}`).catch((err) => {
      console.error('[bot] Failed to set webhook:', err.message);
    });
    bot._webhookPath = webhookPath; // consumed by server.js to mount the route
  } else {
    console.warn('[bot] No public base URL detected — falling back to polling (dev mode).');
  }

  registerCommands(bot, baseUrl);
  return bot;
}

module.exports = { createBot };
