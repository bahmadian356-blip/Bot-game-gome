// lib/userService.js
// Profile / XP / Level / stats management. All calls are server-side only.

const supabase = require('./supabase');

const XP_PER_WIN = 30;
const XP_PER_LOSS = 10;
const XP_PER_LEVEL = 100;

function levelFromXp(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

/** Ensures a profiles row exists for this trusted Telegram user; returns the row. */
async function getOrCreateProfile(telegramUser) {
  const { id, first_name, last_name, username, photo_url } = telegramUser;

  const { data: existing, error: selectErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_id', id)
    .maybeSingle();

  if (selectErr) throw selectErr;
  if (existing) {
    // Keep display info fresh (name/username/photo can change on Telegram)
    const { data: updated, error: updateErr } = await supabase
      .from('profiles')
      .update({
        first_name,
        last_name,
        username,
        photo_url,
        updated_at: new Date().toISOString(),
      })
      .eq('telegram_id', id)
      .select()
      .single();
    if (updateErr) throw updateErr;
    return updated;
  }

  const { data: created, error: insertErr } = await supabase
    .from('profiles')
    .insert({
      telegram_id: id,
      first_name,
      last_name,
      username,
      photo_url,
      xp: 0,
      level: 1,
      games_played: 0,
      wins: 0,
      losses: 0,
    })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return created;
}

/** Applies the result of a finished game to a player's profile. */
async function applyGameResult(telegramId, didWin) {
  const { data: profile, error: selectErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
  if (selectErr) throw selectErr;

  const xpGain = didWin ? XP_PER_WIN : XP_PER_LOSS;
  const newXp = profile.xp + xpGain;
  const newLevel = levelFromXp(newXp);

  const { data: updated, error: updateErr } = await supabase
    .from('profiles')
    .update({
      xp: newXp,
      level: newLevel,
      games_played: profile.games_played + 1,
      wins: profile.wins + (didWin ? 1 : 0),
      losses: profile.losses + (didWin ? 0 : 1),
      updated_at: new Date().toISOString(),
    })
    .eq('telegram_id', telegramId)
    .select()
    .single();

  if (updateErr) throw updateErr;
  return updated;
}

async function getLeaderboard(limit = 50) {
  const { data, error } = await supabase
    .from('profiles')
    .select('telegram_id, first_name, username, photo_url, xp, level, wins, losses, games_played')
    .order('xp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

module.exports = { getOrCreateProfile, applyGameResult, getLeaderboard, levelFromXp };
