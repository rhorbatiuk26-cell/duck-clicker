import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Sequelize, DataTypes, Op } from 'sequelize';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api'; 
import cron from 'node-cron'; 

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==========================================
// РОЗДАЧА ФРОНТЕНДУ (ГРИ)
// ==========================================
app.use(express.static(path.join(__dirname, '../dist')));

// ==========================================
// БАЗА ДАНИХ
// ==========================================

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
  total_earned: { type: DataTypes.BIGINT, defaultValue: 0 },    
  squad_id: { type: DataTypes.STRING, allowNull: true },
  current_skin: { type: DataTypes.STRING, defaultValue: 'default' },
  unlocked_skins: { type: DataTypes.JSON, defaultValue: ['default'] },
  achievements: { type: DataTypes.JSON, defaultValue: [] },
  businesses: { type: DataTypes.JSON, defaultValue: {} },
  
  referrer_id: { type: DataTypes.STRING, allowNull: true },
  referrals_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  ref_reward_lvl3_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  ref_reward_lvl5_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  
  boost_until: { type: DataTypes.DATE, allowNull: true },
  boost_multiplier: { type: DataTypes.INTEGER, defaultValue: 1 },
  auto_click_until: { type: DataTypes.DATE, allowNull: true },
  daily_x2_until: { type: DataTypes.DATE, allowNull: true },
  
  energy: { type: DataTypes.INTEGER, defaultValue: 1500 },
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
  ad_energy_ready_at: { type: DataTypes.DATE, allowNull: true },
  ad_x5_ready_at: { type: DataTypes.DATE, allowNull: true },
  ad_autoclick_ready_at: { type: DataTypes.DATE, allowNull: true },
  ad_magnet_ready_at: { type: DataTypes.DATE, allowNull: true },
  
  task_tg_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  task_x_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  task_yt_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  task_ig_claimed: { type: DataTypes.BOOLEAN, defaultValue: false }
});

Squad.hasMany(User, { foreignKey: 'squad_id' });
User.belongsTo(Squad, { foreignKey: 'squad_id' });

sequelize.sync({ alter: true }).then(() => console.log('✅ База даних успішно оновлена!'));

const LEVEL_THRESHOLDS = [0, 50000, 500000, 2500000, 10000000, 50000000, 250000000, 1000000000, 10000000000, 100000000000];

const MAX_ENERGY = 1000;
const MAX_OFFLINE_SECONDS = 3 * 60 * 60;

// ==========================================
// 🛡️ БАЗИ ДАНИХ ДЛЯ ЗАХИСТУ (СЕРВЕРНІ ЦІНИ)
// ==========================================
const SHOP_ITEMS_SERVER = {
  1: { baseCost: 1000, income: 100, reqRefs: 0 },
  2: { baseCost: 5000, income: 400, reqRefs: 0 },
  3: { baseCost: 15000, income: 800, reqRefs: 0 },
  4: { baseCost: 35000, income: 1300, reqRefs: 0 },
  5: { baseCost: 80000, income: 1900, reqRefs: 0 },
  6: { baseCost: 180000, income: 2600, reqRefs: 0 },
  7: { baseCost: 400000, income: 3400, reqRefs: 0 },
  8: { baseCost: 850000, income: 4300, reqRefs: 0 },
  9: { baseCost: 1800000, income: 5300, reqRefs: 3 },
  10: { baseCost: 3800000, income: 6500, reqRefs: 7 }
};

const ACHIEVEMENTS_SERVER = {
  'first_10k': { reward: 5000 },
  'lvl3': { reward: 25000 },
  'ref_3': { reward: 200000 },
  'ref_10': { reward: 1000000 },
  'ref_20': { reward: 5000000 }
};

const SKINS_SERVER = {
  'cool': 5000000,
  'rich': 10000000,
  'default': 0
};

// ==========================================
// 🔥 ТЕЛЕГРАМ БОТ
// ==========================================
const token = process.env.BOT_TOKEN;

