// bot/keyboards.js
function getMiniAppUrl(baseUrl, gameCode) {
  const url = new URL(baseUrl);
  if (gameCode) url.searchParams.set('game', gameCode);
  return url.toString();
}

function mainMenuKeyboard(baseUrl) {
  return {
    inline_keyboard: [
      [{ text: '🎮 ورود به BEHI PLAY', web_app: { url: getMiniAppUrl(baseUrl) } }],
      [
        { text: '👥 بازی با دوستان', callback_data: 'menu_play_friends' },
        { text: '🤖 بازی با Bot', callback_data: 'menu_play_bot' },
      ],
      [
        { text: '🏆 رتبه‌بندی', callback_data: 'menu_rank' },
        { text: '👤 پروفایل من', callback_data: 'menu_profile' },
      ],
      [{ text: '❓ راهنما', callback_data: 'menu_help' }],
    ],
  };
}

function joinGameKeyboard(baseUrl, gameCode) {
  return {
    inline_keyboard: [
      [{ text: '🚀 ورود به بازی', web_app: { url: getMiniAppUrl(baseUrl, gameCode) } }],
    ],
  };
}

module.exports = { mainMenuKeyboard, joinGameKeyboard, getMiniAppUrl };
