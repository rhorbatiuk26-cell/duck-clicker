import { useState, useEffect } from 'react';
import axios from 'axios';

// Твій бойовий сервер!
const SERVER_URL = 'https://duck-clicker-production.up.railway.app/api';

// Надійна векторна качка, яка не зламається
const DUCK_IMAGE = "https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f986.svg";

// Нові жорсткі пороги рівнів
const LEVEL_THRESHOLDS = [0, 1000, 5000, 15000, 40000, 100000, 250000, 600000, 1500000];

function App() {
  const [userData, setUserData] = useState(null);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [error, setError] = useState(null);
  
  // Нижня навігація: 'tap', 'boosts', 'info'
  const [activeTab, setActiveTab] = useState('tap');
  
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
    tg.disableVerticalSwipes(); // Вимикаємо скролінг для зручного мультитапу
    
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

  // 🔥 МУЛЬТИ-ТАП (Зчитуємо кілька пальців) 🔥
  const handleTouch = async (e) => {
    if (!userData || showLeaderboard) return;

    // Зчитуємо скільки пальців торкнулося екрана
    const touches = e.changedTouches;
    const touchCount = touches.length;

    tg.HapticFeedback.impactOccurred('medium');

    const baseTap = level; 
    const tapValue = userData.active_boost ? baseTap * 2 : baseTap;
    const totalPointsToAdd = tapValue * touchCount;

    setPoints(prev => prev + totalPointsToAdd);

    // Малюємо цифри для КОЖНОГО пальця
    const newClicks = Array.from(touches).map(touch => {
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        id: Date.now() + Math.random(), // Унікальний ID
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        val: tapValue
      };
    });
    
    setClicks(prev => [...prev, ...newClicks]);

    setTimeout(() => {
      const idsToRemove = newClicks.map(c => c.id);
      setClicks(prev => prev.filter(c => !idsToRemove.includes(c.id)));
    }, 1000);

    // Локальна перевірка рівня
    let newLevel = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (points + totalPointsToAdd >= LEVEL_THRESHOLDS[i]) {
        newLevel = i + 1;
        break;
      }
    }
    if (newLevel > 9) newLevel = 9;
    setLevel(newLevel);

    // Відправляємо кількість пальців на сервер одним запитом
    try {
      await axios.post(`${SERVER_URL}/user/tap`, {
        telegram_id: userData.telegram_id,
        count: touchCount
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
      console.error('Помилка', err);
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

  const currentLevelStart = LEVEL_THRESHOLDS[level - 1];
  const nextLevelStart = level < 9 ? LEVEL_THRESHOLDS[level] : LEVEL_THRESHOLDS[8];
  let progressPercent = 100;
  if (level < 9) {
    progressPercent = ((points - currentLevelStart) / (nextLevelStart - currentLevelStart)) * 100;
  }

  const levelNames = ["Бродяга", "Новачок", "Шукач", "Хуліган", "Бізнесмен", "Бос", "Магнат", "Олігарх", "Божество"];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-950 select-none overflow-hidden text-white">
      
      {/* Шапка (однакова для всіх вкладок) */}
      <div className="text-center w-full p-4 z-10 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold drop-shadow-md">Привіт, {userData.first_name}!</h1>
          <button 
            onClick={openLeaderboard}
            className="bg-gradient-to-r from-yellow-500 to-yellow-400 text-gray-900 font-bold py-2 px-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
          >
            🏆 Топ
          </button>
        </div>
        {userData.active_boost && (
          <div className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 animate-bounce">
            🔥 АКТИВНИЙ БУСТ: x2 ОЧОК!
          </div>
        )}
      </div>

      {/* ОСНОВНА ОБЛАСТЬ: ЗМІНЮЄТЬСЯ ЗАЛЕЖНО ВІД ВКЛАДКИ */}
      <div className="flex-1 flex flex-col overflow-hidden relative pb-[80px]">
        
        {/* ВКЛАДКА 1: ГОЛОВНА ГРА */}
        {activeTab === 'tap' && (
          <div className="flex-1 flex flex-col px-4 animate-fade-in">
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-3xl p-4 shadow-2xl border border-gray-700/50 text-center mx-4 mb-4">
              <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-1">Твій баланс</p>
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-lg">
                {points}
              </p>
            </div>

            {/* Зона кліку: Тепер слухає onTouchStart для кількох пальців */}
            <div
              className="relative flex-1 flex items-center justify-center w-full touch-none"
              onTouchStart={handleTouch}
            >
              <div className="absolute bg-yellow-500/10 w-64 h-64 rounded-full blur-[50px] pointer-events-none"></div>
              
              <img
                src={DUCK_IMAGE}
                alt="Duck Mascot"
                className="w-64 h-64 object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] pointer-events-none transition-transform active:scale-95"
              />

              {clicks.map((click) => (
                <div
                  key={click.id}
                  className="absolute text-4xl font-black text-yellow-300 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-50"
                  style={{ 
                    left: click.x - 20, 
                    top: click.y - 50,
                    animation: 'floatUp 1s ease-out forwards'
                  }}
                >
                  +{click.val}
                </div>
              ))}
            </div>

            {/* Прогрес бар */}
            <div className="w-full bg-gray-800/90 backdrop-blur-md p-4 rounded-3xl border border-gray-700/50 shrink-0">
              <div className="flex justify-between items-center mb-2">
                <span className="font-black text-white">Рівень {level}</span>
                <span className="text-xs text-yellow-400 font-bold bg-yellow-400/10 border border-yellow-400/20 px-2 py-1 rounded-lg uppercase tracking-wider">
                  {levelNames[level - 1]}
                </span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-4 overflow-hidden border border-gray-950 shadow-inner relative">
                <div
                  className="bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-300 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 drop-shadow-md">
                   {level < 9 ? `${points} / ${nextLevelStart}` : "МАКСИМАЛЬНИЙ РІВЕНЬ"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА 2: БУСТИ */}
        {activeTab === 'boosts' && (
          <div className="flex-1 flex flex-col p-6 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-6 text-center">🚀 Бусти та Завдання</h2>
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-center mb-4">
              <div className="text-4xl mb-2">📺</div>
              <h3 className="font-bold text-lg text-white mb-2">Перегляд Реклами</h3>
              <p className="text-sm text-gray-400 mb-4">Отримай x2 очок на 10 хвилин за перегляд відео.</p>
              <button className="bg-yellow-500 text-gray-900 font-bold w-full py-3 rounded-xl hover:bg-yellow-400 active:scale-95 transition-all">
                (Незабаром) Дивитись
              </button>
            </div>
            
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-center">
              <div className="text-4xl mb-2">🤝</div>
              <h3 className="font-bold text-lg text-white mb-2">Запросити друга</h3>
              <p className="text-sm text-gray-400 mb-4">Отримай 12 годин бусту х2 за кожного друга!</p>
              <button 
                onClick={() => tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/ТУТ_ЛІНК_ТВОГО_БОТА/play?startapp=${user.id}&text=Граємо разом! Допоможи качці стати магнатом!`)}
                className="bg-blue-500 text-white font-bold w-full py-3 rounded-xl hover:bg-blue-400 active:scale-95 transition-all"
              >
                Відправити запрошення
              </button>
            </div>
          </div>
        )}

        {/* ВКЛАДКА 3: ІНФО */}
        {activeTab === 'info' && (
          <div className="flex-1 flex flex-col p-6 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-6 text-center">ℹ️ Правила Гри</h2>
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-sm text-gray-300 space-y-4">
              <p><strong className="text-white">1. Чесний рейтинг:</strong> Ми не казино і не лотерея. Нагороди отримують лише ті, хто знаходиться в ТОП-11 рейтингу наприкінці місяця.</p>
              <p><strong className="text-white">2. Як заробити:</strong> Тапай по качці. Сила тапу залежить від твого рівня. Використовуй кілька пальців одночасно!</p>
              <p><strong className="text-white">3. Призовий фонд:</strong> Формується з доходів від реклами. Наприкінці місяця рахунки обнуляються для чесного змагання в новому сезоні.</p>
              <p><strong className="text-white">4. Античит:</strong> Автоклікери та скрипти суворо заборонені. Система виявляє їх автоматично.</p>
            </div>
          </div>
        )}
      </div>

      {/* НИЖНЯ НАВІГАЦІЯ (ТАБИ) */}
      <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 flex justify-around items-center px-2 pb-safe z-40">
        <button 
          onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('tap'); }}
          className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${activeTab === 'tap' ? 'text-yellow-400' : 'text-gray-500'}`}
        >
          <span className="text-2xl mb-1">🦆</span>
          <span className="text-[10px] font-bold uppercase">Грай</span>
        </button>
        <button 
          onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('boosts'); }}
          className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${activeTab === 'boosts' ? 'text-yellow-400' : 'text-gray-500'}`}
        >
          <span className="text-2xl mb-1">🚀</span>
          <span className="text-[10px] font-bold uppercase">Бусти</span>
        </button>
        <button 
          onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('info'); }}
          className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${activeTab === 'info' ? 'text-yellow-400' : 'text-gray-500'}`}
        >
          <span className="text-2xl mb-1">ℹ️</span>
          <span className="text-[10px] font-bold uppercase">Інфо</span>
        </button>
      </div>

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-100px) scale(1.5); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>

      {/* Модалка Рейтингу залишається як була... */}
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
                  <div key={player.telegram_id} className={`flex items-center justify-between p-3 rounded-2xl ${index === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-gray-800'}`}>
                    <div className="flex items-center gap-3">
                      <div className="font-black text-lg w-6 text-center text-gray-500">{index + 1}</div>
                      <div>
                        <p className="font-bold text-white text-sm">{player.first_name}</p>
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
            <div className="bg-yellow-500 rounded-3xl p-4 text-gray-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="font-black text-3xl w-14 text-center">#{currentUserRankData.rank}</div>
                <div><p className="font-black text-sm uppercase">Твій результат</p></div>
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