import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Sequelize, DataTypes, Op } from 'sequelize';
import https from 'https';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite::memory:', {
  dialect: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
  protocol: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
  logging: false,
  dialectOptions: process.env.DATABASE_URL ? { ssl: { require: true, rejectUnauthorized: false } } : {}
});

const Squad = sequelize.define('Squad', {
  username: { type: DataTypes.STRING, unique: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  total_points: { type: DataTypes.BIGINT, defaultValue: 0 },
  members_count: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const User = sequelize.define('User', {
  telegram_id: { type: DataTypes.STRING, unique: true, primaryKey: true },
  first_name: { type: DataTypes.STRING, allowNull: false },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  
  // 🔥 РОЗДІЛЯЄМО БАЛАНС І ДОСВІД 🔥
  season_points: { type: DataTypes.BIGINT, defaultValue: 0 }, // Це гроші для покупок
  total_earned: { type: DataTypes.BIGINT, defaultValue: 0 },    // Це сумарний рейтинг/досвід для ТОПу і Рівнів
  
  squad_id: { type: DataTypes.STRING, allowNull: true },
  current_skin: { type: DataTypes.STRING, defaultValue: 'default' },
  unlocked_skins: { type: DataTypes.JSON, defaultValue: ['default'] },
  achievements: { type: DataTypes.JSON, defaultValue: [] },
  referrer_id: { type: DataTypes.STRING, allowNull: true },
  referrer_rewarded: { type: DataTypes.BOOLEAN, defaultValue: false },
  referrals_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  boost_until: { type: DataTypes.DATE, allowNull: true },
  boost_multiplier: { type: DataTypes.INTEGER, defaultValue: 1 },
  auto_click_until: { type: DataTypes.DATE, allowNull: true },
  energy: { type: DataTypes.INTEGER, defaultValue: 2000 },
  last_energy_update: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  passive_income: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_passive_collect: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  daily_streak: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_daily_claim: { type: DataTypes.DATE, allowNull: true },
  last_boost_reset: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  free_energy_refills: { type: DataTypes.INTEGER, defaultValue: 3 }, 
  ad_energy_left: { type: DataTypes.INTEGER, defaultValue: 3 },
  ad_x5_left: { type: DataTypes.INTEGER, defaultValue: 3 },
  ad_autoclick_left: { type: DataTypes.INTEGER, defaultValue: 3 },
  ad_magnet_left: { type: DataTypes.INTEGER, defaultValue: 3 },
  task_tg_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  task_x_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  task_yt_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  task_ig_claimed: { type: DataTypes.BOOLEAN, defaultValue: false }
});

Squad.hasMany(User, { foreignKey: 'squad_id' });
User.belongsTo(Squad, { foreignKey: 'squad_id' });

sequelize.sync({ alter: true }).then(() => console.log('✅ База даних успішно оновлена!'));

const LEVEL_THRESHOLDS = [0, 10000, 100000, 500000, 2000000, 10000000, 50000000, 500000000, 5000000000, 50000000000];
const MAX_ENERGY = 2000;
const MAX_OFFLINE_SECONDS = 3 * 60 * 60;

const sendTelegramMessage = async (chatId, text) => {
  const token = process.env.BOT_TOKEN;
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }) }); } catch (e) {}
};

