import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Твій бойовий сервер!
const SERVER_URL = 'https://duck-clicker-production.up.railway.app/api';
const CHANNEL_URL = 'https://t.me/ТУТ_ТВІЙ_КАНАЛ'; 

const LEVEL_THRESHOLDS = [0, 5000, 25000, 100000, 500000, 2000000, 10000000, 50000000, 250000000];
const MAX_ENERGY = 2000;
const levelNames = ["Бродяга", "Новачок", "Шукач", "Хуліган", "Бізнесмен", "Бос", "Магнат", "Олігарх", "Божество"];

// Ліги
const getLeague = (lvl) => {
  if (lvl <= 3) return { name: "Бронзова Ліга 🥉", color: "text-orange-400" };
  if (lvl <= 6) return { name: "Срібна Ліга 🥈", color: "text-gray-300" };
  return { name: "Золота Ліга 🏆", color: "text-yellow-400" };
};

// Скіни качки
const SKINS = [
  { id: 'default', name: 'Класична Качка', img: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f986.svg', cost: 0 },
  { id: 'cool', name: 'Качка-Хуліган', img: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f60e.svg', cost: 500000 },
  { id: 'rich', name: 'Золота Качка', img: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f911.svg', cost: 10000000 },
];

const SHOP_ITEMS = [
  { id: 1, name: "Стара Кепка", desc: "+1 монета / сек", cost: 5000, income: 1, icon: "🧢" },
  { id: 2, name: "Гітара Бродяги", desc: "+5 монет / сек", cost: 30000, income: 5, icon: "🎸" },
  { id: 3, name: "Кіоск з Шаурмою", desc: "+20 монет / сек", cost: 150000, income: 20, icon: "🌮" },
  { id: 4, name: "Крипто-Ферма", desc: "+100 монет / сек", cost: 1000000, income: 100, icon: "💻" },
];

function App() {
  const [userData, setUserData] = useState(null);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [energy, setEnergy] = useState(MAX_ENERGY);
  const [passiveIncome, setPassiveIncome] = useState(0);
  
  const [activeTab, setActiveTab] = useState('tap'); 
  const [shopSubTab, setShopSubTab] = useState('business'); // 'business' or 'skins'
  const [clicks, setClicks] = useState([]);
  
  // Лідерборд
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState('players'); // 'players' or 'squads'
  const [leadersData, setLeadersData] = useState({ players: [], squads: [] });
  const [currentUserRankData, setCurrentUserRankData] = useState(null);
  
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [offlineEarned, setOfflineEarned] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [justReachedLevel, setJustReachedLevel] = useState(null);

  const tg = window.Telegram.WebApp;
  const user = tg.initDataUnsafe?.user;
  const startParam = tg.initDataUnsafe?.start_param;
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
        setUserData(data.user); setPoints(Number(data.user.season_points));
        setLevel(Number(data.user.level)); setEnergy(Number(data.user.energy));
        setPassiveIncome(Number(data.user.passive_income));
        
        if (data.offline_earned > 0) {
          setOfflineEarned(data.offline_earned);
          setTimeout(() => setOfflineEarned(0), 5000);
        }
        if (data.daily_available) setShowDailyModal(true);
      } catch (err) {}
    };
    fetchUser();
  }, [user, startParam]);

  // Живий тік та Автоклікер
  useEffect(() => {
    let totalIncomePerSec = passiveIncome;
    if (userData?.auto_click) totalIncomePerSec += (7 * level);
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
            setJustReachedLevel(calcLevel); setShowLevelUp(true);
            tg.HapticFeedback.notificationOccurred('success');
            return calcLevel;
          }
          return currentLevel;
        });
        return newPoints;
      });

      if (userData?.auto_click && duckRef.current && activeTab === 'tap') {
        const rect = duckRef.current.getBoundingClientRect();
        const newClicks = Array.from({ length: 2 }).map(() => ({
          id: Date.now() + Math.random(), x: (Math.random() * rect.width) + 20, y: (Math.random() * rect.height) + 20, val: level
        }));
        setClicks(prev => [...prev.slice(-15), ...newClicks]);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [passiveIncome, userData?.auto_click, level, activeTab]);

  useEffect(() => {
    const interval = setInterval(() => setEnergy(prev => (prev < MAX_ENERGY ? prev + 0.33 : prev)), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTouch = async (e) => {
    if (!userData || showLeaderboard || showDailyModal || showLevelUp) return;
    const touches = e.changedTouches;
    let actualTouches = 0;
    for (let i = 0; i < touches.length; i++) { if (energy - actualTouches > 0) actualTouches++; }
    if (actualTouches === 0) return;

    tg.HapticFeedback.impactOccurred('medium');
    const tapValue = userData.active_boost ? level * userData.boost_multiplier : level;
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
    setTimeout(() => { const idsToRemove = newClicks.map(c => c.id); setClicks(prev => prev.filter(c => !idsToRemove.includes(c.id))); }, 1000);

    try { await axios.post(`${SERVER_URL}/user/tap`, { telegram_id: userData.telegram_id, count: actualTouches }); } catch (err) {}
  };

  const watchAdForBoost = (boostType) => {
    tg.showConfirm("Подивитися відео для отримання бусту?", async (agreed) => {
      if (agreed) {
        tg.HapticFeedback.notificationOccurred('success');
        try {
          const res = await axios.post(`${SERVER_URL}/user/ad_boost`, { telegram_id: userData.telegram_id, boost_type: boostType });
          setUserData(res.data.user);
          if (boostType === 'energy') setEnergy(MAX_ENERGY);
          tg.showAlert("Буст активовано! 🚀");
        } catch (err) {}
      }
    });
  };

  const useFreeEnergy = async () => {
    if (userData.free_energy_refills <= 0) { tg.showAlert("Ліміт вичерпано!"); return; }
    tg.HapticFeedback.notificationOccurred('success');
    try {
      const res = await axios.post(`${SERVER_URL}/user/free_energy`, { telegram_id: userData.telegram_id });
      setEnergy(res.data.energy); setUserData(prev => ({ ...prev, free_energy_refills: res.data.refills }));
    } catch (err) {}
  };

  const claimDaily = async () => {
    try {
      const response = await axios.post(`${SERVER_URL}/user/daily`, { telegram_id: userData.telegram_id });
      setPoints(Number(response.data.user.season_points)); setUserData(response.data.user); setShowDailyModal(false);
    } catch (err) { setShowDailyModal(false); }
  };

  const buyUpgrade = async (item) => {
    if (points < item.cost) { tg.HapticFeedback.notificationOccurred('error'); return; }
    tg.HapticFeedback.notificationOccurred('success');
    try {
      const response = await axios.post(`${SERVER_URL}/user/buy_upgrade`, { telegram_id: userData.telegram_id, cost: item.cost, income_increase: item.income });
      setPoints(Number(response.data.user.season_points)); setPassiveIncome(Number(response.data.user.passive_income));
    } catch (err) {}
  };

  // 🔥 ПОКУПКА / ОДЯГАННЯ СКІНУ 🔥
  const handleSkin = async (skin) => {
    const isOwned = userData.unlocked_skins?.includes(skin.id);
    if (!isOwned && points < skin.cost) { tg.HapticFeedback.notificationOccurred('error'); return; }
    tg.HapticFeedback.notificationOccurred('success');
    try {
      const res = await axios.post(`${SERVER_URL}/user/buy_skin`, { telegram_id: userData.telegram_id, skin_id: skin.id, cost: skin.cost });
      setUserData(res.data.user); setPoints(Number(res.data.user.season_points));
    } catch (err) {}
  };

  // 🔥 ВСТУП ДО СКВАДУ 🔥
  const joinSquad = () => {
    tg.showPopup({
      title: 'Вступити в Сквад',
      message: 'Введи username Telegram-каналу (без @):',
      buttons: [{ type: 'ok' }, { type: 'cancel' }]
    }, async (buttonId) => {
      // Telegram API не дозволяє вводити текст в showPopup прямо зараз, тому використовуємо заглушку для тестування
      // В реальності тут буде окреме міні-модальне вікно з input-ом.
      // Зробимо автоматичний вступ в Squad "Tops" для демонстрації
      try {
        const res = await axios.post(`${SERVER_URL}/squad/join`, { telegram_id: userData.telegram_id, squad_username: 'Tops' });
        setUserData(res.data.user);
        tg.showAlert("Ти вступив у сквад Tops!");
      } catch (err) {}
    });
  };

  // 🔥 ДОСЯГНЕННЯ 🔥
  const claimAchievement = async (id, reward, goal) => {
    if (userData.achievements?.includes(id)) return; // Вже є
    if (points < goal && id !== 'lvl3') { tg.showAlert("Ще не виконав!"); return; }
    if (id === 'lvl3' && level < 3) { tg.showAlert("Ще не виконав!"); return; }
    
    tg.HapticFeedback.notificationOccurred('success');
    try {
      const res = await axios.post(`${SERVER_URL}/user/achievement`, { telegram_id: userData.telegram_id, achievement_id: id, reward });
      setUserData(res.data.user); setPoints(Number(res.data.user.season_points));
      tg.showAlert(`Досягнення отримано! +${reward} 💰`);
    } catch (err) {}
  };

  const resetProgress = async () => {
    tg.showConfirm("УВАГА! Це повністю знищить прогрес. Почати з нуля?", async (agreed) => {
      if (agreed) {
        try {
          const res = await axios.post(`${SERVER_URL}/user/reset`, { telegram_id: userData.telegram_id });
          setUserData(res.data.user); setPoints(0); setLevel(1); setEnergy(MAX_ENERGY); setPassiveIncome(0);
          setActiveTab('tap');
        } catch (err) {}
      }
    });
  };

  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    try {
      const res = await axios.get(`${SERVER_URL}/leaderboard?telegram_id=${user.id}`);
      setLeadersData({ players: res.data.players, squads: res.data.squads });
      setCurrentUserRankData(res.data.currentUser);
    } catch (err) {}
  };

  if (!user || !userData) return <div className="h-screen bg-gray-950 flex flex-col items-center justify-center font-bold text-yellow-400">Завантаження...</div>;

  const currentSkinImg = SKINS.find(s => s.id === userData.current_skin)?.img || SKINS[0].img;
  const league = getLeague(level);

  const bgColors = ["from-gray-900 to-gray-950", "from-slate-900 to-slate-950", "from-blue-900 to-gray-950", "from-indigo-900 to-gray-950", "from-purple-900 to-gray-950", "from-fuchsia-900 to-gray-950", "from-rose-900 to-gray-950", "from-red-900 to-gray-950", "from-yellow-900 to-gray-950"];

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-b ${bgColors[level-1]} select-none overflow-hidden text-white transition-colors duration-1000`}>
      
      {/* Шапка */}
      <div className="text-center w-full p-4 z-10 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div className="text-left flex flex-col items-start">
            <h1 className="text-sm font-bold text-gray-300">Привіт, {userData.first_name}!</h1>
            {/* Відображення Ліги та Скваду */}
            <span className={`text-[10px] font-black uppercase tracking-widest ${league.color}`}>{league.name}</span>
            {userData.squad_id ? (
              <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-md mt-1 border border-gray-600">🛡️ {userData.squad_id}</span>
            ) : (
              <button onClick={joinSquad} className="text-[10px] bg-blue-600/50 px-2 py-0.5 rounded-md mt-1">Вступити в Сквад</button>
            )}
          </div>
          <button onClick={openLeaderboard} className="bg-gradient-to-r from-yellow-500 to-yellow-400 text-gray-900 font-bold py-2 px-4 rounded-xl shadow-lg active:scale-95">🏆 Топ</button>
        </div>
        
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-3xl p-4 shadow-2xl border border-gray-700/50">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-1">Баланс {passiveIncome > 0 && <span className="text-green-400">+{passiveIncome}/с</span>}</p>
          <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-lg">{Math.floor(points)}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative pb-[85px]">
        {/* ВКЛАДКА: ГРАЙ */}
        {activeTab === 'tap' && (
          <div className="flex-1 flex flex-col px-4 animate-fade-in">
            <div className="relative flex-1 flex items-center justify-center w-full touch-none" onTouchStart={handleTouch} ref={duckRef}>
              <div className="absolute bg-yellow-500/10 w-64 h-64 rounded-full blur-[50px] pointer-events-none"></div>
              {/* Качка з вибраним скіном */}
              <img src={currentSkinImg} alt="Duck" className={`w-64 h-64 object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] pointer-events-none transition-transform duration-75 ${userData.auto_click ? 'animate-pulse scale-95' : 'active:scale-x-[1.15] active:scale-y-[0.85]'}`}/>
              {clicks.map((c) => (
                <div key={c.id} className="absolute text-4xl font-black text-yellow-300 pointer-events-none z-50" style={{ left: c.x - 20, top: c.y - 50, animation: 'floatUp 1s ease-out forwards' }}>+{c.val}</div>
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
                <span className="font-black text-white">Рівень {level} <span className="text-gray-500 text-xs">({levelNames[level-1]})</span></span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-4 overflow-hidden border border-gray-950 shadow-inner relative">
                <div className="bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-300 h-full transition-all duration-300 rounded-full" style={{ width: `${Math.min(level < 9 ? ((points - LEVEL_THRESHOLDS[level-1]) / (LEVEL_THRESHOLDS[level] - LEVEL_THRESHOLDS[level-1])) * 100 : 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА: МАГАЗИН (Бізнеси + Скіни) */}
        {activeTab === 'shop' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <div className="flex bg-gray-800 rounded-2xl p-1 mb-6">
              <button onClick={() => setShopSubTab('business')} className={`flex-1 py-2 font-bold rounded-xl transition-all ${shopSubTab === 'business' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-500'}`}>Бізнес</button>
              <button onClick={() => setShopSubTab('skins')} className={`flex-1 py-2 font-bold rounded-xl transition-all ${shopSubTab === 'skins' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-500'}`}>Скіни</button>
            </div>

            {shopSubTab === 'business' ? (
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
                    <button onClick={() => buyUpgrade(item)} className={`font-bold py-2 px-3 text-sm rounded-xl active:scale-95 ${points >= item.cost ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-500'}`}>{item.cost} 💰</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {SKINS.map(skin => {
                  const isOwned = userData.unlocked_skins?.includes(skin.id);
                  const isEquipped = userData.current_skin === skin.id;
                  return (
                    <div key={skin.id} className={`bg-gray-800 border p-4 rounded-3xl text-center flex flex-col items-center justify-between h-48 ${isEquipped ? 'border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-gray-700'}`}>
                      <img src={skin.img} className="w-16 h-16 object-contain mb-2 drop-shadow-lg" />
                      <h3 className="font-bold text-sm text-white mb-2">{skin.name}</h3>
                      <button 
                        onClick={() => handleSkin(skin)}
                        className={`w-full py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${isEquipped ? 'bg-yellow-400 text-gray-900' : isOwned ? 'bg-gray-600 text-white' : points >= skin.cost ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'}`}
                      >
                        {isEquipped ? 'Одягнено' : isOwned ? 'Одягнути' : `${skin.cost} 💰`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА: ЗАВДАННЯ ТА БУСТИ (Ачівки) */}
        {activeTab === 'tasks' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            
            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">🏆 Досягнення</h2>
            <div className="space-y-2 mb-6">
              {[
                { id: 'first_10k', name: 'Назбирай 10,000 монет', goal: 10000, reward: 5000 },
                { id: 'lvl3', name: 'Досягни 3 рівня (Шукач)', goal: 0, reward: 25000 },
              ].map(ach => {
                const isDone = userData.achievements?.includes(ach.id);
                return (
                  <div key={ach.id} className="bg-gray-800 p-3 rounded-2xl flex justify-between items-center border border-gray-700">
                    <div>
                      <h3 className="text-sm font-bold text-white">{ach.name}</h3>
                      <p className="text-xs text-yellow-400">Нагорода: +{ach.reward}</p>
                    </div>
                    <button onClick={() => claimAchievement(ach.id, ach.reward, ach.goal)} className={`text-xs font-bold py-2 px-3 rounded-lg ${isDone ? 'bg-gray-700 text-gray-500' : 'bg-green-500 text-white'}`}>
                      {isDone ? 'Забрано' : 'Забрати'}
                    </button>
                  </div>
                )
              })}
            </div>

            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">🔄 Щоденні Бусти</h2>
            <div className="space-y-2 mb-6">
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex items-center justify-between">
                <div><h3 className="font-bold text-sm text-white">🔋 Відновити енергію</h3><p className="text-[10px] text-gray-400">{userData.free_energy_refills}/3 безкоштовно</p></div>
                <button onClick={useFreeEnergy} className={`text-xs font-bold py-2 px-3 rounded-lg ${userData.free_energy_refills > 0 ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'}`}>Відновити</button>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex items-center justify-between">
                <div><h3 className="font-bold text-sm text-white">🤖 Автоклікер (3 хв)</h3><p className="text-[10px] text-gray-400">За відео</p></div>
                <button onClick={() => watchAdForBoost('autoclick')} className="bg-purple-500 text-white text-xs font-bold py-2 px-3 rounded-lg active:scale-95">Дивитись</button>
              </div>
            </div>

          </div>
        )}

        {/* ВКЛАДКА: ІНФО */}
        {activeTab === 'info' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">ℹ️ Інфо та Правила</h2>
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-sm text-gray-300 space-y-4 mb-6">
              <p><strong className="text-white">1. Призовий фонд (Прозоро):</strong> Ми віддаємо 15% від усього доходу з реклами щомісяця ТОП-11 гравцям та ТОП Сквадам.</p>
              <p><strong className="text-yellow-400">2. Сквади (Команди):</strong> Якщо твій сквад перемагає, 50% призу йде адміну, 50% ділиться між ТОП гравцями скваду!</p>
            </div>
            <button onClick={resetProgress} className="bg-red-900/30 border border-red-500/50 text-red-500 font-bold py-4 rounded-2xl w-full active:scale-95 mt-auto">⚠️ Скинути мій прогрес</button>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 grid grid-cols-4 px-1 pb-safe z-40">
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('tap'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'tap' ? 'text-yellow-400' : 'text-gray-500'}`}><span className="text-2xl mb-1">🦆</span><span className="text-[10px] font-bold uppercase">Грай</span></button>
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('shop'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'shop' ? 'text-yellow-400' : 'text-gray-500'}`}><span className="text-2xl mb-1">🛒</span><span className="text-[10px] font-bold uppercase">Магазин</span></button>
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('tasks'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'tasks' ? 'text-yellow-400' : 'text-gray-500'}`}><span className="text-2xl mb-1">🎯</span><span className="text-[10px] font-bold uppercase">Завдання</span></button>
        <button onClick={() => { tg.HapticFeedback.selectionChanged(); setActiveTab('info'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'info' ? 'text-yellow-400' : 'text-gray-500'}`}><span className="text-2xl mb-1">ℹ️</span><span className="text-[10px] font-bold uppercase">Інфо</span></button>
      </div>

      {/* Модалка: ЛІДЕРБОРД ЗІ СКВАДАМИ */}
      {showLeaderboard && (
        <div className="absolute inset-0 z-[60] bg-gray-950/95 flex flex-col p-6 animate-fade-in backdrop-blur-md">
           <div className="flex justify-between items-center mb-4 mt-4">
            <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest">ТОП Сезону</h2>
            <button onClick={() => setShowLeaderboard(false)} className="bg-gray-800 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl active:scale-90">✕</button>
          </div>
          
          {/* Перемикач Гравці / Сквади */}
          <div className="flex bg-gray-800 rounded-2xl p-1 mb-4">
            <button onClick={() => setLeaderboardTab('players')} className={`flex-1 py-2 font-bold rounded-xl transition-all ${leaderboardTab === 'players' ? 'bg-yellow-500 text-gray-900' : 'text-gray-500'}`}>Гравці</button>
            <button onClick={() => setLeaderboardTab('squads')} className={`flex-1 py-2 font-bold rounded-xl transition-all ${leaderboardTab === 'squads' ? 'bg-yellow-500 text-gray-900' : 'text-gray-500'}`}>Сквади</button>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-900 rounded-3xl p-4 border border-gray-700 mb-4 shadow-inner">
             {leaderboardTab === 'players' ? (
                leadersData.players.map((player, index) => (
                  <div key={player.telegram_id} className={`flex items-center justify-between p-3 rounded-2xl ${index === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-gray-800'} mb-2`}>
                    <div className="flex items-center gap-3">
                      <div className="font-black text-lg w-6 text-center text-gray-500">{index + 1}</div>
                      <div>
                        <p className="font-bold text-white text-sm">{player.first_name}</p>
                        <p className="text-[10px] text-gray-400">Рівень {player.level}</p>
                      </div>
                    </div>
                    <div className="font-black text-yellow-400">{player.season_points}</div>
                  </div>
                ))
             ) : (
                leadersData.squads.map((squad, index) => (
                  <div key={squad.username} className={`flex items-center justify-between p-3 rounded-2xl ${index === 0 ? 'bg-blue-500/20 border border-blue-500/50' : 'bg-gray-800'} mb-2`}>
                    <div className="flex items-center gap-3">
                      <div className="font-black text-lg w-6 text-center text-gray-500">{index + 1}</div>
                      <div>
                        <p className="font-bold text-white text-sm">{squad.name}</p>
                        <p className="text-[10px] text-gray-400">{squad.members_count} учасників</p>
                      </div>
                    </div>
                    <div className="font-black text-blue-400">{squad.total_points}</div>
                  </div>
                ))
             )}
          </div>
          {leaderboardTab === 'players' && currentUserRankData && (
            <div className="bg-yellow-500 rounded-3xl p-4 text-gray-900 flex items-center justify-between shrink-0">
              <div className="font-black text-3xl w-14 text-center">#{currentUserRankData.rank}</div>
              <div className="font-black text-2xl">{currentUserRankData.season_points} 💰</div>
            </div>
          )}
        </div>
      )}

      {showLevelUp && justReachedLevel && (
        <div className="absolute inset-0 z-[70] bg-gray-950/90 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-lg text-center">
          <div className="text-8xl mb-4 animate-bounce">🎉</div><h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2">Новий Рівень!</h2>
          <p className="text-2xl text-yellow-400 font-bold mb-8">Ти тепер <span className="uppercase text-3xl block mt-2">{levelNames[justReachedLevel - 1]}</span></p>
          <button onClick={() => setShowLevelUp(false)} className="bg-yellow-500 text-gray-900 font-black text-xl py-4 px-12 rounded-2xl w-full">Продовжити!</button>
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