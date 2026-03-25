import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const SERVER_URL = 'https://duck-clicker-production.up.railway.app/api';
const CHANNEL_URL = 'https://t.me/ТУТ_ТВІЙ_КАНАЛ'; 

// 🔥 ТВІЙ БОТ ТА ID 🔥
const BOT_USERNAME = 'GoldDuckTap_bot';
const ADMIN_TELEGRAM_ID = '1057689349'; 

// 🔥 10 РІВНІВ (До 50 Мільярдів) 🔥
const LEVEL_THRESHOLDS = [0, 10000, 100000, 500000, 2000000, 10000000, 50000000, 500000000, 5000000000, 50000000000];
const MAX_ENERGY = 2000;
const levelNames = ["Бродяга", "Новачок", "Шукач", "Хуліган", "Бізнесмен", "Бос", "Магнат", "Олігарх", "Божество", "Творець"];

const LEVEL_SKINS = [
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f986.svg", // 1: Качка
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f424.svg", // 2: Курчатко
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f425.svg", // 3: Пташеня
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f426.svg", // 4: Пташка
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f989.svg", // 5: Сова
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f985.svg", // 6: Орел
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f9a2.svg", // 7: Лебідь
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f9a9.svg", // 8: Фламінго
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f99a.svg", // 9: Павич
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f409.svg", // 10: Дракон
];

const getLeague = (lvl) => {
  if (lvl <= 3) return { name: "Бронзова Ліга 🥉", color: "text-orange-400" };
  if (lvl <= 6) return { name: "Срібна Ліга 🥈", color: "text-gray-300" };
  if (lvl <= 9) return { name: "Золота Ліга 🏆", color: "text-yellow-400" };
  return { name: "Діамантова Ліга 💎", color: "text-cyan-400" };
};