const endSeasonAndNotify = async () => {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) return { error: "Немає ADMIN_TELEGRAM_ID" };
  try {
    const topUsers = await User.findAll({ order: [['total_earned', 'DESC']], limit: 11 });
    const topSquad = await Squad.findOne({ order: [['total_points', 'DESC']] });
    let squadTopUsers = [];
    if (topSquad) squadTopUsers = await User.findAll({ where: { squad_id: topSquad.username }, order: [['total_earned', 'DESC']], limit: 10 });
    
    let msg = `🚨 <b>СЕЗОН ЗАВЕРШЕНО! ЗВІТ ДЛЯ АДМІНА</b> 🚨\n\n🏆 <b>ТОП-11 ГРАВЦІВ:</b>\n`;
    if (topUsers.length === 0) msg += `Немає активних гравців.\n`;
    topUsers.forEach((u, i) => { msg += `${i+1}. <a href="tg://user?id=${u.telegram_id}">${u.first_name}</a> — Рейтинг: ${u.total_earned} 🏆\n`; });
    
    msg += `\n🛡 <b>ТОП СКВАД:</b>\n`;
    if (topSquad) {
      msg += `<b>@${topSquad.name}</b> (Всього: ${topSquad.total_points} 🏆)\n\n🎖 <b>ТОП Гравці цього скваду:</b>\n`;
      squadTopUsers.forEach((u, i) => { msg += `${i+1}. <a href="tg://user?id=${u.telegram_id}">${u.first_name}</a> — ${u.total_earned} 🏆\n`; });
    } else { msg += `Немає створених сквадів.\n`; }
    
    await sendTelegramMessage(adminId, msg);
    // Обнуляємо Баланс І Загальний рейтинг
    await User.update({ season_points: 0, total_earned: 0, level: 1, energy: MAX_ENERGY, passive_income: 0 }, { where: {} });
    await Squad.update({ total_points: 0 }, { where: {} });
    return { success: true };
  } catch (error) { return { error: "Внутрішня помилка" }; }
};

setInterval(async () => {
  const now = new Date();
  if (now.getDate() === 1 && now.getHours() === 0) {
    const activeUsers = await User.count({ where: { total_earned: { [Op.gt]: 0 } } });
    if (activeUsers > 0) await endSeasonAndNotify();
  }
}, 1000 * 60 * 30);

const checkReferralReward = async (user) => {
  if (user.level >= 3 && user.referrer_id && !user.referrer_rewarded) {
    try {
      const referrer = await User.findByPk(String(user.referrer_id));
      if (referrer) { 
        referrer.season_points = Number(referrer.season_points) + 50000; 
        referrer.total_earned = Number(referrer.total_earned) + 50000;
        await referrer.save(); 
      }
      user.referrer_rewarded = true; await user.save();
    } catch (err) {}
  }
};

const calculateOfflineProgress = async (user) => {
  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lastReset = new Date(user.last_boost_reset); lastReset.setHours(0, 0, 0, 0);
  
  if (today > lastReset) { 
    user.free_energy_refills = 3; user.ad_energy_left = 3; user.ad_x5_left = 3; user.ad_autoclick_left = 3; user.ad_magnet_left = 3; user.last_boost_reset = now; 
  }

  const secondsPassedEnergy = (now - new Date(user.last_energy_update)) / 1000;
  if (secondsPassedEnergy > 0) {
    user.energy = Math.min(MAX_ENERGY, user.energy + Math.floor(secondsPassedEnergy / 3));
    user.last_energy_update = now;
  }

  let passiveEarned = 0;
  let currentPassive = user.passive_income;
  if (user.auto_click_until && new Date(user.auto_click_until) > now) currentPassive += (7 * user.level);

  if (currentPassive > 0) {
    const secondsPassedPassive = (now - new Date(user.last_passive_collect)) / 1000;
    const cappedSeconds = Math.min(secondsPassedPassive, MAX_OFFLINE_SECONDS);
    passiveEarned = Math.floor(cappedSeconds * currentPassive);
    
    if (passiveEarned > 0) {
      user.season_points = Number(user.season_points) + passiveEarned;
      user.total_earned = Number(user.total_earned) + passiveEarned;
      user.last_passive_collect = now;
      let new_level = 1;
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } }
      user.level = new_level > 10 ? 10 : new_level;
      if (user.squad_id) await Squad.increment('total_points', { by: passiveEarned, where: { username: user.squad_id } });
    }
  }

  let dailyAvailable = false;
  const lastClaim = user.last_daily_claim ? new Date(user.last_daily_claim) : null;
  if (!lastClaim) dailyAvailable = true;
  else {
    const claimDay = new Date(lastClaim); claimDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - claimDay) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) dailyAvailable = true;
    else if (diffDays > 1) { dailyAvailable = true; user.daily_streak = 0; }
  }
  return { user, passiveEarned, dailyAvailable };
};

