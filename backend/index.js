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

// ==========================================
// БАЗА ДАНИХ (SEQUELIZE)
// ==========================================

const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite::memory:', {
  dialect: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
  protocol: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
  logging: false,
  dialectOptions: process.env.DATABASE_URL ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {}
});

// Модель Скваду
const Squad = sequelize.define('Squad', {
  username: { type: DataTypes.STRING, unique: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  total_points: { type: DataTypes.BIGINT, defaultValue: 0 },
  members_count: { type: DataTypes.INTEGER, defaultValue: 0 }
});

// Модель Користувача
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
  ad_energy_ready_at: { type: DataTypes.DATE, allowNull: true },
  ad_x5_ready_at: { type: DataTypes.DATE, allowNull: true },
  ad_autoclick_ready_at: { type: DataTypes.DATE, allowNull: true },
  ad_magnet_ready_at: { type: DataTypes.DATE, allowNull: true },
  
  task_tg_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  task_x_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  task_yt_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
  task_ig_claimed: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// Зв'язки
Squad.hasMany(User, { foreignKey: 'squad_id' });
User.belongsTo(Squad, { foreignKey: 'squad_id' });

// Синхронізація БД
sequelize.sync({ alter: true }).then(() => console.log('✅ База даних успішно оновлена!'));

// ==========================================
// КОНСТАНТИ ГРИ ТА ХЕЛПЕРИ
// ==========================================

const LEVEL_THRESHOLDS = [0, 50000, 500000, 2500000, 10000000, 50000000, 250000000, 1000000000, 10000000000, 100000000000];
const MAX_ENERGY = 2000;
const MAX_OFFLINE_SECONDS = 3 * 60 * 60; // 3 години ліміт офлайн доходу

// Словник вимог рефералів для магазину
const SHOP_ITEMS_DB = {
  1: { reqRefs: 0 }, 2: { reqRefs: 0 }, 3: { reqRefs: 0 }, 4: { reqRefs: 0 }, 
  5: { reqRefs: 0 }, 6: { reqRefs: 0 }, 7: { reqRefs: 0 }, 8: { reqRefs: 0 },
  9: { reqRefs: 3 }, // Crypto Exchange вимагає 3 друга
  10: { reqRefs: 7 } // TV Channel вимагає 7 друзів
};

// Функція відправки повідомлення адміну
const sendTelegramMessage = async (chatId, text) => {
  const token = process.env.BOT_TOKEN;
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try { 
    await fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }) 
    }); 
  } catch (e) {
    console.error("Помилка відправки повідомлення адміну:", e);
  }
};

// Завершення сезону та звіт
const endSeasonAndNotify = async () => {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) return { error: "Немає ADMIN_TELEGRAM_ID" };
  
  try {
    const topUsers = await User.findAll({ order: [['total_earned', 'DESC']], limit: 11 });
    const topSquad = await Squad.findOne({ order: [['total_points', 'DESC']] });
    
    let msg = `🚨 <b>СЕЗОН ЗАВЕРШЕНО!</b> 🚨\n\n🏆 <b>ТОП-11 ГРАВЦІВ:</b>\n`;
    topUsers.forEach((u, i) => { 
      msg += `${i+1}. <a href="tg://user?id=${u.telegram_id}">${u.first_name}</a> — ${u.total_earned.toLocaleString()} 💰\n`; 
    });

    msg += `\n🛡 <b>ТОП-1 СКВАД:</b>\n`;
    if (topSquad) {
      msg += `👑 <b>${topSquad.name}</b>\nБаланс: ${topSquad.total_points.toLocaleString()} 🏆\nУчасників: ${topSquad.members_count}`;
    } else {
      msg += `Сквадів немає.`;
    }
    
    await sendTelegramMessage(adminId, msg);
    
    // Обнулення сезону
    await User.update({ 
      season_points: 0, 
      total_earned: 0, 
      level: 1, 
      energy: MAX_ENERGY, 
      passive_income: 0, 
      businesses: {} 
    }, { where: {} });
    
    await Squad.update({ total_points: 0 }, { where: {} });
    
    return { success: true };
  } catch (error) { 
    return { error: "Внутрішня помилка" }; 
  }
};

