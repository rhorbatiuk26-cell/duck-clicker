import { useState, useEffect } from 'react';
import axios from 'axios';

// Твій бойовий сервер на Railway підключено!
const SERVER_URL = 'https://duck-clicker-production.up.railway.app/api';

const DUCK_IMAGE = 'https://cdn.pixabay.com/photo/2024/03/17/14/06/duck-pauper-mobile-game-illustration.png';

function App() {
  const [userData, setUserData] = useState(null);
  const [points, setPoints] = useState(0);
  const [error, setError] = useState(null);

  const tg = window.Telegram.WebApp;
  const user = tg.initDataUnsafe?.user;
  const startParam = tg.initDataUnsafe?.start_param; // Реферальний ID

  useEffect(() => {
    // Розгортаємо додаток на весь екран при запуску
    tg.expand();

    const fetchUser = async () => {
      if (!user) return;

      try {
        const response = await axios.post(`${SERVER_URL}/user/init`, {
          telegram_id: user.id,
          first_name: user.first_name || 'Гравець',
          referrer_id: startParam || null
        });

        setUserData(response.data.user);
        setPoints(Number(response.data.user.season_points));
      } catch (err) {
        console.error('Помилка зв\'язку з сервером:', err);
        setError('Не вдалося підключитися до сервера 🦆 Перевір базу даних!');
      }
    };

    fetchUser();
  }, [user, startParam]);

  const handleTap = async () => {
    if (!userData) return;

    // Вібрація (працює на телефонах)
    tg.HapticFeedback.impactOccurred('light');

    // Оновлюємо візуал одразу для швидкості (додаємо 2 очки якщо є буст, інакше 1)
    const tapValue = userData.active_boost ? 2 : 1;
    setPoints(prev => prev + tapValue);

    // Відправляємо клік на сервер
    try {
      const response = await axios.post(`${SERVER_URL}/user/tap`, {
        telegram_id: userData.telegram_id
      });
      setUserData(response.data.user);
    } catch (err) {
      console.error('Помилка збереження тапу:', err);
    }
  };

  // Якщо відкрили не в Телеграмі
  if (!user) {
    return <div className="h-screen bg-gray-950 text-white flex items-center justify-center font-bold">Відкрий гру через Telegram!</div>;
  }

  // Якщо помилка сервера (наприклад, база даних ще не запустилася)
  if (error) {
    return (
      <div className="flex flex-col h-screen bg-gray-950 text-red-500 items-center justify-center p-6 text-center">
        <p className="text-xl font-bold mb-4">{error}</p>
        <p className="text-sm text-gray-400">Сервер Railway завантажується, спробуй через хвилину.</p>
      </div>
    );
  }

  // Поки дані вантажаться
  if (!userData) {
    return <div className="h-screen bg-gray-950 text-yellow-400 flex items-center justify-center font-bold animate-pulse">Підключення до бази даних...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-between h-screen py-8 px-4 bg-gray-950 select-none">
      {/* Шапка */}
      <div className="text-center w-full mt-4">
        <h1 className="text-2xl font-bold mb-2 text-white">
          Привіт, {userData.first_name}! 👋
        </h1>

        {userData.active_boost && (
          <div className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 animate-bounce shadow-lg shadow-green-500/50">
            🔥 АКТИВНИЙ БУСТ: x2 ОЧОК!
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider font-bold">Твій сезонний баланс</p>
          <p className="text-5xl font-black text-yellow-400 mt-1">{points} <span className="text-3xl">💰</span></p>
        </div>
      </div>

      {/* Зона кліку */}
      <div
        className="relative active:scale-95 transition-transform duration-100 cursor-pointer flex-1 flex items-center justify-center w-full"
        onClick={handleTap}
      >
        <div className="absolute bg-yellow-500/20 w-64 h-64 rounded-full blur-3xl -z-10"></div>
        <img
          src={DUCK_IMAGE}
          alt="Duck Mascot"
          className="w-64 h-64 object-contain drop-shadow-2xl pointer-events-none"
        />
      </div>

      {/* Низ: Прогрес бар та Рівень */}
      <div className="w-full bg-gray-800 p-4 rounded-3xl border border-gray-700 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-white">Рівень {userData.level}</span>
          <span className="text-xs text-gray-400 font-bold bg-gray-700 px-2 py-1 rounded-lg">
            {userData.level === 1 ? 'Бродяга' : 'Розвивається...'}
          </span>
        </div>
        <div className="w-full bg-gray-900 rounded-full h-4 overflow-hidden">
          <div
            className="bg-yellow-400 h-full transition-all duration-300 rounded-full"
            style={{ width: `${Math.min((points % 1000) / 1000 * 100, 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default App;