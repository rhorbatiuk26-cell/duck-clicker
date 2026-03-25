import { useState, useEffect } from 'react';
import axios from 'axios';

const SERVER_URL = 'https://duck-clicker-production.up.railway.app/api';

// Більш приємне зображення 3D-качки (заміниш на свої арти пізніше)
const DUCK_IMAGE = "https://cdn.pixabay.com/photo/2024/02/23/17/26/duck-8592455_1280.png";

// Ті самі пороги рівнів, щоб фронтенд знав, як малювати прогрес-бар
const LEVEL_THRESHOLDS = [0, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000];

function App() {
  const [userData, setUserData] = useState(null);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [error, setError] = useState(null);
  
  // Для красивих анімацій кліку (вилітаючі цифри)
  const [clicks, setClicks] = useState([]);
  
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [currentUserRankData, setCurrentUserRankData] = useState(null);
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
        setLevel(Number(response.data.user.level));
      } catch (err) {
        console.error('Помилка зв\'язку з сервером:', err);
        setError('Не вдалося підключитися до сервера 🦆');
      }
    };
    fetchUser();
  }, [user, startParam]);

  const handleTap = async (e) => {
    if (!userData || showLeaderboard) return;

    tg.HapticFeedback.impactOccurred('medium');

    // Рахуємо силу кліку (Мульти-тап)
    const baseTap = level; 
    const tapValue = userData.active_boost ? baseTap * 2 : baseTap;
    
    // Оновлюємо візуал
    const newPoints = points + tapValue;
    setPoints(newPoints);

    // Перевірка на підвищення рівня прямо в інтерфейсі (для швидкості)
    let newLevel = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (newPoints >= LEVEL_THRESHOLDS[i]) {
        newLevel = i + 1;
        break;
      }
    }
    if (newLevel > 9) newLevel = 9;
    setLevel(newLevel);

    // Створюємо вилітаючу циферку там, де був клік
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const clickAnim = { id: Date.now(), x, y, val: tapValue };
    setClicks((prev) => [...prev, clickAnim]);
    
    // Видаляємо циферку через секунду
    setTimeout(() => {
      setClicks((prev) => prev.filter((c) => c.id !== clickAnim.id));
    }, 1000);

    // Відправляємо на сервер
    try {
      await axios.post(`${SERVER_URL}/user/tap`, {
        telegram_id: userData.telegram_id
      });
    } catch (err) {
      console.error('Помилка збереження тапу:', err);
    }
  };

  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    setIsLoadingLeaders(true);
    tg.HapticFeedback.impactOccurred('light');
    try {
      const response = await axios.get(`${SERVER_URL}/leaderboard?telegram_id=${user.id}`);
      setLeaderboardData(response.data.leaderboard);
      setCurrentUserRankData(response.data.currentUser);
    } catch (err) {
      console.error('Не вдалося завантажити рейтинг', err);
    } finally {
      setIsLoadingLeaders(false);
    }
  };

  if (!user) return <div className="h-screen bg-gray-950 text-white flex items-center justify-center font-bold">Відкрий гру через Telegram!</div>;
  if (error) return <div className="flex flex-col h-screen bg-gray-950 text-red-500 items-center justify-center p-6 text-center"><p className="text-xl font-bold mb-4">{error}</p></div>;
  if (!userData) return (
    <div className="h-screen bg-gray-950 text-yellow-400 flex flex-col items-center justify-center font-bold">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-400 mb-6 shadow-[0_0_15px_rgba(234,179,8,0.5)]"></div>
      <p className="animate-pulse text-lg tracking-widest">Вилуплюємо каченя... 🥚</p>
    </div>
  );

  // Розрахунок прогрес-бару
  const currentLevelStart = LEVEL_THRESHOLDS[level - 1];
  const nextLevelStart = level < 9 ? LEVEL_THRESHOLDS[level] : LEVEL_THRESHOLDS[8];
  let progressPercent = 100;
  if (level < 9) {
    progressPercent = ((points - currentLevelStart) / (nextLevelStart - currentLevelStart)) * 100;
  }

  // Назви рівнів для краси
  const levelNames = ["Бродяга", "Новачок", "Шукач", "Хуліган", "Бізнесмен", "Бос", "Магнат", "Олігарх", "Божество"];

  return (
    <div className="relative flex flex-col items-center justify-between h-screen py-8 px-4 bg-gradient-to-b from-gray-900 to-gray-950 select-none overflow-hidden">
      
      {/* Шапка */}
      <div className="text-center w-full mt-2 z-10">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-white drop-shadow-md">Привіт, {userData.first_name}!</h1>
          <button 
            onClick={openLeaderboard}
            className="bg-gradient-to-r from-yellow-500 to-yellow-400 text-gray-900 font-bold py-2 px-5 rounded-2xl shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-transform active:scale-95"
          >
            🏆 Рейтинг
          </button>
        </div>

        {userData.active_boost && (
          <div className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 animate-bounce shadow-[0_0_10px_rgba(34,197,94,0.6)]">
            🔥 АКТИВНИЙ БУСТ: x2 ОЧОК!
          </div>
        )}

        <div className="bg-gray-800/80 backdrop-blur-sm rounded-3xl p-5 shadow-2xl border border-gray-700/50">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-1">Баланс</p>
          <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-lg">
            {points}
          </p>
        </div>
      </div>

      {/* Зона кліку з анімаціями */}
      <div
        className="relative active:scale-95 transition-transform duration-75 cursor-pointer flex-1 flex items-center justify-center w-full"
        onClick={handleTap}
      >
        {/* Красиве фонове світіння */}
        <div className="absolute bg-yellow-500/10 w-72 h-72 rounded-full blur-[60px] pointer-events-none"></div>
        <div className="absolute bg-orange-500/5 w-48 h-48 rounded-full blur-[40px] pointer-events-none"></div>
        
        <img
          src={DUCK_IMAGE}
          alt="Duck Mascot"
          className="w-72 h-72 object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] pointer-events-none"
        />

        {/* Літаючі циферки при кліку */}
        {clicks.map((click) => (
          <div
            key={click.id}
            className="absolute text-3xl font-black text-yellow-300 pointer-events-none animate-float-up drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
            style={{ 
              left: click.x - 20, 
              top: click.y - 40,
              // Проста CSS анімація польоту вгору і зникнення
              animation: 'floatUp 1s ease-out forwards'
            }}
          >
            +{click.val}
          </div>
        ))}
      </div>

      {/* Низ: Прогрес бар та Рівень */}
      <div className="w-full bg-gray-800/90 backdrop-blur-md p-5 rounded-[2rem] border border-gray-700/50 mb-2 z-10 shadow-2xl">
        <div className="flex justify-between items-center mb-3">
          <span className="font-black text-white text-lg drop-shadow-md">Рівень {level}</span>
          <span className="text-xs text-yellow-400 font-bold bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 rounded-xl uppercase tracking-wider">
            {levelNames[level - 1]}
          </span>
        </div>
        
        <div className="w-full bg-gray-900 rounded-full h-5 overflow-hidden border border-gray-950 shadow-inner relative">
          <div
            className="bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-300 h-full transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          ></div>
          {/* Текст поверх смужки (скільки залишилось до наступного рівня) */}
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/80 mix-blend-difference">
             {level < 9 ? `${points} / ${nextLevelStart}` : "МАКСИМАЛЬНИЙ РІВЕНЬ"}
          </div>
        </div>
      </div>

      {/* CSS для анімації вилітаючих цифр */}
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-100px) scale(1.5); }
        }
      `}</style>

      {/* МОДАЛЬНЕ ВІКНО: ТАБЛИЦЯ ЛІДЕРІВ (без змін, просто сховано сюди) */}
      {showLeaderboard && (
        <div className="absolute inset-0 z-50 bg-gray-950/95 flex flex-col p-6 animate-fade-in backdrop-blur-md">
          <div className="flex justify-between items-center mb-4 mt-4">
            <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest">ТОП Сезону</h2>
            <button onClick={() => setShowLeaderboard(false)} className="bg-gray-800 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl active:scale-90">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-900 rounded-3xl p-4 border border-gray-700 mb-4 shadow-inner">
            {isLoadingLeaders ? (
              <div className="flex justify-center items-center h-full text-yellow-400"><div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-yellow-400"></div></div>
            ) : (
              <div className="space-y-3">
                {leaderboardData.map((player, index) => (
                  <div key={player.telegram_id} className={`flex items-center justify-between p-3 rounded-2xl ${index === 0 ? 'bg-yellow-500/20 border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : index === 1 ? 'bg-gray-300/10 border border-gray-300/30' : index === 2 ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-gray-800'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`font-black text-lg w-6 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-400' : 'text-gray-500'}`}>{index + 1}</div>
                      <div>
                        <p className="font-bold text-white text-sm">{player.first_name} {player.telegram_id === String(user.id) ? '(Ти)' : ''}</p>
                        <p className="text-xs text-gray-400">Рівень {player.level}</p>
                      </div>
                    </div>
                    <div className="font-black text-yellow-400">{player.season_points}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {!isLoadingLeaders && currentUserRankData && (
            <div className="bg-yellow-500 rounded-3xl p-4 text-gray-900 shadow-[0_0_20px_rgba(234,179,8,0.4)] border-2 border-yellow-400 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="font-black text-3xl w-14 text-center">#{currentUserRankData.rank}</div>
                <div><p className="font-black text-sm uppercase">Твій результат</p><p className="text-xs font-bold opacity-80">Рівень {currentUserRankData.level}</p></div>
              </div>
              <div className="font-black text-2xl">{currentUserRankData.season_points} 💰</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;