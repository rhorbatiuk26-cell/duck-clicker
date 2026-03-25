import { useState, useEffect } from 'react';
import axios from 'axios';

// Твій бойовий сервер!
const SERVER_URL = 'https://duck-clicker-production.up.railway.app/api';

const DUCK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🦆%3C/text%3E%3C/svg%3E";

function App() {
  const [userData, setUserData] = useState(null);
  const [points, setPoints] = useState(0);
  const [error, setError] = useState(null);
  
  // Стан для Таблиці Лідерів
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [isLoadingLeaders, setIsLoadingLeaders] = useState(false);

  const tg = window.Telegram.WebApp;
  const user = tg.initDataUnsafe?.user;
  const startParam = tg.initDataUnsafe?.start_param;

  useEffect(() => {
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
        setError('Не вдалося підключитися до сервера 🦆');
      }
    };

    fetchUser();
  }, [user, startParam]);

  const handleTap = async () => {
    if (!userData || showLeaderboard) return; // Блокуємо тап, якщо відкрито рейтинг

    tg.HapticFeedback.impactOccurred('light');

    const tapValue = userData.active_boost ? 2 : 1;
    setPoints(prev => prev + tapValue);

    try {
      const response = await axios.post(`${SERVER_URL}/user/tap`, {
        telegram_id: userData.telegram_id
      });
      setUserData(response.data.user);
    } catch (err) {
      console.error('Помилка збереження тапу:', err);
    }
  };

  // Функція для завантаження рейтингу
  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    setIsLoadingLeaders(true);
    tg.HapticFeedback.impactOccurred('medium');
    
    try {
      const response = await axios.get(`${SERVER_URL}/leaderboard`);
      setLeaderboardData(response.data.leaderboard);
    } catch (err) {
      console.error('Не вдалося завантажити рейтинг', err);
    } finally {
      setIsLoadingLeaders(false);
    }
  };

  if (!user) {
    return <div className="h-screen bg-gray-950 text-white flex items-center justify-center font-bold">Відкрий гру через Telegram!</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-gray-950 text-red-500 items-center justify-center p-6 text-center">
        <p className="text-xl font-bold mb-4">{error}</p>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="h-screen bg-gray-950 text-yellow-400 flex flex-col items-center justify-center font-bold">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-400 mb-6"></div>
        <p className="animate-pulse text-lg tracking-widest">Вилуплюємо каченя... 🥚</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-between h-screen py-8 px-4 bg-gray-950 select-none overflow-hidden">
      
      {/* Шапка */}
      <div className="text-center w-full mt-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-white">Привіт, {userData.first_name}! 👋</h1>
          {/* Кнопка Рейтингу */}
          <button 
            onClick={openLeaderboard}
            className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-2 px-4 rounded-xl shadow-lg transition-transform active:scale-95"
          >
            🏆 Рейтинг
          </button>
        </div>

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
      <div className="w-full bg-gray-800 p-4 rounded-3xl border border-gray-700 mb-2">
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

      {/* МОДАЛЬНЕ ВІКНО: ТАБЛИЦЯ ЛІДЕРІВ */}
      {showLeaderboard && (
        <div className="absolute inset-0 z-50 bg-gray-950/95 flex flex-col p-6 animate-fade-in backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6 mt-4">
            <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest">ТОП Сезону</h2>
            <button 
              onClick={() => setShowLeaderboard(false)}
              className="bg-gray-800 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-900 rounded-3xl p-4 border border-gray-700">
            {isLoadingLeaders ? (
              <div className="flex justify-center items-center h-full text-yellow-400">
                <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-yellow-400"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {leaderboardData.map((player, index) => (
                  <div 
                    key={player.telegram_id} 
                    className={`flex items-center justify-between p-3 rounded-2xl ${
                      index === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 
                      index === 1 ? 'bg-gray-300/10 border border-gray-300/30' : 
                      index === 2 ? 'bg-orange-500/10 border border-orange-500/30' : 
                      'bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`font-black text-lg w-6 text-center ${
                        index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-400' : 'text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">
                          {player.first_name} {player.telegram_id === String(user.id) ? '(Ти)' : ''}
                        </p>
                        <p className="text-xs text-gray-400">Рівень {player.level}</p>
                      </div>
                    </div>
                    <div className="font-black text-yellow-400">
                      {player.season_points} 💰
                    </div>
                  </div>
                ))}
                {leaderboardData.length === 0 && <p className="text-center text-gray-500 mt-10">Ще немає гравців</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;