if (token) {
  const bot = new TelegramBot(token, { polling: true });
  const webAppUrl = 'https://duck-clicker-production.up.railway.app'; 

  bot.setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: "Грати 🦆",
      web_app: { url: webAppUrl }
    }
  }).catch(err => console.error("Не вдалося встановити кнопку меню:", err));

  bot.onText(/\/start(?:\s+(.*))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const startParam = match[1] || ''; 
    const finalUrl = startParam ? `${webAppUrl}?start_param=${startParam}` : webAppUrl;

    const text = `🦆 <b>Вітаємо у Gold Duck!</b>\n\nТисни на качку, збирай золоті монети, запрошуй друзів та змагайся з іншими гравцями!\n\nНатискай кнопку нижче, щоб почати гру 👇`;

    const opts = {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎮 Відкрити гру", web_app: { url: finalUrl } }],
          [{ text: "🌐 Наш канал", url: "https://t.me/GoldDuckTap" }] 
        ]
      }
    };
    bot.sendMessage(chatId, text, opts);
  });
  console.log('✅ Телеграм бот успішно запущений!');
} else {
  console.log('⚠️ УВАГА: BOT_TOKEN не знайдено.');
}

// ==========================================
// ХЕЛПЕРИ
// ==========================================

const sendTelegramMessage = async (chatId, text) => {
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try { 
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }) }); 
  } catch (e) {}
};

const endSeasonAndNotify = async () => {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) return { error: "Немає ADMIN_TELEGRAM_ID" };
  try {
    const topUsers = await User.findAll({ order: [['total_earned', 'DESC']], limit: 11 });
    const topSquad = await Squad.findOne({ order: [['total_points', 'DESC']] });
    
    let msg = `🚨 <b>СЕЗОН ЗАВЕРШЕНО!</b> 🚨\n\n🏆 <b>ТОП ГРАВЦІ:</b>\n`;
    topUsers.forEach((u, i) => { 
      msg += `${i+1}. <a href="tg://user?id=${u.telegram_id}">${u.first_name}</a> — ${u.total_earned} 🏆\n`; 
    });
    
    await sendTelegramMessage(adminId, msg);
    
    // Обнуляємо прогрес і досягнення на старті нового сезону
    await User.update({ season_points: 0, total_earned: 0, level: 1, energy: MAX_ENERGY, passive_income: 0, businesses: {}, achievements: [] }, { where: {} });
    await Squad.update({ total_points: 0 }, { where: {} });
    return { success: true };
  } catch (error) { 
    return { error: "Внутрішня помилка" }; 
  }
};

// ==========================================
// 🔥 АВТОМАТИЧНЕ ОБНУЛЕННЯ СЕЗОНУ (CRON)
// ==========================================
cron.schedule('0 0 1 * *', async () => {
  console.log('⏳ Починаємо автоматичне обнулення сезону (за розкладом)...');
  try {
    const activeUsers = await User.count({ where: { total_earned: { [Op.gt]: 0 } } });
    if (activeUsers > 0) {
      const result = await endSeasonAndNotify();
      if (result.success) {
        console.log('✅ Новий сезон успішно автоматично стартував!');
      } else {
        console.error('❌ Помилка під час авто-обнулення сезону:', result.error);
      }
    } else {
      console.log('ℹ️ Активних гравців немає, обнулення пропущено.');
    }
  } catch (err) {
    console.error('❌ Критична помилка авто-обнулення:', err);
  }
}, {
  scheduled: true,
  timezone: "Europe/Kyiv" 
});

