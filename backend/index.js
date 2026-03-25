import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Sequelize, DataTypes, Op } from 'sequelize';

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

const User = sequelize.define('User', {
  telegram_id: { type: DataTypes.STRING, unique: true, primaryKey: true },
  first_name: { type: DataTypes.STRING, allowNull: false },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  season_points: { type: DataTypes.BIGINT, defaultValue: 0 },
  referrer_id: { type: DataTypes.STRING, allowNull: true },
  boost_until: { type: DataTypes.DATE, allowNull: true },
  
  energy: { type: DataTypes.INTEGER, defaultValue: 2000 },
  last_energy_update: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  passive_income: { type: DataTypes.INTEGER, defaultValue: 0 }, // Тепер це МОНЕТИ В СЕКУНДУ
  last_passive_collect: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  daily_streak: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_daily_claim: { type: DataTypes.DATE, allowNull: true }
});

sequelize.sync({ alter: true }).then(() => console.log('✅ База даних успішно оновлена!'));

// 🔥 НОВІ ГІГАНТСЬКІ РІВНІ ПРОКАЧКИ (бо монети тепер летять щосекунди) 🔥
const LEVEL_THRESHOLDS = [0, 5000, 25000, 100000, 500000, 2000000, 10000000, 50000000, 250000000];
const MAX_ENERGY = 2000;
const MAX_OFFLINE_SECONDS = 3 * 60 * 60; // 3 години офлайну

const calculateOfflineProgress = (user) => {
  const now = new Date();
  
  // 1. Відновлення енергії (Повільне: 1 енергія кожні 3 секунди)
  const secondsPassedEnergy = (now - new Date(user.last_energy_update)) / 1000;
  if (secondsPassedEnergy > 0) {
    const energyToRecover = Math.floor(secondsPassedEnergy / 3);
    user.energy = Math.min(MAX_ENERGY, user.energy + energyToRecover);
    user.last_energy_update = now;
  }

  // 2. Збір пасивного доходу В СЕКУНДУ (Максимум за 3 години)
  let passiveEarned = 0;
  if (user.passive_income > 0) {
    const secondsPassedPassive = (now - new Date(user.last_passive_collect)) / 1000;
    const cappedSeconds = Math.min(secondsPassedPassive, MAX_OFFLINE_SECONDS);
    passiveEarned = Math.floor(cappedSeconds * user.passive_income);
    
    if (passiveEarned > 0) {
      user.season_points = Number(user.season_points) + passiveEarned;
      user.last_passive_collect = now;
      
      let new_level = 1;
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (user.season_points >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; }
      }
      user.level = new_level > 9 ? 9 : new_level;
    }
  }

  // 3. Щоденний бонус
  let dailyAvailable = false;
  const lastClaim = user.last_daily_claim ? new Date(user.last_daily_claim) : null;
  if (!lastClaim) {
    dailyAvailable = true;
  } else {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lastClaimDay = new Date(lastClaim); lastClaimDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - lastClaimDay) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) dailyAvailable = true;
    else if (diffDays > 1) { dailyAvailable = true; user.daily_streak = 0; }
  }

  return { user, passiveEarned, dailyAvailable };
};

// --- API МАРШРУТИ ---

app.post('/api/user/init', async (req, res) => {
  const { telegram_id, first_name, referrer_id } = req.body;
  try {
    let user = await User.findByPk(String(telegram_id));
    if (!user) {
      const boostTime = referrer_id ? new Date(Date.now() + 12 * 60 * 60 * 1000) : null;
      user = await User.create({
        telegram_id: String(telegram_id), first_name: first_name || 'Гравець',
        referrer_id: referrer_id ? String(referrer_id) : null, boost_until: boostTime,
        last_energy_update: new Date(), last_passive_collect: new Date()
      });
    }

    const progress = calculateOfflineProgress(user);
    await progress.user.save();

    const active_boost = progress.user.boost_until && new Date(progress.user.boost_until) > new Date();
    res.json({ 
      user: { ...progress.user.get(), active_boost }, 
      offline_earned: progress.passiveEarned,
      daily_available: progress.dailyAvailable
    });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/tap', async (req, res) => {
  const { telegram_id, count = 1 } = req.body;
  const actualTouches = Math.min(Number(count) || 1, 10);

  try {
    const user = await User.findByPk(String(telegram_id));
    if (!user) return res.status(404).json({ error: 'Not found' });

    calculateOfflineProgress(user);

    if (user.energy < actualTouches) return res.status(400).json({ error: 'Недостатньо енергії' });

    const active_boost = user.boost_until && new Date(user.boost_until) > new Date();
    const points_to_add = (active_boost ? user.level * 2 : user.level) * actualTouches;
    
    user.season_points = Number(user.season_points) + points_to_add;
    user.energy -= actualTouches;
    user.last_energy_update = new Date();
    
    let new_level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (user.season_points >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; }
    }
    user.level = new_level > 9 ? 9 : new_level;

    await user.save();
    res.json({ user: { ...user.get(), active_boost } });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/daily', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    const progress = calculateOfflineProgress(user);
    if (!progress.dailyAvailable) return res.status(400).json({ error: 'Вже отримано' });

    user.daily_streak = (user.daily_streak || 0) + 1;
    if (user.daily_streak > 7) user.daily_streak = 7;

    const bonusAmounts = [0, 500, 1000, 2500, 5000, 15000, 30000, 100000];
    const reward = bonusAmounts[user.daily_streak];
    
    user.season_points = Number(user.season_points) + reward;
    user.last_daily_claim = new Date();
    await user.save();
    res.json({ user: user.get(), reward });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/user/buy_upgrade', async (req, res) => {
  const { telegram_id, cost, income_increase } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    if (user.season_points < cost) return res.status(400).json({ error: 'Недостатньо монет' });

    user.season_points = Number(user.season_points) - cost;
    user.passive_income += income_increase;
    user.last_passive_collect = new Date(); 

    await user.save();
    res.json({ user: user.get() });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// 🔥 НОВИЙ МАРШРУТ: Відновлення енергії за відео 🔥
app.post('/api/user/refill_energy', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    user.energy = MAX_ENERGY;
    user.last_energy_update = new Date();
    await user.save();
    res.json({ energy: user.energy });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/leaderboard', async (req, res) => {
  const { telegram_id } = req.query;
  try {
    const topUsers = await User.findAll({ order: [['season_points', 'DESC']], limit: 11, attributes: ['telegram_id', 'first_name', 'season_points', 'level']});
    let currentUserRank = null; let currentUserData = null;
    if (telegram_id) {
      currentUserData = await User.findByPk(String(telegram_id), { attributes: ['telegram_id', 'first_name', 'season_points', 'level'] });
      if (currentUserData) {
        const higherScoresCount = await User.count({ where: { season_points: { [Op.gt]: currentUserData.season_points } } });
        currentUserRank = higherScoresCount + 1; 
      }
    }
    res.json({ leaderboard: topUsers, currentUser: currentUserData ? { ...currentUserData.get(), rank: currentUserRank } : null });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.listen(PORT, () => console.log(`🚀 Сервер працює на порту ${PORT}`));