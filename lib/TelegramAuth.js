// lib/telegramAuth.js
// Verifies Telegram WebApp initData via HMAC-SHA256 using the bot token.
// Ensures requests to backend APIs truly originate from an authentic Telegram session.

const crypto = require('crypto');

function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return null;

    urlParams.delete('hash');
    
    // Sort parameters alphabetically as required by Telegram documentation
    const paramsList = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);
    
    const dataCheckString = paramsList.join('\n');

    // Secret key is HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) return null;

    const userParam = urlParams.get('user');
    if (!userParam) return null;

    return JSON.parse(userParam);
  } catch (err) {
    console.error('[telegramAuth] verification error:', err.message);
    return null;
  }
}

function requireTelegramAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const initData = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.body.initData || req.query.initData;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const user = verifyTelegramInitData(initData, botToken);

  if (!user) {
    // In local development fallback if needed, or strict block
    if (process.env.NODE_ENV === 'development' && req.headers['x-dev-user-id']) {
      req.telegramUser = { id: Number(req.headers['x-dev-user-id']), first_name: 'DevUser' };
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid Telegram initData' });
  }

  req.telegramUser = user;
  next();
}

module.exports = { verifyTelegramInitData, requireTelegramAuth };