const calculateOfflineProgress = async (user) => {
  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lastReset = new Date(user.last_boost_reset); lastReset.setHours(0, 0, 0, 0);
  
  if (today > lastReset) { 
    user.free_energy_refills = 3; 
    user.ad_energy_left = 3; 
    user.ad_x5_left = 3; 
    user.ad_autoclick_left = 3; 
    user.ad_magnet_left = 3; 
    user.ad_energy_ready_at = null; 
    user.ad_x5_ready_at = null; 
    user.ad_autoclick_ready_at = null; 
    user.ad_magnet_ready_at = null;
    user.last_boost_reset = now; 
  }
  
  const secondsPassedEnergy = (now - new Date(user.last_energy_update)) / 1000;
  if (secondsPassedEnergy > 0) { 
    user.energy = Math.min(MAX_ENERGY, user.energy + Math.floor(secondsPassedEnergy / 3)); 
    user.last_energy_update = now; 
  }
  
  let passiveEarned = 0;
  let currentPassivePerSec = user.passive_income / 3600;
  
  if (user.auto_click_until && new Date(user.auto_click_until) > now) {
    const smart_tap_base = (user.level * 2) + Math.floor(currentPassivePerSec * 3);
    currentPassivePerSec += (smart_tap_base * 5); 
  }
  
  if (currentPassivePerSec > 0) {
    const secondsPassedPassive = (now - new Date(user.last_passive_collect)) / 1000;
    const cappedSeconds = Math.min(secondsPassedPassive, MAX_OFFLINE_SECONDS);
    passiveEarned = Math.floor(cappedSeconds * currentPassivePerSec);
    
    if (passiveEarned > 0) {
      user.season_points = Number(user.season_points) + passiveEarned; 
      user.total_earned = Number(user.total_earned) + passiveEarned; 
      user.last_passive_collect = now;
      
      let new_level = 1; 
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { 
        if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } 
      }
      user.level = new_level > 10 ? 10 : new_level;
      
      if (user.squad_id) {
        await Squad.increment('total_points', { by: passiveEarned, where: { username: user.squad_id } });
      }
    }
  }
  
  let dailyAvailable = false;
  const lastClaim = user.last_daily_claim ? new Date(user.last_daily_claim) : null;
  if (!lastClaim) {
    dailyAvailable = true;
  } else {
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
      res.on('end', () => { 
        try { 
          const result = JSON.parse(data); 
          resolve(result.ok && ['member', 'administrator', 'creator'].includes(result.result.status)); 
        } catch (e) { resolve(false); } 
      });
    }).on('error', () => resolve(false));
  });
};

