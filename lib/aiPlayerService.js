// lib/aiPlayerService.js
// Shared helpers for Bot ("AI") players across all games.

const BOT_NAMES = ['BEHI-Bot', 'RoboRival', 'CPU Ali', 'SilverBot', 'IronPlayer', 'ByteRival'];

function pickBotName(seatIndex) {
  return BOT_NAMES[seatIndex % BOT_NAMES.length];
}

/** Small randomized delay so a Bot's move doesn't feel instant/robotic. */
function humanLikeDelayMs(min = 600, max = 1800) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { pickBotName, humanLikeDelayMs, randomChoice };