// Перевірка часу завершення сезону (кожні 30 хв)
setInterval(async () => {
  const now = new Date();
  // Кожного 1-го числа о 00:00
  if (now.getDate() === 1 && now.getHours() === 0) {
    const activeUsers = await User.count({ where: { total_earned: { [Op.gt]: 0 } } });
    if (activeUsers > 0) await endSeasonAndNotify();
  }
}, 1000 * 60 * 30);

// Розрахунок офлайн прогресу (Енергія + Офлайн дохід + Щоденний бонус)
const calculateOfflineProgress = async (user) => {
  const now = new Date();
  const today = new Date(); 
  today.setHours(0, 0, 0, 0); // Початок сьогоднішнього дня

  // 1. Скидання щоденних лімітів о 00:00
  const lastReset = new Date(user.last_boost_reset); 
  lastReset.setHours(0, 0, 0, 0);
  
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
  
  // 2. Регенерація енергії (1 одиниця / 3 сек)
  const secondsPassedEnergy = (now - new Date(user.last_energy_update)) / 1000;
  if (secondsPassedEnergy > 0) { 
    user.energy = Math.min(MAX_ENERGY, user.energy + Math.floor(secondsPassedEnergy / 3)); 
    user.last_energy_update = now; 
  }
  
  // 3. Розрахунок офлайн доходу
  let passiveEarned = 0;
  let currentPassivePerSec = user.passive_income / 3600;
  
  // Додаємо дохід від автоклікера, якщо він активний
  if (user.auto_click_until && new Date(user.auto_click_until) > now) {
    currentPassivePerSec += (7 * user.level);
  }
  
  if (currentPassivePerSec > 0) {
    const secondsPassedPassive = (now - new Date(user.last_passive_collect)) / 1000;
    // Обмеження 3 години
    const cappedSeconds = Math.min(secondsPassedPassive, MAX_OFFLINE_SECONDS);
    passiveEarned = Math.floor(cappedSeconds * currentPassivePerSec);
    
    if (passiveEarned > 0) {
      user.season_points = Number(user.season_points) + passiveEarned; 
      user.total_earned = Number(user.total_earned) + passiveEarned; 
      user.last_passive_collect = now;
      
      // Оновлення рівня
      let new_level = 1; 
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { 
        if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } 
      }
      user.level = new_level > 10 ? 10 : new_level;
      
      // Додавання очок скваду
      if (user.squad_id) {
        await Squad.increment('total_points', { by: passiveEarned, where: { username: user.squad_id } });
      }
    }
  }
  
  // 4. Перевірка доступності щоденного бонусу
  let dailyAvailable = false;
  const lastClaim = user.last_daily_claim ? new Date(user.last_daily_claim) : null;
  if (!lastClaim) {
    dailyAvailable = true;
  } else {
    const claimDay = new Date(lastClaim); 
    claimDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - claimDay) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) dailyAvailable = true; // Можна забирати (наступний день)
    else if (diffDays > 1) { dailyAvailable = true; user.daily_streak = 0; } // Стрік перервано
  }
  
  return { user, passiveEarned, dailyAvailable };
};

