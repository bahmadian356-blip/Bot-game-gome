// lib/userService.js
// Handles user profiles, registration, and leaderboard logic in Supabase.

const supabase = require('./supabase');

async function getOrCreateProfile(telegramUser) {
  const telegramId = telegramUser.id;
  const username = telegramUser.username || null;
  const firstName = telegramUser.first_name || 'Player';

  // Check if user already exists
  const { data: existing, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (existing) {
    // Update username/firstname if changed
    if (existing.username !== username || existing.first_name !== firstName) {
      await supabase
        .from('profiles')
        .update({ username, first_name: firstName })
        .eq('telegram_id', telegramId);
    }
    return existing;
  }

  // Create new profile if not found
  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      telegram_id: telegramId,
      username,
      first_name: firstName,
      score: 0,
      wins: 0,
      losses: 0,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

async function applyGameResult(telegramId, isWin) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (!profile) return;

  const updates = {
    wins: isWin ? profile.wins + 1 : profile.wins,
    losses: !isWin ? profile.losses + 1 : profile.losses,
    score: isWin ? profile.score + 100 : Math.max(0, profile.score - 50),
  };

  await supabase
    .from('profiles')
    .update(updates)
    .eq('telegram_id', telegramId);
}

async function getLeaderboard(limit = 50) {
  const { data, error } = await supabase
    .from('profiles')
    .select('telegram_id, username, first_name, score, wins, losses')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

module.exports = { getOrCreateProfile, applyGameResult, getLeaderboard };
