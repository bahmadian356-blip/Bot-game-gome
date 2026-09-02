// lib/telegramAuth.js
const crypto = require('crypto');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function verifyInitData(initData) {
  if (!initData || typeof initData !== 'string') return null;
  if (!BOT_TOKEN) {
    console.error('[telegramAuth] TELEGRAM_BOT_TOKEN not set.');
    return null;
  }
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckArr = [];
    for (const [key, value] of [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      dataCheckArr.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computedHash !== hash) return null;

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > 60 * 60 * 24) return null;

    const userRaw = params.get('user');
    if (!userRaw) return null;
    const user = JSON.parse(userRaw);

    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      language_code: user.language_code,
    };
  } catch (err) {
    console.error('[telegramAuth] verify error:', err.message);
    return null;
  }
}

function requireTelegramAuth(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  const user = verifyInitData(initData);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or missing Telegram authentication' });
  }
  req.telegramUser = user;
  next();
}

module.exports = { verifyInitData, requireTelegramAuth };
