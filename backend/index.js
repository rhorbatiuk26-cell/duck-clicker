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
  season_points: { type: DataTypes.BIGINT, defaultValue: 0 },
  
  squad_id: { type: DataTypes.STRING, allowNull: true },
  current_skin: { type: DataTypes.STRING, defaultValue: 'default' },
  unlocked_skins: { type: DataTypes.JSON, defaultValue: ['default'] },
  achievements: { type: DataTypes.JSON, defaultValue: [] },
  
  referrer_id: { type: DataTypes.STRING, allowNull: true },
  referrer_rewarded: { type: DataTypes.BOOLEAN, defaultValue: false },
  boost_until: { type: DataTypes.DATE, allowNull: true },
  boost_multiplier: { type: DataTypes.INTEGER, defaultValue: 1 },
  auto_click_until: { type: DataTypes.DATE, allowNull: true },
  energy: { type: DataTypes.INTEGER, defaultValue: 2000 },
  last_energy_update: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  passive_income: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_passive_collect: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  daily_streak: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_daily_claim: { type: DataTypes.DATE, allowNull: true },
  task_tg_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  free_energy_refills: { type: DataTypes.INTEGER, defaultValue: 3 },
  last_boost_reset: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

Squad.hasMany(User, { foreignKey: 'squad_id' });
User.belongsTo(Squad, { foreignKey: 'squad_id' });

sequelize.sync({ alter: true }).then(() => console.log('✅ База даних успішно оновлена!'));

const LEVEL_THRESHOLDS = [0, 5000, 25000, 100000, 500000, 2000000, 25000000, 100000000, 1000000000];
const MAX_ENERGY = 2000;
const MAX_OFFLINE_SECONDS = 3 * 60 * 60;

const checkReferralReward = async (user) => {
  if (user.level >= 3 && user.referrer_id && !user.referrer_rewarded) {
    try {
      const referrer = await User.findByPk(String(user.referrer_id));
      if (referrer) { referrer.season_points = Number(referrer.season_points) + 50000; await referrer.save(); }
      user.referrer_rewarded = true; await user.save();
    } catch (err) {}
  }
};

const calculateOfflineProgress = async (user) => {
  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lastReset = new Date(user.last_boost_reset); lastReset.setHours(0, 0, 0, 0);
  if (today > lastReset) { user.free_energy_refills = 3; user.last_boost_reset = now; }

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
      user.last_passive_collect = now;
      let new_level = 1;
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (user.season_points >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } }
      user.level = new_level > 9 ? 9 : new_level;

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

