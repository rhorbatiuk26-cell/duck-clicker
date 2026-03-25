import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const SERVER_URL = 'https://duck-clicker-production.up.railway.app/api';
// Заміни на лінк СВОГО каналу!
const CHANNEL_URL = 'https://t.me/ТУТ_ТВІЙ_КАНАЛ'; 

const DUCK_IMAGE = "https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f986.svg";
const LEVEL_THRESHOLDS = [0, 5000, 25000, 100000, 500000, 2000000, 10000000, 50000000, 250000000];
const MAX_ENERGY = 2000;

const SHOP_ITEMS = [
  { id: 1, name: "Стара Кепка", desc: "+1 монета / сек", cost: 5000, income: 1, icon: "🧢" },
  { id: 2, name: "Гітара Бродяги", desc: "+5 монет / сек", cost: 30000, income: 5, icon: "🎸" },
  { id: 3, name: "Кіоск з Шаурмою", desc: "+20 монет / сек", cost: 150000, income: 20, icon: "🌮" },
  { id: 4, name: "Крипто-Ферма", desc: "+100 монет / сек", cost: 1000000, income: 100, icon: "💻" },
];

const levelNames = ["Бродяга", "Новачок", "Шукач", "Хуліган", "Бізнесмен", "Бос", "Магнат", "Олігарх", "Божество"];