app.post('/api/user/init', async (req, res) => {
  const { telegram_id, first_name, start_param } = req.body;
  try {
    let user = await User.findByPk(String(telegram_id), { include: Squad });
    let referrer_id = null; let squad_to_join = null;
    
    if (start_param) {
      if (start_param.startsWith('squad_')) squad_to_join = start_param.replace('squad_', '');
      else referrer_id = start_param;
    }

    if (!user) {
      let startingPoints = 0;
      if (referrer_id) {
        startingPoints = 25000; 
        const referrer = await User.findByPk(String(referrer_id));
        if (referrer) {
          referrer.season_points = Number(referrer.season_points) + 25000;
          referrer.total_earned = Number(referrer.total_earned) + 25000;
          referrer.referrals_count += 1; 
          await referrer.save();
        }
      }
      user = await User.create({ telegram_id: String(telegram_id), first_name: first_name || 'Гравець', referrer_id: referrer_id ? String(referrer_id) : null, season_points: startingPoints, total_earned: startingPoints, last_energy_update: new Date(), last_passive_collect: new Date() });
    } else {
      // Фікс для старих гравців: прирівнюємо досвід до балансу, якщо він 0
      if (Number(user.total_earned) === 0 && Number(user.season_points) > 0) {
        user.total_earned = user.season_points;
        await user.save();
      }
    }

    if (squad_to_join && user.squad_id !== squad_to_join) {
      let squad = await Squad.findByPk(squad_to_join);
      if (!squad) squad = await Squad.create({ username: squad_to_join, name: `@${squad_to_join}` });
      if (user.squad_id) await Squad.decrement('members_count', { by: 1, where: { username: user.squad_id } });
      user.squad_id = squad_to_join; await user.save(); await Squad.increment('members_count', { by: 1, where: { username: squad_to_join } });
    }

    const progress = await calculateOfflineProgress(user);
    await progress.user.save(); await checkReferralReward(progress.user);

    const active_boost = progress.user.boost_until && new Date(progress.user.boost_until) > new Date();
    const auto_click = progress.user.auto_click_until && new Date(progress.user.auto_click_until) > new Date();
    res.json({ user: { ...progress.user.get(), active_boost, auto_click }, offline_earned: progress.passiveEarned, daily_available: progress.dailyAvailable });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/tap', async (req, res) => {
  const { telegram_id, count = 1 } = req.body;
  const actualTouches = Math.min(Number(count) || 1, 10);
  try {
    const user = await User.findByPk(String(telegram_id));
    if (!user) return res.status(404).json({ error: 'Not found' });
    await calculateOfflineProgress(user);
    if (user.energy < actualTouches) return res.status(400).json({ error: 'Недостатньо енергії' });

    const active_boost = user.boost_until && new Date(user.boost_until) > new Date();
    const points_to_add = (user.level * (active_boost ? user.boost_multiplier : 1)) * actualTouches;
    
    user.season_points = Number(user.season_points) + points_to_add; 
    user.total_earned = Number(user.total_earned) + points_to_add; 
    user.energy -= actualTouches; 
    user.last_energy_update = new Date();
    
    let new_level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } }
    user.level = new_level > 10 ? 10 : new_level;

    await user.save();
    if (user.squad_id) await Squad.increment('total_points', { by: points_to_add, where: { username: user.squad_id } });
    await checkReferralReward(user);

    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > new Date();
    res.json({ user: { ...user.get(), active_boost, auto_click } });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/ad_boost', async (req, res) => {
  const { telegram_id, boost_type } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    await calculateOfflineProgress(user);
    
    if (boost_type === 'energy') { 
      if (user.ad_energy_left <= 0) return res.status(400).json({ error: 'Ліміт вичерпано' });
      user.energy = MAX_ENERGY; user.last_energy_update = new Date(); user.ad_energy_left -= 1;
    } 
    else if (boost_type === 'x5') { 
      if (user.ad_x5_left <= 0) return res.status(400).json({ error: 'Ліміт вичерпано' });
      user.boost_until = new Date(Date.now() + 5 * 60 * 1000); user.boost_multiplier = 5; user.ad_x5_left -= 1;
    } 
    else if (boost_type === 'autoclick') { 
      if (user.ad_autoclick_left <= 0) return res.status(400).json({ error: 'Ліміт вичерпано' });
      user.auto_click_until = new Date(Date.now() + 3 * 60 * 1000); user.ad_autoclick_left -= 1;
    } 
    else if (boost_type === 'magnet') { 
      if (user.ad_magnet_left <= 0) return res.status(400).json({ error: 'Ліміт вичерпано' });
      user.season_points = Number(user.season_points) + 10000; user.total_earned = Number(user.total_earned) + 10000; user.ad_magnet_left -= 1;
    } 
    else return res.status(400).json({ error: 'Невідомий буст' });

    let new_level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } }
    user.level = new_level > 10 ? 10 : new_level;
    await user.save();
    
    const active_boost = user.boost_until && new Date(user.boost_until) > new Date();
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > new Date();
    res.json({ user: { ...user.get(), active_boost, auto_click } });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/squad/join', async (req, res) => {
  const { telegram_id, squad_username } = req.body;
  try {
    const cleanUsername = squad_username.replace('@', '').trim();
    if (!cleanUsername) return res.status(400).json({ error: 'Порожнє ім\'я' });
    const user = await User.findByPk(String(telegram_id));
    let squad = await Squad.findByPk(cleanUsername);
    if (!squad) squad = await Squad.create({ username: cleanUsername, name: `@${cleanUsername}` });
    if (user.squad_id !== cleanUsername) {
      if (user.squad_id) await Squad.decrement('members_count', { by: 1, where: { username: user.squad_id } });
      user.squad_id = cleanUsername; await user.save();
      await Squad.increment('members_count', { by: 1, where: { username: cleanUsername } });
    }
    res.json({ user: user.get(), squad: squad.get() });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/buy_skin', async (req, res) => {
  const { telegram_id, skin_id, cost } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    let skins = user.unlocked_skins || ['default'];
    if (skins.includes(skin_id)) user.current_skin = skin_id;
    else {
      if (user.season_points < cost) return res.status(400).json({ error: 'Недостатньо монет' });
      // Знімаємо гроші ТІЛЬКИ З БАЛАНСУ (season_points). total_earned залишається!
      user.season_points = Number(user.season_points) - cost; 
      skins.push(skin_id); user.unlocked_skins = skins; user.current_skin = skin_id;
    }
    await user.save(); res.json({ user: user.get() });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/achievement', async (req, res) => {
  const { telegram_id, achievement_id, reward } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    let achs = user.achievements || [];
    if (achs.includes(achievement_id)) return res.status(400).json({ error: 'Вже отримано' });

    if (achievement_id === 'ref_3' && user.referrals_count < 3) return res.status(400).json({ error: 'Недостатньо друзів' });
    if (achievement_id === 'ref_10' && user.referrals_count < 10) return res.status(400).json({ error: 'Недостатньо друзів' });
    if (achievement_id === 'ref_50' && user.referrals_count < 50) return res.status(400).json({ error: 'Недостатньо друзів' });

    achs.push(achievement_id); user.achievements = achs; 
    user.season_points = Number(user.season_points) + reward; 
    user.total_earned = Number(user.total_earned) + reward; 
    let new_level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } }
    user.level = new_level > 10 ? 10 : new_level;
    await user.save();
    return res.json({ user: user.get(), reward });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/daily', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    const progress = await calculateOfflineProgress(user);
    if (!progress.dailyAvailable) return res.status(400).json({ error: 'Вже отримано' });
    user.daily_streak = Math.min((user.daily_streak || 0) + 1, 7);
    const bonusAmounts = [0, 500, 1000, 2500, 5000, 15000, 30000, 100000];
    user.season_points = Number(user.season_points) + bonusAmounts[user.daily_streak];
    user.total_earned = Number(user.total_earned) + bonusAmounts[user.daily_streak];
    user.last_daily_claim = new Date(); await user.save(); res.json({ user: user.get(), reward: bonusAmounts[user.daily_streak] });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/free_energy', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id)); await calculateOfflineProgress(user); 
    if (user.free_energy_refills > 0) { user.energy = MAX_ENERGY; user.free_energy_refills -= 1; user.last_energy_update = new Date(); await user.save(); return res.json({ energy: user.energy, refills: user.free_energy_refills }); }
    res.status(400).json({ error: 'Ліміт вичерпано' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/buy_upgrade', async (req, res) => {
  const { telegram_id, cost, income_increase } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    if (user.season_points < cost) return res.status(400).json({ error: 'Недостатньо' });
    // Знімаємо гроші тільки з балансу
    user.season_points = Number(user.season_points) - cost; 
    user.passive_income += income_increase; user.last_passive_collect = new Date(); await user.save(); res.json({ user: user.get() });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/claim_task', async (req, res) => {
  const { telegram_id, task_type } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user[`task_${task_type}_claimed`]) return res.status(400).json({ error: 'Вже виконано' });
    let reward = 50000; 
    if (task_type === 'telegram') {
      reward = 100000;
      const isSubscribed = await checkTelegramSubscription(telegram_id);
      if (!isSubscribed) return res.status(400).json({ error: 'not_subscribed' });
    }
    user[`task_${task_type}_claimed`] = true; 
    user.season_points = Number(user.season_points) + reward;
    user.total_earned = Number(user.total_earned) + reward;
    let new_level = 1; for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } }
    user.level = new_level > 10 ? 10 : new_level;
    await user.save(); await checkReferralReward(user); return res.json({ user: user.get(), reward });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/reset', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    user.season_points = 0; user.total_earned = 0; user.level = 1; user.energy = MAX_ENERGY; user.passive_income = 0;
    user.daily_streak = 0; user.last_daily_claim = null; user.free_energy_refills = 3; 
    user.referrer_rewarded = false; user.boost_until = null; user.auto_click_until = null; 
    user.achievements = []; user.unlocked_skins = ['default']; user.current_skin = 'default'; user.squad_id = null; 
    user.task_tg_claimed = false; user.task_x_claimed = false; user.task_yt_claimed = false; user.task_ig_claimed = false;
    user.ad_energy_left = 3; user.ad_x5_left = 3; user.ad_autoclick_left = 3; user.ad_magnet_left = 3;
    await user.save(); res.json({ user: user.get() });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/end_season', async (req, res) => {
  const result = await endSeasonAndNotify();
  if (result.success) res.json({ success: true });
  else res.status(500).json({ error: result.error });
});

app.get('/api/leaderboard', async (req, res) => {
  const { telegram_id } = req.query;
  try {
    // В ТОП тепер беремо за параметром total_earned (Рейтинг)
    const topUsers = await User.findAll({ order: [['total_earned', 'DESC']], limit: 100, attributes: ['telegram_id', 'first_name', 'total_earned', 'level']});
    const topSquads = await Squad.findAll({ order: [['total_points', 'DESC']], limit: 50 });
    let currentUserRank = null; let currentUserData = null;
    if (telegram_id) {
      currentUserData = await User.findByPk(String(telegram_id), { attributes: ['telegram_id', 'first_name', 'total_earned', 'level', 'squad_id'] });
      if (currentUserData) {
        const higherScoresCount = await User.count({ where: { total_earned: { [Op.gt]: currentUserData.total_earned } } });
        currentUserRank = higherScoresCount + 1; 
      }
    }
    res.json({ players: topUsers, squads: topSquads, currentUser: currentUserData ? { ...currentUserData.get(), rank: currentUserRank } : null });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.listen(PORT, () => console.log(`🚀 Сервер працює на порту ${PORT}`));