const SKINS = [
  { id: 'cool', name: 'Качка-Кіборг', img: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f916.svg', cost: 5000000 },
  { id: 'rich', name: 'Золота Качка', img: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f911.svg', cost: 10000000 },
];

const SHOP_ITEMS = [
  { id: 1, name: "Стара Кепка", desc: "+1 монета / сек", cost: 5000, income: 1, icon: "🧢" },
  { id: 2, name: "Гітара Бродяги", desc: "+5 монет / сек", cost: 30000, income: 5, icon: "🎸" },
  { id: 3, name: "Кіоск з Шаурмою", desc: "+20 монет / сек", cost: 150000, income: 20, icon: "🌮" },
  { id: 4, name: "Крипто-Ферма", desc: "+100 монет / сек", cost: 1000000, income: 100, icon: "💻" },
  { id: 5, name: "Мережа Банків", desc: "+1,000 монет / сек", cost: 10000000, income: 1000, icon: "🏦" },
  { id: 6, name: "Качиний ШІ", desc: "+5,000 монет / сек", cost: 50000000, income: 5000, icon: "🤖" },
  { id: 7, name: "Місія на Марс", desc: "+50,000 монет / сек", cost: 500000000, income: 50000, icon: "🚀" },
];

function App() {
  const [userData, setUserData] = useState(null);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [energy, setEnergy] = useState(MAX_ENERGY);
  const [passiveIncome, setPassiveIncome] = useState(0);
  const [activeTab, setActiveTab] = useState('tap'); 
  const [shopSubTab, setShopSubTab] = useState('business');
  const [clicks, setClicks] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState('players');
  const [leadersData, setLeadersData] = useState({ players: [], squads: [] });
  const [currentUserRankData, setCurrentUserRankData] = useState(null);
  const [dailyAvailable, setDailyAvailable] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [offlineEarned, setOfflineEarned] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [justReachedLevel, setJustReachedLevel] = useState(null);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [squadInput, setSquadInput] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('onboarding_done'));
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(() => localStorage.getItem('haptic_enabled') !== 'false');

  const tg = window.Telegram.WebApp;
  const user = tg.initDataUnsafe?.user;
  const startParam = tg.initDataUnsafe?.start_param;
  const duckRef = useRef(null);

  const triggerHaptic = (type) => { if (hapticEnabled) tg.HapticFeedback.impactOccurred(type); };
  const triggerNotification = (type) => { if (hapticEnabled) tg.HapticFeedback.notificationOccurred(type); };
  const triggerSelection = () => { if (hapticEnabled) tg.HapticFeedback.selectionChanged(); };

  useEffect(() => {
    tg.expand();
    tg.disableVerticalSwipes();
    const fetchUser = async () => {
      if (!user) return;
      try {
        const response = await axios.post(`${SERVER_URL}/user/init`, {
          telegram_id: user.id, first_name: user.first_name || 'Гравець', start_param: startParam || null
        });
        const data = response.data;
        setUserData(data.user); setPoints(Number(data.user.season_points));
        setLevel(Number(data.user.level)); setEnergy(Number(data.user.energy));
        setPassiveIncome(Number(data.user.passive_income));
        
        if (data.offline_earned > 0) { setOfflineEarned(data.offline_earned); setTimeout(() => setOfflineEarned(0), 5000); }
        if (data.daily_available) { setDailyAvailable(true); if (!showOnboarding) setShowDailyModal(true); }
      } catch (err) {}
    };
    fetchUser();
  }, [user, startParam, showOnboarding]);

  useEffect(() => {
    let totalIncomePerSec = passiveIncome;
    if (userData?.auto_click) totalIncomePerSec += (7 * level);
    if (totalIncomePerSec <= 0) return;

    const interval = setInterval(() => {
      setPoints(prev => {
        const newPoints = prev + totalIncomePerSec;
        let calcLevel = 1;
        for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (newPoints >= LEVEL_THRESHOLDS[i]) { calcLevel = i + 1; break; } }
        if (calcLevel > 10) calcLevel = 10;
        setLevel(currentLevel => {
          if (calcLevel > currentLevel) { setJustReachedLevel(calcLevel); setShowLevelUp(true); triggerNotification('success'); return calcLevel; }
          return currentLevel;
        });
        return newPoints;
      });

      if (userData?.auto_click && duckRef.current && activeTab === 'tap') {
        const rect = duckRef.current.getBoundingClientRect();
        const newClicks = Array.from({ length: 2 }).map(() => ({ id: Date.now() + Math.random(), x: (Math.random() * rect.width) + 20, y: (Math.random() * rect.height) + 20, val: level }));
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
    if (!userData || showLeaderboard || showDailyModal || showLevelUp || showSquadModal || showOnboarding || showSettings) return;
    const touches = e.changedTouches;
    let actualTouches = 0;
    for (let i = 0; i < touches.length; i++) { if (energy - actualTouches > 0) actualTouches++; }
    if (actualTouches === 0) return;

    triggerHaptic('medium');
    const tapValue = userData.active_boost ? level * userData.boost_multiplier : level;
    const totalPointsToAdd = tapValue * actualTouches;

    setPoints(prev => {
      const newPoints = prev + totalPointsToAdd;
      let calcLevel = 1;
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (newPoints >= LEVEL_THRESHOLDS[i]) { calcLevel = i + 1; break; } }
      if (calcLevel > 10) calcLevel = 10;
      setLevel(currentLevel => {
        if (calcLevel > currentLevel) { setJustReachedLevel(calcLevel); setShowLevelUp(true); triggerNotification('success'); return calcLevel; }
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
    tg.showConfirm("Подивитися відео від AdsGram для отримання бусту?", async (agreed) => {
      if (agreed) {
        triggerNotification('success');
        try {
          const res = await axios.post(`${SERVER_URL}/user/ad_boost`, { telegram_id: userData.telegram_id, boost_type: boostType });
          setUserData(res.data.user); setPoints(Number(res.data.user.season_points));
          if (boostType === 'energy') setEnergy(MAX_ENERGY);
          tg.showAlert("Успішно! Буст активовано 🚀");
        } catch (err) { tg.showAlert("Помилка активації"); }
      }
    });
  };

  const useFreeEnergy = async () => {
    if (userData.free_energy_refills <= 0) { tg.showAlert("Ліміт вичерпано!"); return; }
    triggerNotification('success');
    try {
      const res = await axios.post(`${SERVER_URL}/user/free_energy`, { telegram_id: userData.telegram_id });
      setEnergy(res.data.energy); setUserData(prev => ({ ...prev, free_energy_refills: res.data.refills }));
    } catch (err) {}
  };

  const buyUpgrade = async (item) => {
    if (points < item.cost) { triggerNotification('error'); return; }
    triggerNotification('success');
    try {
      const response = await axios.post(`${SERVER_URL}/user/buy_upgrade`, { telegram_id: userData.telegram_id, cost: item.cost, income_increase: item.income });
      setPoints(Number(response.data.user.season_points)); setPassiveIncome(Number(response.data.user.passive_income));
    } catch (err) {}
  };

  const handleSkin = async (skin) => {
    const isOwned = userData.unlocked_skins?.includes(skin.id);
    if (!isOwned && points < skin.cost) return;
    triggerNotification('success');
    try {
      const res = await axios.post(`${SERVER_URL}/user/buy_skin`, { telegram_id: userData.telegram_id, skin_id: skin.id, cost: skin.cost });
      setUserData(res.data.user); setPoints(Number(res.data.user.season_points));
    } catch (err) {}
  };
  
  const resetToEvolutionSkin = async () => {
    try {
      const res = await axios.post(`${SERVER_URL}/user/buy_skin`, { telegram_id: userData.telegram_id, skin_id: 'default', cost: 0 });
      setUserData(res.data.user); triggerNotification('success');
    } catch (err) {}
  };

  const submitSquad = async () => {
    if (!squadInput.trim()) return;
    try {
      const res = await axios.post(`${SERVER_URL}/squad/join`, { telegram_id: userData.telegram_id, squad_username: squadInput });
      setUserData(res.data.user); triggerNotification('success'); setShowSquadModal(false);
      tg.showAlert(`Успіх! Ти приєднався до скваду @${res.data.squad.username}`);
    } catch (err) { tg.showAlert("Помилка вступу"); }
  };

  const claimAchievement = async (id, reward, goal, type = 'points') => {
    if (userData.achievements?.includes(id)) return;
    
    // Перевірки перед відправкою на сервер
    if (type === 'points' && points < goal) { tg.showAlert("Ще не назбирав монет!"); return; }
    if (type === 'level' && level < goal) { tg.showAlert("Ще не досяг рівня!"); return; }
    if (type === 'refs' && (userData.referrals_count || 0) < goal) { tg.showAlert(`Тобі потрібно запросити ${goal} друзів! Запрошено: ${userData.referrals_count || 0}`); return; }

    triggerNotification('success');
    try {
      const res = await axios.post(`${SERVER_URL}/user/achievement`, { telegram_id: userData.telegram_id, achievement_id: id, reward });
      setUserData(res.data.user); setPoints(Number(res.data.user.season_points));
      tg.showAlert(`Досягнення отримано! +${reward} 💰`);
    } catch (err) { tg.showAlert(err.response?.data?.error || "Помилка"); }
  };

  const claimSocialTask = async (type, link) => {
    if (userData[`task_${type}_claimed`]) return;
    tg.openLink(link);
    setTimeout(async () => {
      try {
        const response = await axios.post(`${SERVER_URL}/user/claim_task`, { telegram_id: userData.telegram_id, task_type: type });
        setPoints(Number(response.data.user.season_points)); setUserData(response.data.user);
        let calcLevel = 1; for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (response.data.user.season_points >= LEVEL_THRESHOLDS[i]) { calcLevel = i + 1; break; } }
        if (calcLevel > level) { setJustReachedLevel(calcLevel); setShowLevelUp(true); setLevel(calcLevel); }
        triggerNotification('success'); tg.showAlert(`Нагороду отримано! +${response.data.reward} 💰`);
      } catch (err) { triggerNotification('error'); tg.showAlert("Спробуй ще раз."); }
    }, 5000);
  };

  const claimTelegramTask = async () => {
    if (userData.task_tg_claimed) return;
    tg.openTelegramLink(CHANNEL_URL);
    setTimeout(async () => {
      try {
        const response = await axios.post(`${SERVER_URL}/user/claim_task`, { telegram_id: userData.telegram_id, task_type: 'telegram' });
        setPoints(Number(response.data.user.season_points)); setUserData(response.data.user);
        let calcLevel = 1; for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) { if (response.data.user.season_points >= LEVEL_THRESHOLDS[i]) { calcLevel = i + 1; break; } }
        if (calcLevel > level) { setJustReachedLevel(calcLevel); setShowLevelUp(true); setLevel(calcLevel); }
        triggerNotification('success'); tg.showAlert("Дякуємо за підписку! Нараховано +100,000 монет 💰");
      } catch (err) { triggerNotification('error'); if (err.response?.data?.error === 'not_subscribed') { tg.showAlert("⚠️ Ти ще не підписався на канал!"); } }
    }, 5000);
  };

  const resetProgress = async () => {
    tg.showConfirm("УВАГА! Почати з нуля?", async (agreed) => {
      if (agreed) {
        try {
          const res = await axios.post(`${SERVER_URL}/user/reset`, { telegram_id: userData.telegram_id });
          setUserData(res.data.user); setPoints(0); setLevel(1); setEnergy(MAX_ENERGY); setPassiveIncome(0);
          triggerNotification('success'); setActiveTab('tap'); setShowSettings(false);
          localStorage.removeItem('onboarding_done'); setShowOnboarding(true); setOnboardingStep(0);
        } catch (err) {}
      }
    });
  };

  const endSeasonAdmin = async () => {
    tg.showConfirm("АДМІН! Завершити сезон прямо зараз? (Відправить тобі звіт у бот і обнулить всіх)", async (agreed) => {
      if (agreed) {
        try {
          await axios.post(`${SERVER_URL}/admin/end_season`, { telegram_id: userData.telegram_id });
          tg.showAlert("✅ СЕЗОН УСПІШНО ЗАВЕРШЕНО! Перевір повідомлення від бота.");
          window.location.reload(); 
        } catch (err) { tg.showAlert("Помилка Адмінки. Перевір ADMIN_TELEGRAM_ID в Railway."); }
      }
    });
  };

  const openLeaderboard = async () => {
    setShowLeaderboard(true); triggerHaptic('light');
    try {
      const res = await axios.get(`${SERVER_URL}/leaderboard?telegram_id=${user.id}`);
      setLeadersData({ players: res.data.players, squads: res.data.squads }); setCurrentUserRankData(res.data.currentUser);
    } catch (err) {}
  };

  const claimDaily = async () => {
    try {
      const response = await axios.post(`${SERVER_URL}/user/daily`, { telegram_id: userData.telegram_id });
      setPoints(Number(response.data.user.season_points)); setUserData(response.data.user); setShowDailyModal(false); setDailyAvailable(false); triggerNotification('success');
    } catch (err) { setShowDailyModal(false); }
  };

  const toggleHaptic = () => {
    const newState = !hapticEnabled; setHapticEnabled(newState); localStorage.setItem('haptic_enabled', newState);
    if (newState) tg.HapticFeedback.impactOccurred('light');
  };

  const finishOnboarding = () => {
    localStorage.setItem('onboarding_done', 'true'); setShowOnboarding(false);
    if (dailyAvailable) setShowDailyModal(true);
  };

  if (!user || !userData) return <div className="h-screen bg-gray-950 flex flex-col items-center justify-center font-bold text-yellow-400">Завантаження...</div>;

  if (showOnboarding) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center select-none text-white z-[100] relative">
        {onboardingStep === 0 && ( <div className="animate-fade-in"><div className="text-8xl mb-6">🦆</div><h2 className="text-3xl font-black text-yellow-400 mb-4">Привіт в Gold Duck!</h2><p className="text-gray-300 mb-8">Це не просто клікер. Це чесна гра, де ми віддаємо <span className="font-bold text-white">15% доходу</span> лідерам наприкінці сезону.</p></div> )}
        {onboardingStep === 1 && ( <div className="animate-fade-in"><div className="text-8xl mb-6">💸</div><h2 className="text-3xl font-black text-green-400 mb-4">Жодних Донатів!</h2><p className="text-gray-300 mb-8">Найголовніший донат — це твій час! Ти не платиш нічого, але маєш шанс виграти <span className="font-bold text-white">круті призи щомісяця</span>. Більше граєш — більше отримуєш!</p></div> )}
        {onboardingStep === 2 && ( <div className="animate-fade-in"><div className="text-8xl mb-6">🛒</div><h2 className="text-3xl font-black text-yellow-400 mb-4">Пасивний дохід</h2><p className="text-gray-300 mb-8">Зароблені монети витрачай на бізнеси. Качка буде працювати і приносити гроші, навіть коли ти офлайн (до 3-х годин).</p></div> )}
        {onboardingStep === 3 && ( <div className="animate-fade-in"><div className="text-8xl mb-6">🛡️</div><h2 className="text-3xl font-black text-yellow-400 mb-4">Сквади (Команди)</h2><p className="text-gray-300 mb-8">Об'єднуйся в команди з друзями! Якщо твій сквад переможе, всі його учасники отримають величезний бонус.</p></div> )}
        <button onClick={() => { triggerHaptic('light'); if (onboardingStep < 3) setOnboardingStep(prev => prev + 1); else finishOnboarding(); }} className="bg-yellow-500 text-gray-900 font-black text-xl py-4 w-full rounded-2xl active:scale-95 absolute bottom-10 left-6 right-6"> {onboardingStep < 3 ? 'Далі ➔' : 'Почати Гру! 🚀'} </button>
      </div>
    );
  }

  const currentSkinImg = userData?.current_skin === 'default' 
    ? LEVEL_SKINS[Math.min(level - 1, 9)] 
    : SKINS.find(s => s.id === userData?.current_skin)?.img || LEVEL_SKINS[Math.min(level - 1, 9)];

  const league = getLeague(level);
  const energyPercent = (energy / MAX_ENERGY) * 100;
  const bgColors = ["from-gray-900 to-gray-950", "from-slate-900 to-slate-950", "from-blue-900 to-gray-950", "from-indigo-900 to-gray-950", "from-purple-900 to-gray-950", "from-fuchsia-900 to-gray-950", "from-rose-900 to-gray-950", "from-red-900 to-gray-950", "from-yellow-900 to-gray-950", "from-yellow-600 to-red-900"];

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-b ${bgColors[Math.min(level-1, 9)]} select-none overflow-hidden text-white transition-colors duration-1000`}>
      
      {offlineEarned > 0 && (
        <div className="absolute top-20 left-4 right-4 bg-green-500 text-white p-4 rounded-2xl shadow-2xl z-50 text-center animate-fade-in border-2 border-green-400">
          <p className="font-black text-xl mb-1">Ти спав, а бізнес працював!</p><p className="font-bold text-lg">+ {offlineEarned} 💰</p>
        </div>
      )}

      <div className="text-center w-full p-4 z-10 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div className="text-left flex flex-col items-start">
            <h1 className="text-sm font-bold text-gray-300">Привіт, {userData.first_name}!</h1>
            <span className={`text-[10px] font-black uppercase tracking-widest ${league.color}`}>{league.name}</span>
            {userData.squad_id ? (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-md border border-gray-600">🛡️ {userData.squad_id}</span>
                <button onClick={() => tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/${BOT_USERNAME}/play?startapp=squad_${userData.squad_id}&text=Давай зі мною в сквад і виграємо реальні гроші!`)} className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-md active:scale-95">🔗 Поділитися</button>
              </div>
            ) : (
              <button onClick={() => setShowSquadModal(true)} className="text-[10px] bg-blue-600/50 px-2 py-0.5 rounded-md mt-1 active:scale-95">Вступити в Сквад</button>
            )}
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)} className="bg-gray-800 text-white font-bold w-10 h-10 rounded-xl shadow-lg active:scale-95 flex items-center justify-center text-lg">⚙️</button>
            <button onClick={openLeaderboard} className="bg-gradient-to-r from-yellow-500 to-yellow-400 text-gray-900 font-bold px-3 rounded-xl shadow-lg active:scale-95 flex items-center justify-center">🏆 Топ</button>
          </div>
        </div>
        
        {userData.auto_click && <div className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 animate-pulse">🤖 ПРАЦЮЄ АВТОКЛІКЕР!</div>}
        {userData.active_boost && <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 ml-2 animate-bounce">🔥 БУСТ x5 АКТИВНИЙ!</div>}
        
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-3xl p-4 shadow-2xl border border-gray-700/50">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-1">Баланс {passiveIncome > 0 && <span className="text-green-400">+{passiveIncome}/с</span>}</p>
          <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-lg">{Math.floor(points)}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative pb-[85px]">
        {activeTab === 'tap' && (
          <div className="flex-1 flex flex-col px-4 animate-fade-in">
            <div className="relative flex-1 flex items-center justify-center w-full touch-none" onTouchStart={handleTouch} ref={duckRef}>
              <div className="absolute bg-yellow-500/10 w-64 h-64 rounded-full blur-[50px] pointer-events-none"></div>
              <img src={currentSkinImg} alt="Duck" className={`w-64 h-64 object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] pointer-events-none transition-transform duration-75 ${userData.auto_click ? 'animate-pulse scale-95' : 'active:scale-x-[1.15] active:scale-y-[0.85]'}`}/>
              {clicks.map((c) => (
                <div key={c.id} className="absolute text-4xl font-black text-yellow-300 pointer-events-none z-50" style={{ left: c.x - 20, top: c.y - 50, animation: 'floatUp 1s ease-out forwards' }}>+{c.val}</div>
              ))}
            </div>

            <div className="w-full bg-gray-800/90 backdrop-blur-md p-4 rounded-3xl border border-gray-700/50 shrink-0 shadow-xl">
              <div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-blue-300">⚡ Енергія</span><span className="text-xs font-bold text-blue-300">{Math.floor(energy)} / {MAX_ENERGY}</span></div>
              <div className="w-full bg-gray-900 rounded-full h-2 mb-4 overflow-hidden border border-gray-950"><div className="bg-blue-500 h-full transition-all duration-300 rounded-full" style={{ width: `${energyPercent}%` }}></div></div>
              <div className="flex justify-between items-center mb-2"><span className="font-black text-white">Рівень {level} <span className="text-gray-500 text-xs">({levelNames[level-1]})</span></span></div>
              <div className="w-full bg-gray-900 rounded-full h-4 overflow-hidden border border-gray-950 shadow-inner relative"><div className="bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-300 h-full transition-all duration-300 rounded-full" style={{ width: `${Math.min(level < 10 ? ((points - LEVEL_THRESHOLDS[level-1]) / (LEVEL_THRESHOLDS[level] - LEVEL_THRESHOLDS[level-1])) * 100 : 100, 100)}%` }}></div></div>
            </div>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <div className="flex bg-gray-800 rounded-2xl p-1 mb-6">
              <button onClick={() => {triggerSelection(); setShopSubTab('business');}} className={`flex-1 py-2 font-bold rounded-xl transition-all ${shopSubTab === 'business' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-500'}`}>Бізнес</button>
              <button onClick={() => {triggerSelection(); setShopSubTab('skins');}} className={`flex-1 py-2 font-bold rounded-xl transition-all ${shopSubTab === 'skins' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-500'}`}>Скіни</button>
            </div>

            {shopSubTab === 'business' ? (
              <div className="space-y-4">
                {SHOP_ITEMS.map(item => (
                  <div key={item.id} className="bg-gray-800 border border-gray-700 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4"><div className="text-4xl">{item.icon}</div><div><h3 className="font-bold text-lg">{item.name}</h3><p className="text-xs text-green-400">{item.desc}</p></div></div>
                    <button onClick={() => buyUpgrade(item)} className={`font-bold py-2 px-3 text-sm rounded-xl active:scale-95 ${points >= item.cost ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-500'}`}>{item.cost} 💰</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className={`bg-gray-800 border p-4 rounded-3xl text-center flex flex-col items-center justify-between h-48 ${userData.current_skin === 'default' ? 'border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-gray-700'}`}>
                  <img src={LEVEL_SKINS[Math.min(level - 1, 9)]} className="w-16 h-16 object-contain mb-2 drop-shadow-lg" />
                  <h3 className="font-bold text-sm text-white mb-2">Еволюція (Базова)</h3>
                  <button onClick={resetToEvolutionSkin} className={`w-full py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${userData.current_skin === 'default' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-white'}`}>
                    {userData.current_skin === 'default' ? 'Одягнено' : 'Одягнути'}
                  </button>
                </div>

                {SKINS.map(skin => {
                  const isOwned = userData.unlocked_skins?.includes(skin.id);
                  const isEquipped = userData.current_skin === skin.id;
                  return (
                    <div key={skin.id} className={`bg-gray-800 border p-4 rounded-3xl text-center flex flex-col items-center justify-between h-48 ${isEquipped ? 'border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-gray-700'}`}>
                      <img src={skin.img} className="w-16 h-16 object-contain mb-2 drop-shadow-lg" />
                      <h3 className="font-bold text-sm text-white mb-2">{skin.name}</h3>
                      <button onClick={() => handleSkin(skin)} className={`w-full py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${isEquipped ? 'bg-yellow-400 text-gray-900' : isOwned ? 'bg-gray-600 text-white' : points >= skin.cost ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                        {isEquipped ? 'Одягнено' : isOwned ? 'Одягнути' : `${skin.cost} 💰`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            
            {dailyAvailable && (
              <button onClick={() => setShowDailyModal(true)} className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-black py-4 rounded-2xl mb-6 shadow-[0_0_15px_rgba(249,115,22,0.5)] animate-pulse active:scale-95">
                🎁 Забрати Щоденний Бонус!
              </button>
            )}

            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">🔄 Бусти (За відео)</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🔋</div><h3 className="font-bold text-xs text-white">Відновити Енергію</h3>
                <button onClick={() => watchAdForBoost('energy')} className="w-full bg-blue-500 text-white text-xs font-bold py-2 rounded-lg active:scale-95">Дивитись</button>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🚀</div><h3 className="font-bold text-xs text-white">Множник x5 (5 хв)</h3>
                <button onClick={() => watchAdForBoost('x5')} className="w-full bg-orange-500 text-white text-xs font-bold py-2 rounded-lg active:scale-95">Дивитись</button>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🤖</div><h3 className="font-bold text-xs text-white">Автоклікер (3 хв)</h3>
                <button onClick={() => watchAdForBoost('autoclick')} className="w-full bg-purple-500 text-white text-xs font-bold py-2 rounded-lg active:scale-95">Дивитись</button>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🧲</div><h3 className="font-bold text-xs text-white">+10,000 Монет</h3>
                <button onClick={() => watchAdForBoost('magnet')} className="w-full bg-green-500 text-white text-xs font-bold py-2 rounded-lg active:scale-95">Дивитись</button>
              </div>
            </div>

            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">🌐 Соцмережі</h2>
            <div className="space-y-3 mb-6">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div><h3 className="font-bold text-white text-sm">📣 Підписка Telegram</h3><p className="text-[10px] text-yellow-400">+ 100,000 монет</p></div>
                <button onClick={claimTelegramTask} className={`text-xs font-bold py-2 px-4 rounded-xl ${userData.task_tg_claimed ? 'bg-gray-700 text-gray-500' : 'bg-blue-500 text-white active:scale-95'}`}>{userData.task_tg_claimed ? 'Виконано' : 'Підписатись'}</button>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div><h3 className="font-bold text-white text-sm">✖️ Підписка на X (Twitter)</h3><p className="text-[10px] text-yellow-400">+ 50,000 монет</p></div>
                <button onClick={() => claimSocialTask('x', 'https://twitter.com/')} className={`text-xs font-bold py-2 px-4 rounded-xl ${userData.task_x_claimed ? 'bg-gray-700 text-gray-500' : 'bg-gray-600 text-white active:scale-95'}`}>{userData.task_x_claimed ? 'Виконано' : 'Перейти'}</button>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div><h3 className="font-bold text-white text-sm">▶️ Дивитись YouTube</h3><p className="text-[10px] text-yellow-400">+ 50,000 монет</p></div>
                <button onClick={() => claimSocialTask('yt', 'https://youtube.com/')} className={`text-xs font-bold py-2 px-4 rounded-xl ${userData.task_yt_claimed ? 'bg-gray-700 text-gray-500' : 'bg-red-600 text-white active:scale-95'}`}>{userData.task_yt_claimed ? 'Виконано' : 'Дивитись'}</button>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div><h3 className="font-bold text-white text-sm">📸 Підписка Instagram</h3><p className="text-[10px] text-yellow-400">+ 50,000 монет</p></div>
                <button onClick={() => claimSocialTask('ig', 'https://instagram.com/')} className={`text-xs font-bold py-2 px-4 rounded-xl ${userData.task_ig_claimed ? 'bg-gray-700 text-gray-500' : 'bg-pink-600 text-white active:scale-95'}`}>{userData.task_ig_claimed ? 'Виконано' : 'Перейти'}</button>
              </div>
            </div>

            {/* 🔥 РОЗШИРЕНА РЕФЕРАЛКА 🔥 */}
            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">🎯 Друзі (Запрошено: {userData.referrals_count || 0})</h2>
            <div className="space-y-3 mb-6">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div><h3 className="font-bold text-white text-sm">🤝 Запроси друга (Win-Win)</h3><p className="text-[10px] text-green-400">Тобі 25к, Другу 25к ОДРАЗУ!</p></div>
                  <button onClick={() => tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/${BOT_USERNAME}/play?startapp=${user.id}&text=Заходь за моїм лінком і отримай 25,000 монет на старті!`)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-xl active:scale-95">Запросити</button>
                </div>
                <div className="bg-gray-900/50 p-2 rounded-xl text-[10px] text-gray-400 text-center">*Бонус дається миттєво. А коли друг досягне 3-го рівня, ти отримаєш ще 50,000 монет!</div>
              </div>
            </div>
            
            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">🏆 Досягнення</h2>
            <div className="space-y-2 mb-6">
              {[ 
                { id: 'first_10k', name: 'Назбирай 10,000 монет', type: 'points', goal: 10000, reward: 5000 }, 
                { id: 'lvl3', name: 'Досягни 3 рівня', type: 'level', goal: 3, reward: 25000 },
                { id: 'ref_3', name: 'Запроси 3 друга', type: 'refs', goal: 3, reward: 200000 },
                { id: 'ref_10', name: 'Запроси 10 друзів', type: 'refs', goal: 10, reward: 1000000 },
                { id: 'ref_50', name: 'Запроси 50 друзів', type: 'refs', goal: 50, reward: 10000000 },
              ].map(ach => {
                const isDone = userData.achievements?.includes(ach.id);
                return (
                  <div key={ach.id} className="bg-gray-800 p-3 rounded-2xl flex justify-between items-center border border-gray-700">
                    <div><h3 className="text-sm font-bold text-white">{ach.name}</h3><p className="text-[10px] text-yellow-400">Нагорода: +{ach.reward}</p></div>
                    <button onClick={() => claimAchievement(ach.id, ach.reward, ach.goal, ach.type)} className={`text-xs font-bold py-2 px-3 rounded-lg ${isDone ? 'bg-gray-700 text-gray-500' : 'bg-green-500 text-white active:scale-95'}`}>{isDone ? 'Забрано' : 'Забрати'}</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">ℹ️ Інфо та Правила</h2>
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-sm text-gray-300 space-y-4 mb-6 shadow-xl">
              
              <p><strong className="text-green-400 text-base">💸 Жодних Донатів:</strong> Найголовніший донат — це ваш час! Більше граєш — більше отримуєш. Ти не платиш нічого, але маєш шанс виграти круті призи щомісяця. Хіба це не круто?</p>

              <p><strong className="text-white text-base">1. Чесний рейтинг:</strong> Ми не казино і не лотерея. Нагороди отримують лише ті, хто закріпився в ТОП-11 рейтингу на момент закінчення сезону (1-го числа о 00:00).</p>
              
              <p><strong className="text-yellow-400 text-base">2. Призовий фонд (Прозоро):</strong> Ми гарантовано віддаємо <span className="font-bold text-white">15% від усього доходу з реклами</span> щомісяця. <br/> 
              <span className="text-xs text-gray-400">Наприклад: Якщо дохід склав $5000, призовий фонд — $750. Чим більше ви дивитесь рекламу (бусти), тим більший загальний призовий фонд!</span></p>

              <p><strong className="text-blue-400 text-base">3. Сквади (Команди):</strong> Створи свій Сквад або приєднайся до існуючого. Якщо Сквад перемагає в рейтингу команд — <span className="font-bold text-white">50% призу отримує адміністратор Скваду, а інші 50% діляться між ТОП гравцями цієї команди.</span></p>
              
              <p><strong className="text-white text-base">4. Як заробити очки:</strong> Тапай, купуй бізнеси для пасивного доходу (працює до 3-х годин офлайн) та виконуй завдання.</p>
              
              <p><strong className="text-red-400 text-base">5. Античит:</strong> Сторонні скрипти суворо заборонені. Система виявляє їх автоматично і блокує гравця до кінця сезону.</p>
            </div>
            
            {String(user.id) === ADMIN_TELEGRAM_ID && (
              <div className="bg-red-900/50 border-2 border-red-500 p-5 rounded-3xl mb-6 shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                <h2 className="text-xl font-black text-white mb-2 text-center">👑 ПАНЕЛЬ АДМІНА</h2>
                <p className="text-xs text-gray-300 text-center mb-4">Натисни кнопку нижче, щоб <b>протестувати завершення сезону</b>. Це надішле тобі в бота звіт і обнулить всі монети.</p>
                <button onClick={endSeasonAdmin} className="bg-red-600 text-white font-black py-4 rounded-xl w-full active:scale-95 transition-all">
                  🛑 ТЕСТОВЕ ЗАВЕРШЕННЯ СЕЗОНУ
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 grid grid-cols-4 px-1 pb-safe z-40">
        <button onClick={() => { triggerSelection(); setActiveTab('tap'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'tap' ? 'text-yellow-400' : 'text-gray-500'}`}><span className="text-2xl mb-1">🦆</span><span className="text-[10px] font-bold uppercase">Грай</span></button>
        <button onClick={() => { triggerSelection(); setActiveTab('shop'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'shop' ? 'text-yellow-400' : 'text-gray-500'}`}><span className="text-2xl mb-1">🛒</span><span className="text-[10px] font-bold uppercase">Магазин</span></button>
        <button onClick={() => { triggerSelection(); setActiveTab('tasks'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'tasks' ? 'text-yellow-400' : 'text-gray-500'}`}><span className="text-2xl mb-1">🎯</span><span className="text-[10px] font-bold uppercase">Завдання</span></button>
        <button onClick={() => { triggerSelection(); setActiveTab('info'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'info' ? 'text-yellow-400' : 'text-gray-500'}`}><span className="text-2xl mb-1">ℹ️</span><span className="text-[10px] font-bold uppercase">Інфо</span></button>
      </div>

      {showSettings && (
        <div className="absolute inset-0 z-[90] bg-gray-950/95 flex flex-col p-6 items-center justify-center animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 bg-gray-800 text-gray-400 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
            <h2 className="text-2xl font-black text-white mb-6 text-center">⚙️ Налаштування</h2>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex justify-between items-center mb-6">
              <span className="font-bold text-white">Вібрація (Haptic)</span>
              <button onClick={toggleHaptic} className={`w-12 h-6 rounded-full relative transition-colors ${hapticEnabled ? 'bg-green-500' : 'bg-gray-600'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${hapticEnabled ? 'left-6.5 right-0.5' : 'left-0.5'}`}></div>
              </button>
            </div>
            <button onClick={resetProgress} className="bg-red-900/30 border border-red-500/50 text-red-500 font-bold py-3 rounded-xl w-full active:scale-95 transition-all">⚠️ Скинути прогрес (Для тестів)</button>
          </div>
        </div>
      )}

      {showSquadModal && (
        <div className="absolute inset-0 z-[80] bg-gray-950/95 flex flex-col p-6 items-center justify-center animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-2 text-center">🛡️ Вступити в Сквад</h2>
            <p className="text-gray-400 text-center text-xs mb-6">Введи юзернейм Telegram-каналу. Якщо такого Скваду ще немає, він створиться автоматично!</p>
            <div className="flex bg-gray-800 rounded-xl p-2 mb-6 border border-gray-700"><span className="text-gray-500 font-bold p-2">@</span><input type="text" value={squadInput} onChange={(e) => setSquadInput(e.target.value.replace('@', ''))} placeholder="channel_name" className="bg-transparent text-white font-bold w-full outline-none"/></div>
            <div className="flex gap-3"><button onClick={() => setShowSquadModal(false)} className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold active:scale-95">Скасувати</button><button onClick={submitSquad} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold active:scale-95">Приєднатися</button></div>
          </div>
        </div>
      )}

      {showLeaderboard && (
        <div className="absolute inset-0 z-[60] bg-gray-950/95 flex flex-col p-6 animate-fade-in backdrop-blur-md">
           <div className="flex justify-between items-center mb-4 mt-4"><h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest">ТОП Сезону</h2><button onClick={() => setShowLeaderboard(false)} className="bg-gray-800 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl active:scale-90">✕</button></div>
          
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
          <div className="text-8xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2">Новий Рівень!</h2>
          <p className="text-2xl text-yellow-400 font-bold mb-8">Ти тепер <span className="uppercase text-3xl block mt-2">{levelNames[justReachedLevel - 1]}</span></p>
          <button onClick={() => setShowLevelUp(false)} className="bg-yellow-500 text-gray-900 font-black text-xl py-4 px-12 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.5)] active:scale-95 transition-all w-full">Продовжити!</button>
        </div>
      )}

      {showDailyModal && (
        <div className="absolute inset-0 z-50 bg-gray-950/95 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-md text-center">
          <div className="text-7xl mb-6 animate-bounce">🎁</div>
          <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest mb-4">Щоденний бонус!</h2>
          <button onClick={claimDaily} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-black text-xl py-4 px-10 rounded-2xl w-full active:scale-95">Забрати нагороду!</button>
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