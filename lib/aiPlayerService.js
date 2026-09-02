// lib/aiPlayerService.js
// Generates AI player names and bot helper functions.

const botNames = [
  'CyberSlayer', 'PixelGhost', 'NeonSniper', 'AlphaBot',
  'QuantumAI', 'VectorX', 'GlitchMaster', 'StarCommander'
];

function pickBotName() {
  const index = Math.floor(Math.random() * botNames.length);
  return botNames[index];
}

module.exports = { pickBotName };