// ==========================================
// ЕНДПОІНТИ
// ==========================================

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
      if (referrer_id && referrer_id !== String(telegram_id)) {
        startingPoints = 10000; 
        const referrer = await User.findByPk(String(referrer_id));
        if (referrer) { 
          referrer.season_points = Number(referrer.season_points) + 10000; 
          referrer.total_earned = Number(referrer.total_earned) + 10000; 
          referrer.referrals_count += 1; 
          await referrer.save(); 
        }
      }
      user = await User.create({ 
        telegram_id: String(telegram_id), 
        first_name: first_name || 'Гравець', 
        referrer_id: referrer_id ? String(referrer_id) : null, 
        season_points: startingPoints, 
        total_earned: startingPoints, 
        last_energy_update: new Date(), 
        last_passive_collect: new Date() 
      });
    }
    
    if (squad_to_join && user.squad_id !== squad_to_join) {
      let squad = await Squad.findByPk(squad_to_join); 
      if (!squad) squad = await Squad.create({ username: squad_to_join, name: `@${squad_to_join}` });
      if (user.squad_id) await Squad.decrement('members_count', { by: 1, where: { username: user.squad_id } });
      user.squad_id = squad_to_join; 
      await user.save(); 
      await Squad.increment('members_count', { by: 1, where: { username: squad_to_join } });
    }
    
    const progress = await calculateOfflineProgress(user);
    await progress.user.save(); 
    
    const active_boost = progress.user.boost_until && new Date(progress.user.boost_until) > new Date();
    const auto_click = progress.user.auto_click_until && new Date(progress.user.auto_click_until) > new Date();
    const active_daily_x2 = progress.user.daily_x2_until && new Date(progress.user.daily_x2_until) > new Date();
    
    res.json({ user: { ...progress.user.get(), active_boost, auto_click, active_daily_x2 }, offline_earned: progress.passiveEarned, daily_available: progress.dailyAvailable });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.get('/api/user/friends', async (req, res) => {
  const { telegram_id } = req.query;
  try {
    const friends = await User.findAll({
      where: { referrer_id: String(telegram_id) },
      attributes: ['telegram_id', 'first_name', 'level', 'total_earned', 'ref_reward_lvl3_claimed', 'ref_reward_lvl5_claimed']
    });
    res.json({ friends });
  } catch (err) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.post('/api/user/claim_ref_reward', async (req, res) => {
  const { telegram_id, friend_id, reward_level } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    const friend = await User.findByPk(String(friend_id));

    if (!user || !friend || friend.referrer_id !== String(telegram_id)) {
      return res.status(400).json({ error: 'Помилка доступу до реферала' });
    }

    if (friend.level < reward_level) {
      return res.status(400).json({ error: 'Друг ще не досяг цього рівня' });
    }

    let reward = 0;
    if (reward_level === 3 && !friend.ref_reward_lvl3_claimed) {
      reward = 50000;
      friend.ref_reward_lvl3_claimed = true;
    } else if (reward_level === 5 && !friend.ref_reward_lvl5_claimed) {
      reward = 250000;
      friend.ref_reward_lvl5_claimed = true;
    } else {
      return res.status(400).json({ error: 'Нагорода вже отримана' });
    }

    await friend.save();

    user.season_points = Number(user.season_points) + reward;
    user.total_earned = Number(user.total_earned) + reward;

    let new_level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; }
    }
    user.level = new_level > 10 ? 10 : new_level;

    await user.save();
    
    // 🔥 Виправляємо баг з бустами тут
    const now = new Date();
    const active_boost = user.boost_until && new Date(user.boost_until) > now;
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > now;
    const active_daily_x2 = user.daily_x2_until && new Date(user.daily_x2_until) > now;

    res.json({ user: { ...user.get(), active_boost, auto_click, active_daily_x2 }, reward });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/user/tap', async (req, res) => {
  const { telegram_id, count = 1 } = req.body;
  let actualTouches = Math.min(Number(count) || 1, 500);
  
  try {
    const user = await User.findByPk(String(telegram_id));
    if (!user) return res.status(404).json({ error: 'Not found' });
    await calculateOfflineProgress(user);
    
    actualTouches = Math.min(actualTouches, user.energy);
    if (actualTouches <= 0) return res.status(400).json({ error: 'Недостатньо енергії' });
    
    const active_boost = user.boost_until && new Date(user.boost_until) > new Date();
    const active_daily_x2 = user.daily_x2_until && new Date(user.daily_x2_until) > new Date();
    
    let current_mult = 1;
    if (active_daily_x2) current_mult = 2; 
    if (active_boost) current_mult = user.boost_multiplier; 
    
    const passive_per_sec = user.passive_income / 3600;
    const smart_tap_base = (user.level * 2) + Math.floor(passive_per_sec * 3); 
    
    const points_to_add = (smart_tap_base * current_mult) * actualTouches;
    
    user.season_points = Number(user.season_points) + points_to_add; 
    user.total_earned = Number(user.total_earned) + points_to_add; 
    user.energy -= actualTouches; 
    user.last_energy_update = new Date();
    
    let new_level = 1; 
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { 
      if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } 
    }
    user.level = new_level > 10 ? 10 : new_level;
    await user.save();
    
    if (user.squad_id) {
      await Squad.increment('total_points', { by: points_to_add, where: { username: user.squad_id } });
    }
    
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > new Date();
    res.json({ user: { ...user.get(), active_boost, auto_click, active_daily_x2 } });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.post('/api/user/ad_boost', async (req, res) => {
  const { telegram_id, boost_type, fallback } = req.body;
  const now = new Date();
  
  const AD_COOLDOWN_MS = 2 * 60 * 60 * 1000; 
  const cooldownEnd = new Date(now.getTime() + AD_COOLDOWN_MS);

  try {
    const user = await User.findByPk(String(telegram_id));
    await calculateOfflineProgress(user);

    if (boost_type === 'energy') { 
      if (user.ad_energy_left <= 0) return res.status(400).json({ error: 'Ліміт вичерпано (0/3)' });
      if (user.ad_energy_ready_at && new Date(user.ad_energy_ready_at) > now) return res.status(429).json({ error: 'Ще на перезарядці!' });
      if (!fallback) { user.energy = MAX_ENERGY; user.last_energy_update = now; }
      user.ad_energy_left -= 1; 
      user.ad_energy_ready_at = cooldownEnd;
    } else if (boost_type === 'x5') { 
      if (user.ad_x5_left <= 0) return res.status(400).json({ error: 'Ліміт вичерпано (0/3)' });
      if (user.ad_x5_ready_at && new Date(user.ad_x5_ready_at) > now) return res.status(429).json({ error: 'Ще на перезарядці!' });
      if (!fallback) { user.boost_until = new Date(now.getTime() + 5 * 60 * 1000); user.boost_multiplier = 5; }
      user.ad_x5_left -= 1; 
      user.ad_x5_ready_at = cooldownEnd;
    } else if (boost_type === 'autoclick') { 
      if (user.ad_autoclick_left <= 0) return res.status(400).json({ error: 'Ліміт вичерпано (0/3)' });
      if (user.ad_autoclick_ready_at && new Date(user.ad_autoclick_ready_at) > now) return res.status(429).json({ error: 'Ще на перезарядці!' });
      if (!fallback) { user.auto_click_until = new Date(now.getTime() + 3 * 60 * 1000); }
      user.ad_autoclick_left -= 1; 
      user.ad_autoclick_ready_at = cooldownEnd;
    } else if (boost_type === 'magnet') { 
      if (user.ad_magnet_left <= 0) return res.status(400).json({ error: 'Ліміт вичерпано (0/3)' });
      if (user.ad_magnet_ready_at && new Date(user.ad_magnet_ready_at) > now) return res.status(429).json({ error: 'Ще на перезарядці!' });
      
      const magnetReward = Math.max(5000, user.passive_income * 2);
      
      if (!fallback) { 
        user.season_points = Number(user.season_points) + magnetReward; 
        user.total_earned = Number(user.total_earned) + magnetReward; 
      }
      user.ad_magnet_left -= 1; 
      user.ad_magnet_ready_at = cooldownEnd;
    } else {
      return res.status(400).json({ error: 'Невідомий буст' });
    }

    if (fallback) {
      const fallbackReward = Math.max(1500, Math.floor(user.passive_income * 0.5));
      user.season_points = Number(user.season_points) + fallbackReward;
      user.total_earned = Number(user.total_earned) + fallbackReward;
    }

    let new_level = 1; 
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { 
      if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } 
    }
    user.level = new_level > 10 ? 10 : new_level;
    await user.save();
    
    const active_boost = user.boost_until && new Date(user.boost_until) > now;
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > now;
    const active_daily_x2 = user.daily_x2_until && new Date(user.daily_x2_until) > now;
    res.json({ user: { ...user.get(), active_boost, auto_click, active_daily_x2 } });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
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
      user.squad_id = cleanUsername; 
      await user.save(); 
      await Squad.increment('members_count', { by: 1, where: { username: cleanUsername } }); 
    }
    
    // 🔥 Виправляємо баг з бустами тут
    const now = new Date();
    const active_boost = user.boost_until && new Date(user.boost_until) > now;
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > now;
    const active_daily_x2 = user.daily_x2_until && new Date(user.daily_x2_until) > now;

    res.json({ user: { ...user.get(), active_boost, auto_click, active_daily_x2 }, squad: squad.get() });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.post('/api/user/buy_skin', async (req, res) => {
  const { telegram_id, skin_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    await calculateOfflineProgress(user);
    
    const realCost = SKINS_SERVER[skin_id] !== undefined ? SKINS_SERVER[skin_id] : 999999999;
    
    let skins = user.unlocked_skins || ['default'];
    if (skins.includes(skin_id)) {
      user.current_skin = skin_id;
    } else { 
      if (user.season_points < realCost) return res.status(400).json({ error: 'Недостатньо монет' }); 
      user.season_points = Number(user.season_points) - realCost; 
      skins.push(skin_id); 
      user.unlocked_skins = skins; 
      user.changed('unlocked_skins', true); 
      user.current_skin = skin_id; 
    }
    await user.save(); 
    
    // 🔥 Виправляємо баг з бустами тут
    const now = new Date();
    const active_boost = user.boost_until && new Date(user.boost_until) > now;
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > now;
    const active_daily_x2 = user.daily_x2_until && new Date(user.daily_x2_until) > now;

    res.json({ user: { ...user.get(), active_boost, auto_click, active_daily_x2 } });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.post('/api/user/buy_upgrade', async (req, res) => {
  const { telegram_id, item_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    await calculateOfflineProgress(user);
    
    const itemData = SHOP_ITEMS_SERVER[item_id];
    if (!itemData) return res.status(400).json({ error: 'Невідомий товар' });

    const ownedCount = user.businesses ? (user.businesses[item_id] || 0) : 0;
    const realCost = Math.floor(itemData.baseCost * Math.pow(1.3, ownedCount));
    const realIncome = itemData.income;
    const requiredRefs = itemData.reqRefs;
    
    if (user.season_points < realCost) return res.status(400).json({ error: 'Недостатньо монет' });
    if (user.referrals_count < requiredRefs) { 
      return res.status(400).json({ error: `Потрібно друзів: ${requiredRefs}` }); 
    }
    
    user.season_points = Number(user.season_points) - realCost; 
    user.passive_income += realIncome; 
    
    let biz = user.businesses || {}; 
    biz[item_id] = ownedCount + 1; 
    user.businesses = biz; 
    user.changed('businesses', true); 
    user.last_passive_collect = new Date(); 
    await user.save(); 
    
    // 🔥 Виправляємо баг з бустами тут
    const now = new Date();
    const active_boost = user.boost_until && new Date(user.boost_until) > now;
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > now;
    const active_daily_x2 = user.daily_x2_until && new Date(user.daily_x2_until) > now;

    res.json({ user: { ...user.get(), active_boost, auto_click, active_daily_x2 } });
  } catch (err) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.post('/api/user/achievement', async (req, res) => {
  const { telegram_id, achievement_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    await calculateOfflineProgress(user);
    
    const achData = ACHIEVEMENTS_SERVER[achievement_id];
    if (!achData) return res.status(400).json({ error: 'Невідоме досягнення' });
    const realReward = achData.reward;

    let achs = user.achievements || [];
    if (achs.includes(achievement_id)) return res.status(400).json({ error: 'Вже отримано' });
    
    if (achievement_id === 'ref_3' && user.referrals_count < 3) return res.status(400).json({ error: 'Недостатньо друзів' });
    if (achievement_id === 'ref_10' && user.referrals_count < 10) return res.status(400).json({ error: 'Недостатньо друзів' });
    if (achievement_id === 'ref_20' && user.referrals_count < 20) return res.status(400).json({ error: 'Недостатньо друзів' });
    
    achs.push(achievement_id); 
    user.achievements = achs; 
    user.changed('achievements', true); 
    
    user.season_points = Number(user.season_points) + realReward; 
    user.total_earned = Number(user.total_earned) + realReward; 
    
    let new_level = 1; 
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { 
      if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } 
    }
    user.level = new_level > 10 ? 10 : new_level; 
    await user.save(); 
    
    // 🔥 Виправляємо баг з бустами тут
    const now = new Date();
    const active_boost = user.boost_until && new Date(user.boost_until) > now;
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > now;
    const active_daily_x2 = user.daily_x2_until && new Date(user.daily_x2_until) > now;

    return res.json({ user: { ...user.get(), active_boost, auto_click, active_daily_x2 }, reward: realReward });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.post('/api/user/claim_task', async (req, res) => {
  const { telegram_id, task_type } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    if (!user) return res.status(404).json({ error: 'Not found' });

    if (user[`task_${task_type}_claimed`]) {
      return res.status(400).json({ error: 'Вже виконано' });
    }
    
    let reward = 10000; 
    
    if (task_type === 'tg') {  
      reward = 25000; 
      const isSubscribed = await checkTelegramSubscription(telegram_id); 
      if (!isSubscribed) return res.status(400).json({ error: 'not_subscribed' }); 
    }
    
    user[`task_${task_type}_claimed`] = true; 
    user.season_points = Number(user.season_points) + reward; 
    user.total_earned = Number(user.total_earned) + reward;
    
    let new_level = 1; 
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { 
      if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } 
    }
    user.level = new_level > 10 ? 10 : new_level; 
    
    await user.save(); 
    
    // 🔥 Виправляємо баг з бустами тут
    const now = new Date();
    const active_boost = user.boost_until && new Date(user.boost_until) > now;
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > now;
    const active_daily_x2 = user.daily_x2_until && new Date(user.daily_x2_until) > now;

    return res.json({ user: { ...user.get(), active_boost, auto_click, active_daily_x2 }, reward });
  } catch (err) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.post('/api/user/daily', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id)); 
    const progress = await calculateOfflineProgress(user);
    if (!progress.dailyAvailable) return res.status(400).json({ error: 'Вже отримано' });
    
    user.daily_streak = Math.min((user.daily_streak || 0) + 1, 7);
    
    let rewardMsg = '';
    if (user.daily_streak === 7) {
      const now = new Date();
      user.daily_x2_until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      rewardMsg = '24h_x2';
    } else {
      const bonusAmounts = [0, 500, 1000, 2500, 5000, 15000, 20000];
      user.season_points = Number(user.season_points) + bonusAmounts[user.daily_streak]; 
      user.total_earned = Number(user.total_earned) + bonusAmounts[user.daily_streak];
      rewardMsg = String(bonusAmounts[user.daily_streak]);
    }
    
    user.last_daily_claim = new Date(); 
    await user.save(); 
    
    // 🔥 Виправляємо баг з бустами тут (тут раніше перевірявся тільки daily_x2)
    const now = new Date();
    const active_boost = user.boost_until && new Date(user.boost_until) > now;
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > now;
    const active_daily_x2 = user.daily_x2_until && new Date(user.daily_x2_until) > now;

    res.json({ user: { ...user.get(), active_boost, auto_click, active_daily_x2 }, reward: rewardMsg });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.post('/api/user/reset', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    user.season_points = 0; 
    user.total_earned = 0; 
    user.level = 1; 
    user.energy = MAX_ENERGY; 
    user.passive_income = 0;
    user.daily_streak = 0; 
    user.last_daily_claim = null; 
    user.free_energy_refills = 3; 
    user.boost_until = null; 
    user.auto_click_until = null;
    user.daily_x2_until = null; 
    user.achievements = []; 
    user.unlocked_skins = ['default']; 
    user.current_skin = 'default'; 
    user.squad_id = null; 
    user.task_tg_claimed = false; 
    user.task_x_claimed = false; 
    user.task_yt_claimed = false; 
    user.task_ig_claimed = false;
    user.ad_energy_left = 3; 
    user.ad_x5_left = 3; 
    user.ad_autoclick_left = 3; 
    user.ad_magnet_left = 3;
    user.ad_energy_ready_at = null; 
    user.ad_x5_ready_at = null; 
    user.ad_autoclick_ready_at = null; 
    user.ad_magnet_ready_at = null; 
    user.businesses = {}; 
    await user.save(); 
    res.json({ user: user.get() });
  } catch (err) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.post('/api/admin/end_season', async (req, res) => { 
  const result = await endSeasonAndNotify(); 
  if (result.success) res.json({ success: true }); 
  else res.status(500).json({ error: result.error }); 
});

app.get('/api/leaderboard', async (req, res) => {
  const { telegram_id } = req.query;
  try {
    const topUsers = await User.findAll({ order: [['total_earned', 'DESC']], limit: 100, attributes: ['telegram_id', 'first_name', 'total_earned', 'level']});
    const topSquads = await Squad.findAll({ order: [['total_points', 'DESC']], limit: 50 });
    let currentUserRank = null; 
    let currentUserData = null;
    
    if (telegram_id) { 
      currentUserData = await User.findByPk(String(telegram_id), { attributes: ['telegram_id', 'first_name', 'total_earned', 'level', 'squad_id'] }); 
      if (currentUserData) { 
        const higherScoresCount = await User.count({ where: { total_earned: { [Op.gt]: currentUserData.total_earned } } }); 
        currentUserRank = higherScoresCount + 1; 
      } 
    }
    
    res.json({ players: topUsers, squads: topSquads, currentUser: currentUserData ? { ...currentUserData.get(), rank: currentUserRank } : null });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  } else {
    res.status(404).json({ error: 'API route not found' });
  }
});

app.listen(PORT, () => console.log(`🚀 Сервер працює на порту ${PORT}`));