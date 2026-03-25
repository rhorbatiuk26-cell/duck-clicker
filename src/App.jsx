import { useState, useEffect } from 'react';
import axios from 'axios';

// Твій бойовий сервер!
const SERVER_URL = 'https://duck-clicker-production.up.railway.app/api';
const DUCK_IMAGE = "https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f986.svg";
const LEVEL_THRESHOLDS = [0, 1000, 5000, 15000, 40000, 100000, 250000, 600000, 1500000];
const MAX_ENERGY = 2000;

// Товари в магазині (можна буде перенести на бекенд пізніше)
const SHOP_ITEMS = [
  { id: 1, name: "Стара Кепка", desc: "+100 монет / год", cost: 1500, income: 100, icon: "🧢" },
  { id: 2, name: "Гітара Бродяги", desc: "+500 монет / год", cost: 8000, income: 500, icon: "🎸" },
  { id: 3, name: "Кіоск з Шаурмою", desc: "+2000 монет / год", cost: 35000, income: 2000, icon: "🌮" },
  { id: 4, name: "Крипто-Ферма", desc: "+10,000 монет / год", cost: 200000, income: 10000, icon: "💻" },
];

function App() {
  const [userData, setUserData] = useState(null);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [energy, setEnergy] = useState(MAX_ENERGY);
  const [passiveIncome, setPassiveIncome] = useState(0);
  
  const [activeTab, setActiveTab] = useState('tap');
  const [clicks, setClicks] = useState([]);
  
  // Модалки
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [currentUserRankData, setCurrentUserRankData] = useState(null);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [offlineEarned, setOfflineEarned] = useState(0);

  const tg = window.Telegram.WebApp;
  const user = tg.initDataUnsafe?.user;

  // 1. Ініціалізація
  useEffect(() => {
    tg.expand();
    tg.disableVerticalSwipes();
    
    const fetchUser = async () => {
      if (!user) return;
      try {
        const response = await axios.post(`${SERVER_URL}/user/init`, {
          telegram_id: user.id,
          first_name: user.first_name || 'Гравець'
        });
        const data = response.data;
        setUserData(data.user);
        setPoints(Number(data.user.season_points));
        setLevel(Number(data.user.level));
        setEnergy(Number(data.user.energy));
        setPassiveIncome(Number(data.user.passive_income));
        
        // Показуємо офлайн дохід
        if (data.offline_earned > 0) {
          setOfflineEarned(data.offline_earned);
          setTimeout(() => setOfflineEarned(0), 4000); // Ховаємо через 4 сек
        }
        
        // Показуємо щоденний бонус
        if (data.daily_available) {
          setShowDailyModal(true);
        }

      } catch (err) {
        console.error('Помилка зв\'язку з сервером');
      }
    };
    fetchUser();
  }, [user]);

  // 2. Локальне відновлення енергії (візуал)
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy(prev => (prev < MAX_ENERGY ? prev + 1 : prev));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Обробка тапу
  const handleTouch = async (e) => {
    if (!userData || showLeaderboard || showDailyModal) return;
    
    const touches = e.changedTouches;
    let actualTouches = 0;

    // Перевірка енергії перед кліком
    for (let i = 0; i < touches.length; i++) {
      if (energy - actualTouches > 0) actualTouches++;
    }
    
    if (actualTouches === 0) return; // Немає енергії

    tg.HapticFeedback.impactOccurred('medium');

    const tapValue = userData.active_boost ? level * 2 : level;
    const totalPointsToAdd = tapValue * actualTouches;

    setPoints(prev => prev + totalPointsToAdd);
    setEnergy(prev => prev - actualTouches);

    // Візуал цифр
    const newClicks = Array.from(touches).slice(0, actualTouches).map(touch => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { id: Date.now() + Math.random(), x: touch.clientX - rect.left, y: touch.clientY - rect.top, val: tapValue };
    });
    setClicks(prev => [...prev, ...newClicks]);
    setTimeout(() => {
      const idsToRemove = newClicks.map(c => c.id);
      setClicks(prev => prev.filter(c => !idsToRemove.includes(c.id)));
    }, 1000);

    // Рівень
    let newLevel = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (points + totalPointsToAdd >= LEVEL_THRESHOLDS[i]) { newLevel = i + 1; break; }
    }
    if (newLevel > 9) newLevel = 9;
    setLevel(newLevel);

    // Відправка на сервер
    try {
      await axios.post(`${SERVER_URL}/user/tap`, { telegram_id: userData.telegram_id, count: actualTouches });
    } catch (err) {}
  };

  // 4. Отримання щоденного бонусу
  const claimDaily = async () => {
    tg.HapticFeedback.notificationOccurred('success');
    try {
      const response = await axios.post(`${SERVER_URL}/user/daily`, { telegram_id: userData.telegram_id });
      setPoints(Number(response.data.user.season_points));
      setShowDailyModal(false);
    } catch (err) {
      setShowDailyModal(false); // Якщо вже зібрано, просто ховаємо
    }
  };

  // 5. Покупка в магазині
  const buyUpgrade = async (item) => {
    if (points < item.cost) {
      tg.HapticFeedback.notificationOccurred('error');
      return;
    }
    tg.HapticFeedback.notificationOccurred('success');
    try {
      const response = await axios.post(`${SERVER_URL}/user/buy_upgrade`, { 
        telegram_id: userData.telegram_id, 
        cost: item.cost, 
        income_increase: item.income 
      });
      setPoints(Number(response.data.user.season_points));
      setPassiveIncome(Number(response.data.user.passive_income));
    } catch (err) {}
  };

  // Інші функції (Рейтинг)
  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    try {
      const response = await axios.get(`${SERVER_URL}/leaderboard?telegram_id=${user.id}`);
      setLeaderboardData(response.data.leaderboard);
      setCurrentUserRankData(response.data.currentUser);
    } catch (err) {}
  };

  if (!user) return <div className="h-screen bg-gray-950 text-white flex items-center justify-center font-bold">Відкрий через Telegram!</div>;
  if (!userData) return <div className="h-screen bg-gray-950 flex flex-col items-center justify-center font-bold text-yellow-400">Завантаження...</div>;

  const currentLevelStart = LEVEL_THRESHOLDS[level - 1];
  const nextLevelStart = level < 9 ? LEVEL_THRESHOLDS[level] : LEVEL_THRESHOLDS[8];
  const progressPercent = level < 9 ? ((points - currentLevelStart) / (nextLevelStart - currentLevelStart)) * 100 : 100;
  const energyPercent = (energy / MAX_ENERGY) * 100;

  // Динамічний фон залежно від рівня (сірий -> пурпуровий -> золотий)
  const bgColors = [
    "from-gray-900 to-gray-950", // 1
    "from-slate-900 to-slate-950", // 2
    "from-blue-900 to-gray-950", // 3
    "from-indigo-900 to-gray-950", // 4
    "from-purple-900 to-gray-950", // 5
    "from-fuchsia-900 to-gray-950", // 6
    "from-rose-900 to-gray-950", // 7
    "from-red-900 to-gray-950", // 8
    "from-yellow-900 to-gray-950", // 9
  ];

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-b ${bgColors[level-1]} select-none overflow-hidden text-white transition-colors duration-1000`}>
      
      {/* Офлайн дохід (Спливашка) */}
      {offlineEarned > 0 && (
        <div className="absolute top-20 left-4 right-4 bg-green-500 text-white p-4 rounded-2xl shadow-2xl z-50 text-center animate-fade-in border-2 border-green-400">
          <p className="font-black text-xl mb-1">Ти спав, а бізнес працював!</p>
          <p className="font-bold text-lg">+ {offlineEarned} 💰 пасивного доходу</p>
        </div>
      )}

      {/* Шапка */}
      <div className="text-center w-full p-4 z-10 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div className="text-left">
            <h1 className="text-sm font-bold text-gray-300">Привіт, {userData.first_name}!</h1>
            {passiveIncome > 0 && (
              <p className="text-xs text-green-400 font-bold">+{passiveIncome}/год ⚡</p>
            )}
          </div>
          <button onClick={openLeaderboard} className="bg-gradient-to-r from-yellow-500 to-yellow-400 text-gray-900 font-bold py-2 px-4 rounded-xl shadow-lg active:scale-95">🏆 Топ</button>
        </div>
        
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-3xl p-4 shadow-2xl border border-gray-700/50">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-1">Баланс</p>
          <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-lg">{points}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative pb-[85px]">
        
        {/* ВКЛАДКА: ГРАЙ */}
        {activeTab === 'tap' && (
          <div className="flex-1 flex flex-col px-4 animate-fade-in">
            {/* Зона кліку */}
            <div className="relative flex-1 flex items-center justify-center w-full touch-none" onTouchStart={handleTouch}>
              <div className="absolute bg-yellow-500/10 w-64 h-64 rounded-full blur-[50px] pointer-events-none"></div>
              <img
                src={DUCK_IMAGE}
                alt="Duck"
                // 🔥 ЕФЕКТ ЖАБКИ (Squish) ПРИ ТАПІ 🔥
                className="w-64 h-64 object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] pointer-events-none transition-transform duration-75 active:scale-x-[1.15] active:scale-y-[0.85]"
              />
              {clicks.map((click) => (
                <div key={click.id} className="absolute text-4xl font-black text-yellow-300 pointer-events-none z-50" style={{ left: click.x - 20, top: click.y - 50, animation: 'floatUp 1s ease-out forwards' }}>+{click.val}</div>
              ))}
            </div>

            {/* Нижня панель (Енергія і Рівень) */}
            <div className="w-full bg-gray-800/90 backdrop-blur-md p-4 rounded-3xl border border-gray-700/50 shrink-0 shadow-xl">
              {/* Енергія */}
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-blue-300">⚡ Енергія</span>
                <span className="text-xs font-bold text-blue-300">{Math.floor(energy)} / {MAX_ENERGY}</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2 mb-4 overflow-hidden border border-gray-950">
                <div className="bg-blue-500 h-full transition-all duration-300 rounded-full" style={{ width: `${energyPercent}%` }}></div>
              </div>

              {/* Рівень */}
              <div className="flex justify-between items-center mb-2">
                <span className="font-black text-white">Рівень {level}</span>
                <span className="text-xs font-bold text-gray-400">Наступний: {nextLevelStart}</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-4 overflow-hidden border border-gray-950 shadow-inner relative">
                <div className="bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-300 h-full transition-all duration-300 rounded-full" style={{ width: `${Math.min(progressPercent, 100)}%` }}></div>
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА: МАГАЗИН (Пасив) */}
        {activeTab === 'shop' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">🛒 Магазин Бізнесів</h2>
            <p className="text-center text-gray-400 text-sm mb-6">Купуй бізнеси, щоб качка заробляла офлайн (до 3-х годин).</p>
            <div className="space-y-4">
              {SHOP_ITEMS.map(item => (
                <div key={item.id} className="bg-gray-800 border border-gray-700 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{item.icon}</div>
                    <div>
                      <h3 className="font-bold text-lg">{item.name}</h3>
                      <p className="text-sm text-green-400">{item.desc}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => buyUpgrade(item)}
                    className={`font-bold py-2 px-4 rounded-xl transition-all active:scale-95 ${points >= item.cost ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400' : 'bg-gray-700 text-gray-500'}`}
                  >
                    {item.cost} 💰
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ВКЛАДКА: БУСТИ */}
        {activeTab === 'boosts' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">🚀 Бусти</h2>
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-center mb-4 relative overflow-hidden">
              <div className="text-5xl mb-2 relative z-10">📺</div>
              <h3 className="font-black text-xl text-white mb-2 relative z-10">Буст "Ракета" x5</h3>
              <p className="text-sm text-gray-400 mb-4 relative z-10">Подивись рекламу від AdsGram та отримай множник кліків на 5 хвилин!</p>
              <button className="bg-gradient-to-r from-red-500 to-orange-500 text-white font-black w-full py-4 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.5)] active:scale-95 transition-all relative z-10">
                (Реклама підключається)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* НИЖНЯ НАВІГАЦІЯ */}
      <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 flex justify-around items-center px-1 pb-safe z-40">
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('tap'); }} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'tap' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">🦆</span><span className="text-[10px] font-bold uppercase">Грай</span>
        </button>
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('shop'); }} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'shop' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">🛒</span><span className="text-[10px] font-bold uppercase">Бізнес</span>
        </button>
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('boosts'); }} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'boosts' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">🚀</span><span className="text-[10px] font-bold uppercase">Бусти</span>
        </button>
      </div>

      {/* МОДАЛКА: ЩОДЕННИЙ БОНУС */}
      {showDailyModal && (
        <div className="absolute inset-0 z-50 bg-gray-950/95 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-md text-center">
          <div className="text-7xl mb-6 animate-bounce">🎁</div>
          <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest mb-4">Щоденний бонус!</h2>
          <p className="text-gray-300 mb-8">Заходь щодня, щоб не втратити серію і отримувати більше монет!</p>
          
          <button 
            onClick={claimDaily}
            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-black text-xl py-4 px-10 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.5)] active:scale-95 transition-all w-full"
          >
            Забрати нагороду!
          </button>
        </div>
      )}

      {/* МОДАЛКА: РЕЙТИНГ (Прихована) */}
      {showLeaderboard && (
        <div className="absolute inset-0 z-[60] bg-gray-950/95 flex flex-col p-6 animate-fade-in backdrop-blur-md">
          <div className="flex justify-between items-center mb-4 mt-4">
            <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest">ТОП Сезону</h2>
            <button onClick={() => setShowLeaderboard(false)} className="bg-gray-800 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl active:scale-90">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-900 rounded-3xl p-4 border border-gray-700 mb-4 shadow-inner">
             {leaderboardData.map((player, index) => (
                  <div key={player.telegram_id} className={`flex items-center justify-between p-3 rounded-2xl ${index === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-gray-800'} mb-2`}>
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
          {currentUserRankData && (
            <div className="bg-yellow-500 rounded-3xl p-4 text-gray-900 flex items-center justify-between shrink-0">
              <div className="font-black text-3xl w-14 text-center">#{currentUserRankData.rank}</div>
              <div className="font-black text-2xl">{currentUserRankData.season_points} 💰</div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes floatUp { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-100px) scale(1.5); } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}

export default App;