const checkTelegramSubscription = (userId) => {
  return new Promise((resolve) => {
    const botToken = process.env.BOT_TOKEN; const channel = process.env.CHANNEL_USERNAME;
    if (!botToken || !channel) return resolve(false);
    https.get(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${channel}&user_id=${userId}`, (res) => {
      let data = ''; res.on('data', chunk => data += chunk);
      res.on('end', () => { try { const result = JSON.parse(data); resolve(result.ok && ['member', 'administrator', 'creator'].includes(result.result.status)); } catch (e) { resolve(false); } });
    }).on('error', () => resolve(false));
  });
};

// --- API МАРШРУТИ ---

app.post('/api/user/init', async (req, res) => {
  const { telegram_id, first_name, start_param } = req.body;
  try {
    let user = await User.findByPk(String(telegram_id), { include: Squad });
    
    // РОЗШИФРОВУЄМО START PARAM (Лінк)
    let referrer_id = null;
    let squad_to_join = null;
    
    if (start_param) {
      if (start_param.startsWith('squad_')) {
        squad_to_join = start_param.replace('squad_', ''); // Беремо назву скваду
      } else {
        referrer_id = start_param; // Якщо просто цифри — це звичайний друг
      }
    }

    if (!user) {
      user = await User.create({ 
        telegram_id: String(telegram_id), 
        first_name: first_name || 'Гравець', 
        referrer_id: referrer_id ? String(referrer_id) : null, 
        last_energy_update: new Date(), 
        last_passive_collect: new Date() 
      });
    }

    // АВТОМАТИЧНИЙ ВСТУП У СКВАД ЗА ЛІНКОМ
    if (squad_to_join && user.squad_id !== squad_to_join) {
      let squad = await Squad.findByPk(squad_to_join);
      if (!squad) squad = await Squad.create({ username: squad_to_join, name: `@${squad_to_join}` });
      
      if (user.squad_id) await Squad.decrement('members_count', { by: 1, where: { username: user.squad_id } });
      user.squad_id = squad_to_join;
      await user.save();
      await Squad.increment('members_count', { by: 1, where: { username: squad_to_join } });
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
    
    user.season_points = Number(user.season_points) + points_to_add; user.energy -= actualTouches; user.last_energy_update = new Date();
    
    let new_level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (user.season_points >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } }
    user.level = new_level > 9 ? 9 : new_level;

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

    if (boost_type === 'energy') { user.energy = MAX_ENERGY; user.last_energy_update = new Date(); } 
    else if (boost_type === 'x5') { user.boost_until = new Date(Date.now() + 5 * 60 * 1000); user.boost_multiplier = 5; } 
    else if (boost_type === 'autoclick') { user.auto_click_until = new Date(Date.now() + 3 * 60 * 1000); } 
    else if (boost_type === 'magnet') { user.season_points = Number(user.season_points) + 10000; } 
    else return res.status(400).json({ error: 'Невідомий буст' });

    let new_level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (user.season_points >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } }
    user.level = new_level > 9 ? 9 : new_level;

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
      user.season_points = Number(user.season_points) - cost; skins.push(skin_id); user.unlocked_skins = skins; user.current_skin = skin_id;
    }
    await user.save(); res.json({ user: user.get() });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/achievement', async (req, res) => {
  const { telegram_id, achievement_id, reward } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    let achs = user.achievements || [];
    if (!achs.includes(achievement_id)) {
      achs.push(achievement_id); user.achievements = achs; user.season_points = Number(user.season_points) + reward; await user.save();
      return res.json({ user: user.get(), reward });
    }
    res.status(400).json({ error: 'Вже отримано' });
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
    user.season_points = Number(user.season_points) - cost; user.passive_income += income_increase; user.last_passive_collect = new Date(); await user.save(); res.json({ user: user.get() });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/claim_task', async (req, res) => {
  const { telegram_id, task_type } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    if (task_type === 'telegram') {
      if (user.task_tg_claimed) return res.status(400).json({ error: 'Вже виконано' });
      const isSubscribed = await checkTelegramSubscription(telegram_id);
      if (!isSubscribed) return res.status(400).json({ error: 'not_subscribed' });
      user.task_tg_claimed = true; user.season_points = Number(user.season_points) + 100000;
      let new_level = 1; for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (user.season_points >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } }
      user.level = new_level > 9 ? 9 : new_level;
      await user.save(); await checkReferralReward(user); return res.json({ user: user.get() });
    }
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/reset', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    user.season_points = 0; user.level = 1; user.energy = MAX_ENERGY; user.passive_income = 0;
    user.daily_streak = 0; user.task_tg_claimed = false; user.last_daily_claim = null;
    user.free_energy_refills = 3; user.referrer_rewarded = false; user.boost_until = null;
    user.auto_click_until = null; user.achievements = []; user.unlocked_skins = ['default'];
    user.current_skin = 'default'; user.squad_id = null; await user.save(); res.json({ user: user.get() });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/leaderboard', async (req, res) => {
  const { telegram_id } = req.query;
  try {
    const topUsers = await User.findAll({ order: [['season_points', 'DESC']], limit: 100, attributes: ['telegram_id', 'first_name', 'season_points', 'level']});
    const topSquads = await Squad.findAll({ order: [['total_points', 'DESC']], limit: 50 });
    let currentUserRank = null; let currentUserData = null;
    if (telegram_id) {
      currentUserData = await User.findByPk(String(telegram_id), { attributes: ['telegram_id', 'first_name', 'season_points', 'level', 'squad_id'] });
      if (currentUserData) {
        const higherScoresCount = await User.count({ where: { season_points: { [Op.gt]: currentUserData.season_points } } });
        currentUserRank = higherScoresCount + 1; 
      }
    }
    res.json({ players: topUsers, squads: topSquads, currentUser: currentUserData ? { ...currentUserData.get(), rank: currentUserRank } : null });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.listen(PORT, () => console.log(`🚀 Сервер працює на порту ${PORT}`));