// Перевірка підписки на канал Telegram
const checkTelegramSubscription = (userId) => {
  return new Promise((resolve) => {
    const botToken = process.env.BOT_TOKEN; 
    const channel = process.env.CHANNEL_USERNAME;
    
    if (!botToken || !channel) return resolve(false);
    
    https.get(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${channel}&user_id=${userId}`, (res) => {
      let data = ''; 
      res.on('data', chunk => data += chunk);
      res.on('end', () => { 
        try { 
          const result = JSON.parse(data); 
          resolve(result.ok && ['member', 'administrator', 'creator'].includes(result.result.status)); 
        } catch (e) { 
          resolve(false); 
        } 
      });
    }).on('error', () => resolve(false));
  });
};

// ==========================================
// ЕНДПОІНТИ (API REST)
// ==========================================

// Ініціалізація користувача
app.post('/api/user/init', async (req, res) => {
  const { telegram_id, first_name, start_param } = req.body;
  try {
    let user = await User.findByPk(String(telegram_id), { include: Squad });
    let referrer_id = null; 
    let squad_to_join = null;
    
    // Обробка deep link params
    if (start_param) { 
      if (start_param.startsWith('squad_')) {
        squad_to_join = start_param.replace('squad_', ''); 
      } else {
        referrer_id = start_param; 
      }
    }
    
    // Створення нового користувача
    if (!user) {
      let startingPoints = 0;
      // Бонус за реферальне посилання
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
    
    // Автоматичний вступ у сквад
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
    
    res.json({ 
      user: { ...progress.user.get(), active_boost, auto_click }, 
      offline_earned: progress.passiveEarned, 
      daily_available: progress.dailyAvailable 
    });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Список друзів
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

// Отримання нагороди за рівень друга
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
    res.json({ user: user.get(), reward });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Тап/Клік
app.post('/api/user/tap', async (req, res) => {
  const { telegram_id, count = 1 } = req.body;
  // Ліміт тапів за один запит для безпеки
  const actualTouches = Math.min(Number(count) || 10, 15);
  
  try {
    const user = await User.findByPk(String(telegram_id));
    if (!user) return res.status(404).json({ error: 'Not found' });
    
    await calculateOfflineProgress(user);
    
    if (user.energy < actualTouches) return res.status(400).json({ error: 'Недостатньо енергії' });
    
    const active_boost = user.boost_until && new Date(user.boost_until) > new Date();
    // Розрахунок сили тапа
    const points_to_add = (user.level * (active_boost ? user.boost_multiplier : 1)) * actualTouches;
    
    user.season_points = Number(user.season_points) + points_to_add; 
    user.total_earned = Number(user.total_earned) + points_to_add; 
    user.energy -= actualTouches; 
    user.last_energy_update = new Date();
    
    // Оновлення рівня
    let new_level = 1; 
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { 
      if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } 
    }
    user.level = new_level > 10 ? 10 : new_level;
    
    await user.save();
    
    // Окуляри скваду
    if (user.squad_id) {
      await Squad.increment('total_points', { by: points_to_add, where: { username: user.squad_id } });
    }
    
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > new Date();
    res.json({ user: { ...user.get(), active_boost, auto_click } });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Рекламні бусти
app.post('/api/user/ad_boost', async (req, res) => {
  const { telegram_id, boost_type, fallback } = req.body;
  const now = new Date();
  const AD_COOLDOWN_MS = 60 * 60 * 1000; // 1 година кд
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
      if (!fallback) { user.boost_until = new Date(now.getTime() + 5 * 60 * 1000); user.boost_multiplier = 5; } // 5 хв буст
      user.ad_x5_left -= 1; 
      user.ad_x5_ready_at = cooldownEnd;
      
    } else if (boost_type === 'autoclick') { 
      if (user.ad_autoclick_left <= 0) return res.status(400).json({ error: 'Ліміт вичерпано (0/3)' });
      if (user.ad_autoclick_ready_at && new Date(user.ad_autoclick_ready_at) > now) return res.status(429).json({ error: 'Ще на перезарядці!' });
      if (!fallback) { user.auto_click_until = new Date(now.getTime() + 3 * 60 * 1000); } // 3 хв автоклікер
      user.ad_autoclick_left -= 1; 
      user.ad_autoclick_ready_at = cooldownEnd;
      
    } else if (boost_type === 'magnet') { 
      if (user.ad_magnet_left <= 0) return res.status(400).json({ error: 'Ліміт вичерпано (0/3)' });
      if (user.ad_magnet_ready_at && new Date(user.ad_magnet_ready_at) > now) return res.status(429).json({ error: 'Ще на перезарядці!' });
      if (!fallback) { user.season_points = Number(user.season_points) + 5000; user.total_earned = Number(user.total_earned) + 5000; }
      user.ad_magnet_left -= 1; 
      user.ad_magnet_ready_at = cooldownEnd;
      
    } else {
      return res.status(400).json({ error: 'Невідомий буст' });
    }

    // Якщо реклама не завантажилась (fallback), даємо фіксований бонус
    if (fallback) {
      user.season_points = Number(user.season_points) + 1500;
      user.total_earned = Number(user.total_earned) + 1500;
    }

    // Рівень
    let new_level = 1; 
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { 
      if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } 
    }
    user.level = new_level > 10 ? 10 : new_level;
    
    await user.save();
    
    const active_boost = user.boost_until && new Date(user.boost_until) > now;
    const auto_click = user.auto_click_until && new Date(user.auto_click_until) > now;
    
    res.json({ user: { ...user.get(), active_boost, auto_click } });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Вступ у сквад (вручну)
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
    
    res.json({ user: user.get(), squad: squad.get() });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Купівля скіна
app.post('/api/user/buy_skin', async (req, res) => {
  const { telegram_id, skin_id, cost } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    await calculateOfflineProgress(user);
    
    let skins = user.unlocked_skins || ['default'];
    // Якщо скін вже куплений - просто одягаємо
    if (skins.includes(skin_id)) {
      user.current_skin = skin_id;
    } else { 
      if (user.season_points < cost) return res.status(400).json({ error: 'Недостатньо монет' }); 
      user.season_points = Number(user.season_points) - cost; 
      skins.push(skin_id); 
      user.unlocked_skins = skins; 
      user.current_skin = skin_id; 
    }
    
    await user.save(); 
    res.json({ user: user.get() });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Купівля бізнесу (уапгрейд пасивного доходу)
app.post('/api/user/buy_upgrade', async (req, res) => {
  const { telegram_id, item_id, cost, income_increase } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    await calculateOfflineProgress(user);
    
    if (user.season_points < cost) return res.status(400).json({ error: 'Недостатньо монет' });
    
    // Перевірка вимог рефералів
    const requiredRefs = SHOP_ITEMS_DB[item_id]?.reqRefs || 0;
    if (user.referrals_count < requiredRefs) { 
      return res.status(400).json({ error: `Потрібно ${requiredRefs} активних друзів.` }); 
    }
    
    user.season_points = Number(user.season_points) - cost; 
    user.passive_income += income_increase; 
    
    let biz = user.businesses || {}; 
    biz[item_id] = (biz[item_id] || 0) + 1; // Збільшуємо кількість
    user.businesses = biz; 
    user.changed('businesses', true); // Явно кажемо Sequelize оновити JSON
    user.last_passive_collect = new Date(); 
    
    await user.save(); 
    res.json({ user: user.get() });
  } catch (err) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Отримання досягнення
app.post('/api/user/achievement', async (req, res) => {
  const { telegram_id, achievement_id, reward } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    await calculateOfflineProgress(user);
    
    let achs = user.achievements || [];
    if (achs.includes(achievement_id)) return res.status(400).json({ error: 'Вже отримано' });
    
    // Валідація на сервері
    if (achievement_id === 'ref_3' && user.referrals_count < 3) return res.status(400).json({ error: 'Мало друзів' });
    if (achievement_id === 'ref_10' && user.referrals_count < 10) return res.status(400).json({ error: 'Мало друзів' });
    
    achs.push(achievement_id); 
    user.achievements = achs; 
    user.season_points = Number(user.season_points) + reward; 
    user.total_earned = Number(user.total_earned) + reward; 
    
    let new_level = 1; 
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { 
      if (user.total_earned >= LEVEL_THRESHOLDS[i]) { new_level = i + 1; break; } 
    }
    user.level = new_level > 10 ? 10 : new_level; 
    
    await user.save(); 
    return res.json({ user: user.get(), reward });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Забирання щоденного бонусу
app.post('/api/user/daily', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id)); 
    const progress = await calculateOfflineProgress(user);
    
    if (!progress.dailyAvailable) return res.status(400).json({ error: 'Вже отримано' });
    
    // Стрік макс 7 днів
    user.daily_streak = Math.min((user.daily_streak || 0) + 1, 7);
    const bonusAmounts = [0, 500, 1000, 2500, 5000, 15000, 30000, 100000]; // Бонуси по дням
    const reward = bonusAmounts[user.daily_streak];
    
    user.season_points = Number(user.season_points) + reward; 
    user.total_earned = Number(user.total_earned) + reward;
    user.last_daily_claim = new Date(); 
    
    await user.save(); 
    res.json({ user: user.get(), reward });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Виконання соціального завдання (ТГ підписка)
app.post('/api/user/claim_task', async (req, res) => {
  const { telegram_id, task_type } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user[`task_${task_type}_claimed`]) return res.status(400).json({ error: 'Вже виконано' });
    
    let reward = 10000; 
    if (task_type === 'telegram') { 
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
    return res.json({ user: user.get(), reward });
  } catch (err) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Скидання прогресу (Settings -> Reset)
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
    user.achievements = []; 
    user.unlocked_skins = ['default']; 
    user.current_skin = 'default'; 
    user.squad_id = null; 
    user.task_tg_claimed = false; 
    user.task_x_claimed = false; 
    user.ad_energy_left = 3; 
    user.ad_x5_left = 3; 
    user.ad_autoclick_left = 3; 
    user.ad_magnet_left = 3; 
    user.businesses = {}; 
    
    await user.save(); 
    res.json({ user: user.get() });
  } catch (err) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// Ендпоінт для адміна: ручне завершення сезону
app.post('/api/admin/end_season', async (req, res) => { 
  const { admin_id } = req.body;
  if (String(admin_id) !== process.env.ADMIN_TELEGRAM_ID) return res.status(403).json({ error: "No access" });
  
  const result = await endSeasonAndNotify(); 
  if (result.success) res.json({ success: true }); 
  else res.status(500).json({ error: result.error }); 
});

// Таблиця лідерів
app.get('/api/leaderboard', async (req, res) => {
  const { telegram_id } = req.query;
  try {
    // Топ 100 гравців
    const topUsers = await User.findAll({ 
      order: [['total_earned', 'DESC']], 
      limit: 100, 
      attributes: ['telegram_id', 'first_name', 'total_earned', 'level']
    });
    
    // Топ 50 сквадів
    const topSquads = await Squad.findAll({ 
      order: [['total_points', 'DESC']], 
      limit: 50 
    });
    
    // Ранг поточного гравця
    let currentUserRank = null; 
    let currentUserData = null;
    
    if (telegram_id) { 
      currentUserData = await User.findByPk(String(telegram_id), { 
        attributes: ['telegram_id', 'first_name', 'total_earned', 'level', 'squad_id'] 
      }); 
      
      if (currentUserData) { 
        const higherScoresCount = await User.count({ 
          where: { total_earned: { [Op.gt]: currentUserData.total_earned } } 
        }); 
        currentUserRank = higherScoresCount + 1; 
      } 
    }
    
    res.json({ 
      players: topUsers, 
      squads: topSquads, 
      currentUser: currentUserData ? { ...currentUserData.get(), rank: currentUserRank } : null 
    });
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
});

// ==========================================
// ЛОГІКА ТЕЛЕГРАМ БОТА (Long Polling)
// ==========================================
const botToken = process.env.BOT_TOKEN;
const webAppUrl = 'https://duck-clicker-production.up.railway.app'; // Твій лінк на Railway фронтенд

if (botToken) {
  let lastUpdateId = 0;
  
  const pollTelegram = async () => {
    try {
      // Запит нових повідомлень (з таймаутом для економії)
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=50`);
      const data = await res.json();
      
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          
          if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            
            // Якщо модератор/гравець пише /start
            if (text.startsWith('/start')) {
              // Перевірка реферального параметру: /start 123456
              const startParam = text.split(' ')[1] || ''; 
              
              const msgText = `🦆 <b>Привіт в Gold Duck!</b>\n\nЦе не просто клікер. Це чесна гра, де ми віддаємо 20% доходу від реклами ТОП-гравцям та сквадам кожного місяця.\n\nТвій час — це твоя валюта! Жодних донатів.\n\n👇 <b>Натискай кнопку, щоб почати:</b>`;
              
              // Формуємо лінк для WebApp з реф. параметром
              const finalUrl = startParam ? `${webAppUrl}?tgWebAppStartParam=${startParam}` : webAppUrl;

              // Відправка повідомлення з Inline-кнопкою "Play"
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: msgText,
                  parse_mode: 'HTML',
                  reply_markup: {
                    inline_keyboard: [[
                      { text: "🎮 ГРАТИ / PLAY", web_app: { url: finalUrl } }
                    ]]
                  }
                })
              });
            }
          }
        }
      }
    } catch (e) {
      // Тиха обробка помилок мережі
    }
    // Рекурсивний виклик через 1 сек
    setTimeout(pollTelegram, 1000);
  };
  
  console.log('🤖 Telegram Бот-слухач запущений...');
  pollTelegram(); // Запуск циклу
}

// Запуск сервера Express
app.listen(PORT, () => console.log(`🚀 Сервер працює на порту ${PORT}`));