function App() {
  const [userData, setUserData] = useState(null);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [energy, setEnergy] = useState(MAX_ENERGY);
  const [passiveIncome, setPassiveIncome] = useState(0);
  
  const [activeTab, setActiveTab] = useState('tap'); 
  const [clicks, setClicks] = useState([]);
  
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [currentUserRankData, setCurrentUserRankData] = useState(null);
  
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [offlineEarned, setOfflineEarned] = useState(0);
  
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [justReachedLevel, setJustReachedLevel] = useState(null);

  const tg = window.Telegram.WebApp;
  const user = tg.initDataUnsafe?.user;
  const startParam = tg.initDataUnsafe?.start_param;

  // Ref для кнопки качки (щоб автоклікер знав координати)
  const duckRef = useRef(null);

  useEffect(() => {
    tg.expand();
    tg.disableVerticalSwipes();
    
    const fetchUser = async () => {
      if (!user) return;
      try {
        const response = await axios.post(`${SERVER_URL}/user/init`, {
          telegram_id: user.id, first_name: user.first_name || 'Гравець', referrer_id: startParam || null
        });
        const data = response.data;
        setUserData(data.user);
        setPoints(Number(data.user.season_points));
        setLevel(Number(data.user.level));
        setEnergy(Number(data.user.energy));
        setPassiveIncome(Number(data.user.passive_income));
        
        if (data.offline_earned > 0) {
          setOfflineEarned(data.offline_earned);
          setTimeout(() => setOfflineEarned(0), 5000);
        }
        if (data.daily_available) setShowDailyModal(true);
      } catch (err) { console.error('Помилка сервера'); }
    };
    fetchUser();
  }, [user, startParam]);

  // Живий тік доходу ТА Автоклікера
  useEffect(() => {
    // Рахуємо загальний дохід в секунду (пасив + автоклік)
    let totalIncomePerSec = passiveIncome;
    if (userData?.auto_click) {
      totalIncomePerSec += (7 * level); // Автоклік: 7 кліків на секунду
    }

    if (totalIncomePerSec <= 0) return;

    const interval = setInterval(() => {
      setPoints(prev => {
        const newPoints = prev + totalIncomePerSec;
        let calcLevel = 1;
        for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
          if (newPoints >= LEVEL_THRESHOLDS[i]) { calcLevel = i + 1; break; }
        }
        if (calcLevel > 9) calcLevel = 9;
        
        setLevel(currentLevel => {
          if (calcLevel > currentLevel) {
            setJustReachedLevel(calcLevel);
            setShowLevelUp(true);
            tg.HapticFeedback.notificationOccurred('success');
            return calcLevel;
          }
          return currentLevel;
        });
        return newPoints;
      });

      // Візуальний ефект автоклікера (цифри вилітають самі)
      if (userData?.auto_click && duckRef.current && activeTab === 'tap') {
        const rect = duckRef.current.getBoundingClientRect();
        // Генеруємо 2-3 циферки для краси
        const newClicks = Array.from({ length: 2 }).map(() => ({
          id: Date.now() + Math.random(),
          x: (Math.random() * rect.width) + 20,
          y: (Math.random() * rect.height) + 20,
          val: level
        }));
        setClicks(prev => [...prev.slice(-15), ...newClicks]); // Тримаємо не більше 15
      }

    }, 1000);
    return () => clearInterval(interval);
  }, [passiveIncome, userData?.auto_click, level, activeTab]);

  // Відновлення енергії
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy(prev => (prev < MAX_ENERGY ? prev + 0.33 : prev));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTouch = async (e) => {
    if (!userData || showLeaderboard || showDailyModal || showLevelUp) return;
    const touches = e.changedTouches;
    let actualTouches = 0;
    for (let i = 0; i < touches.length; i++) { if (energy - actualTouches > 0) actualTouches++; }
    if (actualTouches === 0) return;

    tg.HapticFeedback.impactOccurred('medium');

    const tapValue = userData.active_boost ? level * userData.multiplier : level;
    const totalPointsToAdd = tapValue * actualTouches;

    setPoints(prev => {
      const newPoints = prev + totalPointsToAdd;
      let calcLevel = 1;
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (newPoints >= LEVEL_THRESHOLDS[i]) { calcLevel = i + 1; break; }
      }
      if (calcLevel > 9) calcLevel = 9;
      setLevel(currentLevel => {
        if (calcLevel > currentLevel) { setJustReachedLevel(calcLevel); setShowLevelUp(true); tg.HapticFeedback.notificationOccurred('success'); return calcLevel; }
        return currentLevel;
      });
      return newPoints;
    });
    
    setEnergy(prev => prev - actualTouches);

    const newClicks = Array.from(touches).slice(0, actualTouches).map(touch => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { id: Date.now() + Math.random(), x: touch.clientX - rect.left, y: touch.clientY - rect.top, val: tapValue };
    });
    setClicks(prev => [...prev.slice(-20), ...newClicks]);
    
    setTimeout(() => {
      const idsToRemove = newClicks.map(c => c.id);
      setClicks(prev => prev.filter(c => !idsToRemove.includes(c.id)));
    }, 1000);

    try { await axios.post(`${SERVER_URL}/user/tap`, { telegram_id: userData.telegram_id, count: actualTouches }); } catch (err) {}
  };

  // 🔥 ФУНКЦІЯ ПЕРЕГЛЯДУ РЕКЛАМИ ДЛЯ БУСТІВ 🔥
  const watchAdForBoost = (boostType) => {
    tg.showConfirm("Подивитися відео для отримання бусту?", async (agreed) => {
      if (agreed) {
        // Симуляція перегляду реклами (ТУТ БУДЕ ADSGRAM)
        tg.HapticFeedback.notificationOccurred('success');
        try {
          const res = await axios.post(`${SERVER_URL}/user/ad_boost`, { 
            telegram_id: userData.telegram_id, 
            boost_type: boostType 
          });
          setUserData(res.data.user);
          if (boostType === 'energy') setEnergy(MAX_ENERGY);
          tg.showAlert("Буст активовано! 🚀");
        } catch (err) { tg.showAlert("Помилка активації бусту"); }
      }
    });
  };

  const claimDaily = async () => {
    tg.HapticFeedback.notificationOccurred('success');
    try {
      const response = await axios.post(`${SERVER_URL}/user/daily`, { telegram_id: userData.telegram_id });
      setPoints(Number(response.data.user.season_points));
      setUserData(response.data.user);
      setShowDailyModal(false);
    } catch (err) { setShowDailyModal(false); }
  };

  const buyUpgrade = async (item) => {
    if (points < item.cost) { tg.HapticFeedback.notificationOccurred('error'); return; }
    tg.HapticFeedback.notificationOccurred('success');
    try {
      const response = await axios.post(`${SERVER_URL}/user/buy_upgrade`, { telegram_id: userData.telegram_id, cost: item.cost, income_increase: item.income });
      setPoints(Number(response.data.user.season_points));
      setPassiveIncome(Number(response.data.user.passive_income));
    } catch (err) {}
  };

  // 🔥 ПЕРЕВІРКА ПІДПИСКИ НА КАНАЛ 🔥
  const claimTaskTG = async () => {
    if (userData.task_tg_claimed) return;
    tg.openTelegramLink(CHANNEL_URL);
    
    // Даємо гравцю 5 секунд, щоб підписатися, потім перевіряємо на сервері
    setTimeout(async () => {
      try {
        const response = await axios.post(`${SERVER_URL}/user/claim_task`, { telegram_id: userData.telegram_id, task_type: 'telegram' });
        setPoints(Number(response.data.user.season_points));
        setUserData(response.data.user);
        tg.HapticFeedback.notificationOccurred('success');
        tg.showAlert("Дякуємо за підписку! Нараховано +100,000 монет 💰");
      } catch (err) {
        tg.HapticFeedback.notificationOccurred('error');
        if (err.response?.data?.error === 'not_subscribed') {
          tg.showAlert("⚠️ Ти ще не підписався на канал! Перевір підписку і спробуй знову.");
        } else if (err.response?.data?.error === 'Вже виконано') {
          tg.showAlert("Ти вже отримав цю нагороду.");
        } else {
          tg.showAlert("Помилка перевірки. Спробуй пізніше.");
        }
      }
    }, 5000);
  };

  const resetProgress = async () => {
    tg.showConfirm("УВАГА! Це повністю знищить твій прогрес, монети та рівень. Почати з нуля?", async (agreed) => {
      if (agreed) {
        try {
          const response = await axios.post(`${SERVER_URL}/user/reset`, { telegram_id: userData.telegram_id });
          setUserData(response.data.user);
          setPoints(0); setLevel(1); setEnergy(MAX_ENERGY); setPassiveIncome(0);
          tg.HapticFeedback.notificationOccurred('success');
          setActiveTab('tap');
        } catch (err) {}
      }
    });
  };

  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    try {
      const response = await axios.get(`${SERVER_URL}/leaderboard?telegram_id=${user.id}`);
      setLeaderboardData(response.data.leaderboard);
      setCurrentUserRankData(response.data.currentUser);
    } catch (err) {}
  };

  if (!user || !userData) return <div className="h-screen bg-gray-950 flex flex-col items-center justify-center font-bold text-yellow-400">Завантаження...</div>;

  const currentLevelStart = LEVEL_THRESHOLDS[level - 1];
  const nextLevelStart = level < 9 ? LEVEL_THRESHOLDS[level] : LEVEL_THRESHOLDS[8];
  const progressPercent = level < 9 ? ((points - currentLevelStart) / (nextLevelStart - currentLevelStart)) * 100 : 100;
  const energyPercent = (energy / MAX_ENERGY) * 100;

  const bgColors = ["from-gray-900 to-gray-950", "from-slate-900 to-slate-950", "from-blue-900 to-gray-950", "from-indigo-900 to-gray-950", "from-purple-900 to-gray-950", "from-fuchsia-900 to-gray-950", "from-rose-900 to-gray-950", "from-red-900 to-gray-950", "from-yellow-900 to-gray-950"];

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-b ${bgColors[level-1]} select-none overflow-hidden text-white transition-colors duration-1000`}>
      
      {offlineEarned > 0 && (
        <div className="absolute top-20 left-4 right-4 bg-green-500 text-white p-4 rounded-2xl shadow-2xl z-50 text-center animate-fade-in border-2 border-green-400">
          <p className="font-black text-xl mb-1">Ти спав, а бізнес працював!</p>
          <p className="font-bold text-lg">+ {offlineEarned} 💰</p>
        </div>
      )}

      {/* Шапка */}
      <div className="text-center w-full p-4 z-10 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div className="text-left">
            <h1 className="text-sm font-bold text-gray-300">Привіт, {userData.first_name}!</h1>
            {passiveIncome > 0 && <p className="text-xs text-green-400 font-bold">+{passiveIncome}/сек ⚡</p>}
          </div>
          <button onClick={openLeaderboard} className="bg-gradient-to-r from-yellow-500 to-yellow-400 text-gray-900 font-bold py-2 px-4 rounded-xl shadow-lg active:scale-95">🏆 Топ</button>
        </div>
        
        {userData.auto_click && (
          <div className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.6)]">
            🤖 ПРАЦЮЄ АВТОКЛІКЕР!
          </div>
        )}
        {userData.active_boost && (
          <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 ml-2 animate-bounce shadow-[0_0_10px_rgba(249,115,22,0.6)]">
            🔥 БУСТ x5 АКТИВНИЙ!
          </div>
        )}
        
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-3xl p-4 shadow-2xl border border-gray-700/50">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-1">Баланс</p>
          <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-lg">{Math.floor(points)}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative pb-[85px]">
        {/* ВКЛАДКА: ГРАЙ */}
        {activeTab === 'tap' && (
          <div className="flex-1 flex flex-col px-4 animate-fade-in">
            <div className="relative flex-1 flex items-center justify-center w-full touch-none" onTouchStart={handleTouch} ref={duckRef}>
              <div className="absolute bg-yellow-500/10 w-64 h-64 rounded-full blur-[50px] pointer-events-none"></div>
              <img src={DUCK_IMAGE} alt="Duck" className={`w-64 h-64 object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] pointer-events-none transition-transform duration-75 ${userData.auto_click ? 'animate-pulse scale-95' : 'active:scale-x-[1.15] active:scale-y-[0.85]'}`}/>
              {clicks.map((click) => (
                <div key={click.id} className="absolute text-4xl font-black text-yellow-300 pointer-events-none z-50" style={{ left: click.x - 20, top: click.y - 50, animation: 'floatUp 1s ease-out forwards' }}>+{click.val}</div>
              ))}
            </div>

            <div className="w-full bg-gray-800/90 backdrop-blur-md p-4 rounded-3xl border border-gray-700/50 shrink-0 shadow-xl">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-blue-300">⚡ Енергія</span>
                <span className="text-xs font-bold text-blue-300">{Math.floor(energy)} / {MAX_ENERGY}</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2 mb-4 overflow-hidden border border-gray-950">
                <div className="bg-blue-500 h-full transition-all duration-300 rounded-full" style={{ width: `${energyPercent}%` }}></div>
              </div>

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

        {/* ВКЛАДКА: МАГАЗИН */}
        {activeTab === 'shop' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">🛒 Бізнеси</h2>
            <div className="space-y-4">
              {SHOP_ITEMS.map(item => (
                <div key={item.id} className="bg-gray-800 border border-gray-700 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{item.icon}</div>
                    <div>
                      <h3 className="font-bold text-lg">{item.name}</h3>
                      <p className="text-xs text-green-400">{item.desc}</p>
                    </div>
                  </div>
                  <button onClick={() => buyUpgrade(item)} className={`font-bold py-2 px-3 text-sm rounded-xl transition-all active:scale-95 ${points >= item.cost ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-500'}`}>
                    {item.cost} 💰
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ВКЛАДКА: БУСТИ ТА ЗАВДАННЯ */}
        {activeTab === 'boosts' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            
            <h2 className="text-xl font-black text-yellow-400 mb-3 ml-2">🔄 Щоденні Бусти (За відео)</h2>
            <div className="space-y-3 mb-8">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">🔋 Відновити енергію</h3>
                  <p className="text-xs text-gray-400">Миттєво заповнює шкалу</p>
                </div>
                <button onClick={() => watchAdForBoost('energy')} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-xl active:scale-95">Дивитись</button>
              </div>

              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">🚀 Буст x5 (5 хв)</h3>
                  <p className="text-xs text-gray-400">Множник всіх кліків</p>
                </div>
                <button onClick={() => watchAdForBoost('x5')} className="bg-orange-500 text-white font-bold py-2 px-4 rounded-xl active:scale-95">Дивитись</button>
              </div>

              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">🤖 Автоклікер x7 (3 хв)</h3>
                  <p className="text-xs text-gray-400">Тапає за тебе!</p>
                </div>
                <button onClick={() => watchAdForBoost('autoclick')} className="bg-purple-500 text-white font-bold py-2 px-4 rounded-xl active:scale-95">Дивитись</button>
              </div>
            </div>

            <h2 className="text-xl font-black text-yellow-400 mb-3 ml-2">🎯 Одноразові Завдання</h2>
            <div className="space-y-3">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-white">🤝 Запроси друга</h3>
                    <p className="text-xs text-yellow-400">+ 50,000 монет тобі!</p>
                  </div>
                  <button onClick={() => tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/ТВІЙ_БОТ/play?startapp=${user.id}`)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-xl active:scale-95">Запросити</button>
                </div>
                <div className="bg-gray-900/50 p-2 rounded-xl text-xs text-gray-400 text-center">
                  *Монети зарахуються автоматично, коли друг досягне 3-го рівня.
                </div>
              </div>

              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">📣 Підписка на канал</h3>
                  <p className="text-xs text-yellow-400">+ 100,000 монет</p>
                </div>
                <button onClick={claimTaskTG} className={`font-bold py-2 px-4 rounded-xl transition-all ${userData.task_tg_claimed ? 'bg-gray-700 text-gray-500' : 'bg-green-500 text-white active:scale-95'}`}>
                  {userData.task_tg_claimed ? 'Виконано' : 'Виконати'}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ВКЛАДКА: ІНФО */}
        {activeTab === 'info' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">ℹ️ Інфо та Правила</h2>
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-sm text-gray-300 space-y-4 mb-6 shadow-xl">
              <p><strong className="text-white text-base">1. Чесний рейтинг:</strong> Ми не казино і не лотерея. Нагороди отримують лише ті, хто закріпився в ТОП-11 рейтингу на момент закінчення сезону (1-го числа о 00:00).</p>
              
              <p><strong className="text-yellow-400 text-base">2. Призовий фонд (Прозоро):</strong> Ми гарантовано віддаємо <span className="font-bold text-white">15% від усього доходу з реклами</span> щомісяця. <br/> 
              <span className="text-xs text-gray-400">Наприклад: Якщо дохід склав $5000, призовий фонд — $750. Чим більше ви дивитесь рекламу (бусти), тим більший загальний призовий фонд!</span></p>
              
              <p><strong className="text-white text-base">3. Як заробити очки:</strong> Тапай, купуй бізнеси для пасивного доходу (працює до 3-х годин офлайн) та виконуй завдання.</p>
              
              <p><strong className="text-red-400 text-base">4. Античит:</strong> Автоклікери та скрипти суворо заборонені. Система виявляє їх автоматично.</p>
            </div>
            
            <button onClick={resetProgress} className="bg-red-900/30 border border-red-500/50 text-red-500 font-bold py-4 rounded-2xl w-full active:scale-95 transition-all mt-auto">
              ⚠️ Скинути мій прогрес (Для тестів)
            </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 grid grid-cols-4 px-1 pb-safe z-40">
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('tap'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'tap' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">🦆</span><span className="text-[10px] font-bold uppercase">Грай</span>
        </button>
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('shop'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'shop' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">🛒</span><span className="text-[10px] font-bold uppercase">Бізнес</span>
        </button>
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('boosts'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'boosts' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">🚀</span><span className="text-[10px] font-bold uppercase">Бусти</span>
        </button>
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('info'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'info' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">ℹ️</span><span className="text-[10px] font-bold uppercase">Інфо</span>
        </button>
      </div>

      {showLevelUp && justReachedLevel && (
        <div className="absolute inset-0 z-[70] bg-gray-950/90 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-lg text-center">
          <div className="text-8xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2">Новий Рівень!</h2>
          <p className="text-2xl text-yellow-400 font-bold mb-8">Ти тепер <span className="uppercase text-3xl block mt-2">{levelNames[justReachedLevel - 1]}</span></p>
          <button onClick={() => setShowLevelUp(false)} className="bg-yellow-500 text-gray-900 font-black text-xl py-4 px-12 rounded-2xl w-full">Продовжити!</button>
        </div>
      )}

      {showDailyModal && (
        <div className="absolute inset-0 z-50 bg-gray-950/95 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-md text-center">
          <div className="text-7xl mb-6 animate-bounce">🎁</div>
          <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest mb-4">Щоденний бонус!</h2>
          <button onClick={claimDaily} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-black text-xl py-4 px-10 rounded-2xl w-full">Забрати нагороду!</button>
        </div>
      )}

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
                      <div><p className="font-bold text-white text-sm">{player.first_name}</p><p className="text-xs text-gray-400">Рівень {player.level}</p></div>
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