import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Sequelize, DataTypes } from 'sequelize';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Дозволяємо фронтенду спілкуватися з бекендом
app.use(cors());
app.use(express.json());

// Підключення до бази даних PostgreSQL (Railway)
// Якщо DATABASE_URL немає (запускаємо на комп'ютері без бази), сервер не впаде, а просто попередить.
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

// Створюємо таблицю "Користувачі" в базі даних
const User = sequelize.define('User', {
  telegram_id: { type: DataTypes.STRING, unique: true, primaryKey: true },
  first_name: { type: DataTypes.STRING, allowNull: false },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  season_points: { type: DataTypes.BIGINT, defaultValue: 0 },
  referrer_id: { type: DataTypes.STRING, allowNull: true },
  boost_until: { type: DataTypes.DATE, allowNull: true }
});

// Синхронізуємо базу даних
sequelize.sync().then(() => {
  console.log('✅ База даних успішно підключена та синхронізована!');
}).catch(err => console.error('Помилка бази даних:', err));

// --- API МАРШРУТИ ---

// 1. Авторизація / Реєстрація при вході в гру
app.post('/api/user/init', async (req, res) => {
  const { telegram_id, first_name, referrer_id } = req.body;

  try {
    let user = await User.findByPk(telegram_id);

    if (!user) {
      // Якщо гравця немає в базі - створюємо його!
      // Якщо він прийшов по реферальному посиланню, даємо йому буст на 12 годин
      const boostTime = referrer_id ? new Date(Date.now() + 12 * 60 * 60 * 1000) : null;
      
      user = await User.create({
        telegram_id: String(telegram_id),
        first_name,
        referrer_id: referrer_id ? String(referrer_id) : null,
        boost_until: boostTime
      });
    }

    // Перевіряємо, чи діє ще буст (чи поточний час менший за час закінчення бусту)
    const active_boost = user.boost_until && new Date(user.boost_until) > new Date();

    res.json({ user: { ...user.get(), active_boost } });
  } catch (error) {
    console.error('Помилка ініціалізації:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// 2. Збереження кліків (Тап)
app.post('/api/user/tap', async (req, res) => {
  const { telegram_id } = req.body;

  try {
    const user = await User.findByPk(telegram_id);
    if (!user) return res.status(404).json({ error: 'Гравця не знайдено' });

    const active_boost = user.boost_until && new Date(user.boost_until) > new Date();
    
    // Якщо є буст - даємо 2 очки, якщо ні - 1
    const points_to_add = active_boost ? 2 : 1;
    
    user.season_points = Number(user.season_points) + points_to_add;
    
    // Логіка підвищення рівня (базова)
    if (user.season_points >= 1000 && user.level === 1) user.level = 2;
    if (user.season_points >= 5000 && user.level === 2) user.level = 3;

    await user.save();
    res.json({ user: { ...user.get(), active_boost } });
  } catch (error) {
    console.error('Помилка тапу:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер працює на порту ${PORT}`);
});