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
  dialectOptions: process.env.DATABASE_URL ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {}
});

const User = sequelize.define('User', {
  telegram_id: { type: DataTypes.STRING, unique: true, primaryKey: true },
  first_name: { type: DataTypes.STRING, allowNull: false },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  season_points: { type: DataTypes.BIGINT, defaultValue: 0 },
  referrer_id: { type: DataTypes.STRING, allowNull: true },
  boost_until: { type: DataTypes.DATE, allowNull: true }
});

sequelize.sync({ alter: true }).then(() => {
  console.log('✅ База даних успішно підключена!');
}).catch(err => console.error('Помилка бази даних:', err));

// 🔥 СИСТЕМА РІВНІВ (9 рівнів, ціна х2 кожного разу) 🔥
// Скільки всього очок треба мати, щоб досягти рівня
const LEVEL_THRESHOLDS = [
  0,          // 1 рівень
  1000,       // 2 рівень
  2000,       // 3 рівень
  4000,       // 4 рівень
  8000,       // 5 рівень
  16000,      // 6 рівень
  32000,      // 7 рівень
  64000,      // 8 рівень
  128000      // 9 рівень (Максимум)
];

// --- API МАРШРУТИ ---

app.post('/api/user/init', async (req, res) => {
  const { telegram_id, first_name, referrer_id } = req.body;
  try {
    let user = await User.findByPk(String(telegram_id));
    if (!user) {
      const boostTime = referrer_id ? new Date(Date.now() + 12 * 60 * 60 * 1000) : null;
      user = await User.create({
        telegram_id: String(telegram_id),
        first_name: first_name || 'Гравець',
        referrer_id: referrer_id ? String(referrer_id) : null,
        boost_until: boostTime
      });
    }
    const active_boost = user.boost_until && new Date(user.boost_until) > new Date();
    res.json({ user: { ...user.get(), active_boost } });
  } catch (error) {
    console.error('Помилка ініціалізації:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.post('/api/user/tap', async (req, res) => {
  const { telegram_id } = req.body;
  try {
    const user = await User.findByPk(String(telegram_id));
    if (!user) return res.status(404).json({ error: 'Гравця не знайдено' });

    const active_boost = user.boost_until && new Date(user.boost_until) > new Date();
    
    // 🔥 МУЛЬТИ-ТАП: Очки за клік дорівнюють рівню гравця 🔥
    const base_tap = user.level; 
    const points_to_add = active_boost ? base_tap * 2 : base_tap;
    
    user.season_points = Number(user.season_points) + points_to_add;
    
    // Перевірка на підвищення рівня
    let new_level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (user.season_points >= LEVEL_THRESHOLDS[i]) {
        new_level = i + 1;
        break;
      }
    }
    user.level = new_level > 9 ? 9 : new_level; // Максимум 9 рівень

    await user.save();
    res.json({ user: { ...user.get(), active_boost } });
  } catch (error) {
    console.error('Помилка тапу:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  const { telegram_id } = req.query;
  try {
    const topUsers = await User.findAll({
      order: [['season_points', 'DESC']],
      limit: 11,
      attributes: ['telegram_id', 'first_name', 'season_points', 'level']
    });

    let currentUserRank = null;
    let currentUserData = null;

    if (telegram_id) {
      currentUserData = await User.findByPk(String(telegram_id), {
        attributes: ['telegram_id', 'first_name', 'season_points', 'level']
      });

      if (currentUserData) {
        const higherScoresCount = await User.count({
          where: { season_points: { [Op.gt]: currentUserData.season_points } }
        });
        currentUserRank = higherScoresCount + 1; 
      }
    }

    res.json({ 
      leaderboard: topUsers,
      currentUser: currentUserData ? { ...currentUserData.get(), rank: currentUserRank } : null
    });
  } catch (error) {
    console.error('Помилка отримання рейтингу:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер працює на порту ${PORT}`);
});