// bot/commands.js
const { mainMenuKeyboard, joinGameKeyboard } = require('./keyboards');
const { getOrCreateProfile, getLeaderboard } = require('../lib/userService');
const { getGameByCode } = require('../lib/gameService');

function registerCommands(bot, baseUrl) {
  async function sendProfile(chatId, from) {
    try {
      const profile = await getOrCreateProfile({
        id: from.id,
        first_name: from.first_name,
        last_name: from.last_name,
        username: from.username,
        photo_url: null,
      });
      bot.sendMessage(
        chatId,
        `👤 پروفایل شما\n\nنام: ${profile.first_name}\nسطح: ${profile.level}\nXP: ${profile.xp}\nبازی‌ها: ${profile.games_played}\nبرد: ${profile.wins} | باخت: ${profile.losses}`
      );
    } catch (err) {
      bot.sendMessage(chatId, '⚠️ مشکلی در دریافت پروفایل پیش اومد.');
    }
  }

  async function sendRank(chatId) {
    try {
      const top = await getLeaderboard(10);
      const lines = top.map(
        (p, i) => `${i + 1}. ${p.first_name || p.username || 'بازیکن'} — ${p.xp} XP (سطح ${p.level})`
      );
      bot.sendMessage(chatId, `🏆 رتبه‌بندی برترین بازیکنان:\n\n${lines.join('\n') || 'هنوز بازیکنی ثبت نشده.'}`);
    } catch (err) {
      bot.sendMessage(chatId, '⚠️ مشکلی در دریافت رتبه‌بندی پیش اومد.');
    }
  }

  function sendHelp(chatId) {
    bot.sendMessage(
      chatId,
      '❓ راهنما\n\n/start — شروع و منوی اصلی\n/play — ورود سریع به بازی\n/profile — مشاهده پروفایل\n/rank — رتبه‌بندی برترین بازیکنان\n\nتو Mini App می‌تونی بازی بسازی، دوستت رو دعوت کنی، یا فوراً با Bot بازی کنی.'
    );
  }

  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const payload = match[1];

    const telegramUser = {
      id: msg.from.id,
      first_name: msg.from.first_name,
      last_name: msg.from.last_name,
      username: msg.from.username,
      photo_url: null,
    };

    try {
      await getOrCreateProfile(telegramUser);
    } catch (err) {
      console.error('[bot] failed to upsert profile on /start:', err.message);
    }

    if (payload && payload.startsWith('game_')) {
      const gameCode = payload.replace('game_', '');
      const game = await getGameByCode(gameCode).catch(() => null);

      if (!game) {
        return bot.sendMessage(chatId, '❌ این بازی پیدا نشد یا منقضی شده.');
      }
      if (game.status !== 'lobby') {
        return bot.sendMessage(chatId, '⛔️ این بازی قبلاً شروع شده یا تمام شده.');
      }

      return bot.sendMessage(
        chatId,
        `🎮 یکی از دوستانت تو رو به بازی «${game.game_type}» دعوت کرده!\n\nبرای ورود به Lobby دکمه زیر رو بزن 👇`,
        { reply_markup: joinGameKeyboard(baseUrl, gameCode) }
      );
    }

    return bot.sendMessage(
      chatId,
      `👋 سلام ${msg.from.first_name}!\nبه BEHI PLAY خوش اومدی 🎮\n\nاز منوی زیر یکی رو انتخاب کن:`,
      { reply_markup: mainMenuKeyboard(baseUrl) }
    );
  });

  bot.onText(/\/play/, (msg) => {
    bot.sendMessage(msg.chat.id, '🎮 برای شروع بازی وارد Mini App شو:', {
      reply_markup: joinGameKeyboard(baseUrl),
    });
  });

  bot.onText(/\/profile/, (msg) => sendProfile(msg.chat.id, msg.from));
  bot.onText(/\/rank/, (msg) => sendRank(msg.chat.id));
  bot.onText(/\/help/, (msg) => sendHelp(msg.chat.id));

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    await bot.answerCallbackQuery(query.id);

    switch (query.data) {
      case 'menu_play_friends':
      case 'menu_play_bot':
        return bot.sendMessage(chatId, '🎮 وارد Mini App شو و از اونجا نوع بازی رو انتخاب کن:', {
          reply_markup: joinGameKeyboard(baseUrl),
        });
      case 'menu_rank':
        return sendRank(chatId);
      case 'menu_profile':
        return sendProfile(chatId, query.from);
      case 'menu_help':
        return sendHelp(chatId);
      default:
        return;
    }
  });
}

module.exports = { registerCommands };
