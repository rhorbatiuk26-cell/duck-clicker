import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// ==========================================
// КОНСТАНТИ ТА НАЛАШТУВАННЯ
// ==========================================

const SERVER_URL = 'https://duck-clicker-production.up.railway.app/api';
const CHANNEL_URL = 'https://t.me/ТУТ_ТВІЙ_КАНАЛ';

const BOT_USERNAME = 'GoldDuckTap_bot';
const ADMIN_TELEGRAM_ID = '1057689349';

const LEVEL_THRESHOLDS = [
  0,
  50000,
  500000,
  2500000,
  10000000,
  50000000,
  250000000,
  1000000000,
  10000000000,
  100000000000
];

const MAX_ENERGY = 2000;

const levelNames = [
  "Бродяга",
  "Новачок",
  "Шукач",
  "Хуліган",
  "Бізнесмен",
  "Бос",
  "Магнат",
  "Олігарх",
  "Божество",
  "Творець"
];

const LEVEL_SKINS = [
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f986.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f424.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f425.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f426.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f989.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f985.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f9a2.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f9a9.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f99a.svg",
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f409.svg"
];

const getLeague = (lvl) => {
  if (lvl <= 3) return { name: "Бронзова Ліга 🥉", color: "text-orange-400" };
  if (lvl <= 6) return { name: "Срібна Ліга 🥈", color: "text-gray-300" };
  if (lvl <= 9) return { name: "Золота Ліга 🏆", color: "text-yellow-400" };
  return { name: "Діамантова Ліга 💎", color: "text-cyan-400" };
};

const SKINS = [
  {
    id: 'cool',
    name: 'Качка-Кіборг',
    img: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f916.svg',
    cost: 5000000
  },
  {
    id: 'rich',
    name: 'Золота Качка',
    img: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f911.svg',
    cost: 10000000
  },
];

const SHOP_ITEMS = [
  { id: 1, name: "Крихти Хліба", desc: "+300 монет / год", baseCost: 2500, income: 300, icon: "🍞" },
  { id: 2, name: "Стара Кепка", desc: "+1,500 монет / год", baseCost: 15000, income: 1500, icon: "🧢" },
  { id: 3, name: "Гітара Бродяги", desc: "+6,000 монет / год", baseCost: 75000, income: 6000, icon: "🎸" },
  { id: 4, name: "Кіоск з Шаурмою", desc: "+20,000 монет / год", baseCost: 300000, income: 20000, icon: "🌮" },
  { id: 5, name: "Крипто-Ферма", desc: "+85,000 монет / год", baseCost: 1500000, income: 85000, icon: "💻" },
  { id: 6, name: "Мережа Банків", desc: "+450,000 монет / год", baseCost: 10000000, income: 450000, icon: "🏦" },
  { id: 7, name: "Качиний ШІ", desc: "+2,000,000 монет / год", baseCost: 50000000, income: 2000000, icon: "🤖" },
  { id: 8, name: "Місія на Марс", desc: "+7,500,000 монет / год", baseCost: 250000000, income: 7500000, icon: "🚀" },
  { id: 9, name: "Крипто-Біржа", desc: "+30,000,000 монет / год", baseCost: 1000000000, income: 30000000, icon: "📈", reqRefs: 3 },
  { id: 10, name: "Телеканал", desc: "+150,000,000 монет / год", baseCost: 5000000000, income: 150000000, icon: "📺", reqRefs: 7 },
];

// ==========================================
// ГОЛОВНИЙ КОМПОНЕНТ
// ==========================================

function App() {
  const [userData, setUserData] = useState(null);
  const [points, setPoints] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [level, setLevel] = useState(1);
  const [energy, setEnergy] = useState(MAX_ENERGY);
  const [passiveIncome, setPassiveIncome] = useState(0);

  const [activeTab, setActiveTab] = useState('tap');
  const [shopSubTab, setShopSubTab] = useState('business');
  const [clicks, setClicks] = useState([]);
  
  const [friendsList, setFriendsList] = useState([]);

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState('players');
  const [leadersData, setLeadersData] = useState({ players: [], squads: [] });
  const [currentUserRankData, setCurrentUserRankData] = useState(null);

  const [showSquadModal, setShowSquadModal] = useState(false);
  const [squadInput, setSquadInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(() => localStorage.getItem('haptic_enabled') !== 'false');

  const [dailyAvailable, setDailyAvailable] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [offlineEarned, setOfflineEarned] = useState(0);

  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('onboarding_done'));
  const [onboardingStep, setOnboardingStep] = useState(0);

  const [showLevelUp, setShowLevelUp] = useState(false);
  const [justReachedLevel, setJustReachedLevel] = useState(null);
  
  const [isFlipping, setIsFlipping] = useState(false);
  const [isWobbling, setIsWobbling] = useState(false);

  const tg = window.Telegram.WebApp;
  const user = tg.initDataUnsafe?.user;
  const startParam = tg.initDataUnsafe?.start_param;

  const duckRef = useRef(null);
  const pendingTaps = useRef(0);
  const tapTimeout = useRef(null);

  // ==========================================
  // ВІБРАЦІЯ
  // ==========================================

  const triggerHaptic = (type) => {
    try {
      if (hapticEnabled && tg?.HapticFeedback?.impactOccurred) {
        tg.HapticFeedback.impactOccurred(type);
      }
    } catch (e) {
      console.warn("Haptic error", e);
    }
  };

  const triggerNotification = (type) => {
    try {
      if (hapticEnabled && tg?.HapticFeedback?.notificationOccurred) {
        tg.HapticFeedback.notificationOccurred(type);
      }
    } catch (e) {
      console.warn("Haptic notification error", e);
    }
  };

  const triggerSelection = () => {
    try {
      if (hapticEnabled && tg?.HapticFeedback?.selectionChanged) {
        tg.HapticFeedback.selectionChanged();
      }
    } catch (e) {
      console.warn("Haptic selection error", e);
    }
  };

  // ==========================================
  // ІНІЦІАЛІЗАЦІЯ
  // ==========================================

  useEffect(() => {
    tg.expand();
    tg.disableVerticalSwipes();

    const fetchUser = async () => {
      if (!user) return;
      try {
        const response = await axios.post(`${SERVER_URL}/user/init`, {
          telegram_id: user.id,
          first_name: user.first_name || 'Гравець',
          start_param: startParam || null
        });

        const data = response.data;
        setUserData(data.user);
        setPoints(Number(data.user.season_points));
        setTotalEarned(Number(data.user.total_earned));
        setLevel(Number(data.user.level));
        setEnergy(Number(data.user.energy));
        setPassiveIncome(Number(data.user.passive_income));

        if (data.offline_earned > 0) {
          setOfflineEarned(data.offline_earned);
          setTimeout(() => setOfflineEarned(0), 5000);
        }

        if (data.daily_available) {
          setDailyAvailable(true);
          if (!showOnboarding) setShowDailyModal(true);
        }
      } catch (err) {
        console.error("Init Error:", err);
      }
    };

    fetchUser();
  }, [user, startParam, showOnboarding]);

  useEffect(() => {
    if (activeTab === 'friends' && userData) {
      axios.get(`${SERVER_URL}/user/friends?telegram_id=${userData.telegram_id}`)
        .then(res => setFriendsList(res.data.friends))
        .catch(err => console.error(err));
    }
  }, [activeTab, userData]);

  const triggerLevelUp = (newCalcLevel) => {
    setJustReachedLevel(newCalcLevel);
    setShowLevelUp(true);
    triggerNotification('success');

    setIsFlipping(true);
    setTimeout(() => setIsFlipping(false), 1000);
  };

  // ==========================================
  // ПАСИВНИЙ ДОХІД
  // ==========================================

  useEffect(() => {
    let totalIncomePerHour = passiveIncome;
    let addedPerSec = totalIncomePerHour / 3600;
    
    if (userData?.auto_click) {
      addedPerSec += (7 * level);
    }
    
    if (addedPerSec <= 0) return;

    const interval = setInterval(() => {
      setTotalEarned(prev => {
        const newTotal = prev + addedPerSec;
        let calcLevel = 1;
        
        for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
          if (newTotal >= LEVEL_THRESHOLDS[i]) {
            calcLevel = i + 1;
            break;
          }
        }
        
        if (calcLevel > 10) calcLevel = 10;

        setLevel(currentLevel => {
          if (calcLevel > currentLevel) {
            triggerLevelUp(calcLevel);
            return calcLevel;
          }
          return currentLevel;
        });
        
        return newTotal;
      });

      setPoints(prev => prev + addedPerSec);

      if (userData?.auto_click && duckRef.current && activeTab === 'tap') {
        const rect = duckRef.current.getBoundingClientRect();
        const newClicks = Array.from({ length: 2 }).map(() => ({
          id: Date.now() + Math.random(),
          x: (Math.random() * rect.width) + 20,
          y: (Math.random() * rect.height) + 20,
          val: level
        }));
        setClicks(prev => [...prev.slice(-15), ...newClicks]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [passiveIncome, userData?.auto_click, level, activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy(prev => (prev < MAX_ENERGY ? prev + 0.33 : prev));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ==========================================
  // КЛІК ПО КАЧЦІ
  // ==========================================

  const handleTap = (e) => {
    if (
      !userData || 
      showLeaderboard || 
      showDailyModal || 
      showLevelUp || 
      showSquadModal || 
      showOnboarding || 
      showSettings
    ) {
      return;
    }
    
    if (energy <= 0) return;

    triggerHaptic('medium');

    setIsWobbling(true);
    setTimeout(() => setIsWobbling(false), 150);

    const tapValue = userData.active_boost ? level * userData.boost_multiplier : level;

    setTotalEarned(prev => {
      const newTotal = prev + tapValue;
      let calcLevel = 1;
      
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (newTotal >= LEVEL_THRESHOLDS[i]) {
          calcLevel = i + 1;
          break;
        }
      }
      
      if (calcLevel > 10) calcLevel = 10;

      setLevel(currentLevel => {
        if (calcLevel > currentLevel) {
          triggerLevelUp(calcLevel);
          return calcLevel;
        }
        return currentLevel;
      });
      
      return newTotal;
    });

    setPoints(prev => prev + tapValue);
    setEnergy(prev => prev - 1);

    const rect = duckRef.current.getBoundingClientRect();
    const newClick = {
      id: Date.now() + Math.random(),
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      val: tapValue
    };

    setClicks(prev => [...prev.slice(-20), newClick]);
    
    setTimeout(() => {
      setClicks(prev => prev.filter(c => c.id !== newClick.id));
    }, 1000);

    pendingTaps.current += 1;
    clearTimeout(tapTimeout.current);

    tapTimeout.current = setTimeout(async () => {
      const countToSend = pendingTaps.current;
      pendingTaps.current = 0;
      if (countToSend > 0) {
        try {
          await axios.post(`${SERVER_URL}/user/tap`, {
            telegram_id: userData.telegram_id,
            count: countToSend
          });
        } catch (err) {
          console.error(err);
        }
      }
    }, 500);
  };

  // ==========================================
  // РЕКЛАМА
  // ==========================================

  const watchAdForBoost = (boostType) => {
    if (window.Adsgram) {
      const AdController = window.Adsgram.init({ blockId: "25905" });

      AdController.show()
        .then(async () => {
          triggerNotification('success');
          try {
            const res = await axios.post(`${SERVER_URL}/user/ad_boost`, {
              telegram_id: userData.telegram_id,
              boost_type: boostType,
              fallback: false
            });
            
            setUserData(res.data.user);
            setPoints(Number(res.data.user.season_points));
            setTotalEarned(Number(res.data.user.total_earned));
            
            if (boostType === 'energy') {
              setEnergy(MAX_ENERGY);
            }
            
            tg.showAlert("Успішно! Буст активовано 🚀");
          } catch (err) {
            tg.showAlert(err.response?.data?.error || "Помилка активації");
          }
        })
        .catch(async () => {
          triggerNotification('warning');
          try {
            const res = await axios.post(`${SERVER_URL}/user/ad_boost`, {
              telegram_id: userData.telegram_id,
              boost_type: boostType,
              fallback: true
            });
            
            setUserData(res.data.user);
            setPoints(Number(res.data.user.season_points));
            setTotalEarned(Number(res.data.user.total_earned));

            let calcLvl = 1;
            for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
              if (Number(res.data.user.total_earned) >= LEVEL_THRESHOLDS[i]) {
                calcLvl = i + 1;
                break;
              }
            }
            
            if (calcLvl > level) {
              triggerLevelUp(calcLvl);
              setLevel(calcLvl);
            }
            
            tg.showAlert("Реклами поки немає, але ти отримуєш бонус +1500 монет 💰");
          } catch (err) {
            tg.showAlert(err.response?.data?.error || "Помилка (Можливо таймер ще не пройшов)");
          }
        });
    } else {
      tg.showAlert("Помилка завантаження реклами. Перевір інтернет.");
    }
  };

  // ==========================================
  // МАГАЗИН, ДРУЗІ ТА ІНШЕ
  // ==========================================

  const buyUpgrade = async (item, currentCost) => {
    if (points < currentCost) {
      triggerNotification('error');
      return;
    }
    triggerNotification('success');
    
    try {
      const response = await axios.post(`${SERVER_URL}/user/buy_upgrade`, {
        telegram_id: userData.telegram_id,
        item_id: item.id,
        cost: currentCost,
        income_increase: item.income
      });
      setUserData(response.data.user);
      setPoints(Number(response.data.user.season_points));
      setPassiveIncome(Number(response.data.user.passive_income));
    } catch (err) {
      tg.showAlert(err.response?.data?.error || "Помилка покупки");
    }
  };

  const handleSkin = async (skin) => {
    const isOwned = userData.unlocked_skins?.includes(skin.id);
    if (!isOwned && points < skin.cost) return;
    
    triggerNotification('success');
    try {
      const res = await axios.post(`${SERVER_URL}/user/buy_skin`, {
        telegram_id: userData.telegram_id,
        skin_id: skin.id,
        cost: skin.cost
      });
      setUserData(res.data.user);
      setPoints(Number(res.data.user.season_points));
    } catch (err) {
      console.error(err);
    }
  };

  const resetToEvolutionSkin = async () => {
    try {
      const res = await axios.post(`${SERVER_URL}/user/buy_skin`, {
        telegram_id: userData.telegram_id,
        skin_id: 'default',
        cost: 0
      });
      setUserData(res.data.user);
      triggerNotification('success');
    } catch (err) {
      console.error(err);
    }
  };

  const submitSquad = async () => {
    if (!squadInput.trim()) return;
    try {
      const res = await axios.post(`${SERVER_URL}/squad/join`, {
        telegram_id: userData.telegram_id,
        squad_username: squadInput
      });
      setUserData(res.data.user);
      triggerNotification('success');
      setShowSquadModal(false);
      tg.showAlert(`Успіх! Ти приєднався до скваду @${res.data.squad.username}`);
    } catch (err) {
      tg.showAlert("Помилка вступу");
    }
  };

  const claimFriendReward = async (friendId, reqLevel) => {
    triggerNotification('success');
    try {
      const res = await axios.post(`${SERVER_URL}/user/claim_ref_reward`, {
        telegram_id: userData.telegram_id,
        friend_id: friendId,
        reward_level: reqLevel
      });
      
      setUserData(res.data.user);
      setPoints(Number(res.data.user.season_points));
      setTotalEarned(Number(res.data.user.total_earned));
      tg.showAlert(`Бонус забрано! +${res.data.reward} 💰`);
      
      setFriendsList(prev => prev.map(f => {
        if (f.telegram_id === friendId) {
          if (reqLevel === 3) return { ...f, ref_reward_lvl3_claimed: true };
          if (reqLevel === 5) return { ...f, ref_reward_lvl5_claimed: true };
        }
        return f;
      }));
    } catch (err) {
      tg.showAlert(err.response?.data?.error || 'Помилка');
    }
  };

  const claimAchievement = async (id, reward, goal, type = 'points') => {
    if (userData.achievements?.includes(id)) return;
    if (type === 'points' && totalEarned < goal) {
      tg.showAlert("Ще не назбирав монет!");
      return;
    }
    if (type === 'level' && level < goal) {
      tg.showAlert("Ще не досяг рівня!");
      return;
    }
    if (type === 'refs' && (userData.referrals_count || 0) < goal) {
      tg.showAlert(`Тобі потрібно ${goal} АКТИВНИХ друзів!`);
      return;
    }

    triggerNotification('success');
    try {
      const res = await axios.post(`${SERVER_URL}/user/achievement`, {
        telegram_id: userData.telegram_id,
        achievement_id: id,
        reward
      });
      setUserData(res.data.user);
      setPoints(Number(res.data.user.season_points));
      setTotalEarned(Number(res.data.user.total_earned));
      tg.showAlert(`Досягнення отримано! +${reward} 💰`);
    } catch (err) {
      tg.showAlert(err.response?.data?.error || "Помилка");
    }
  };

  const claimSocialTask = async (type, link) => {
    if (userData[`task_${type}_claimed`]) return;
    tg.openLink(link);
    setTimeout(async () => {
      try {
        const response = await axios.post(`${SERVER_URL}/user/claim_task`, {
          telegram_id: userData.telegram_id,
          task_type: type
        });
        setPoints(Number(response.data.user.season_points));
        setTotalEarned(Number(response.data.user.total_earned));
        setUserData(response.data.user);
        triggerNotification('success');
        tg.showAlert(`Нагороду отримано! +${response.data.reward} 💰`);
      } catch (err) {
        tg.showAlert("Спробуй ще раз.");
      }
    }, 5000);
  };

  const claimTelegramTask = async () => {
    if (userData.task_tg_claimed) return;
    tg.openTelegramLink(CHANNEL_URL);
    setTimeout(async () => {
      try {
        const response = await axios.post(`${SERVER_URL}/user/claim_task`, {
          telegram_id: userData.telegram_id,
          task_type: 'telegram'
        });
        setPoints(Number(response.data.user.season_points));
        setTotalEarned(Number(response.data.user.total_earned));
        setUserData(response.data.user);
        triggerNotification('success');
        tg.showAlert("Дякуємо за підписку! Нараховано +25,000 монет 💰");
      } catch (err) {
        if (err.response?.data?.error === 'not_subscribed') {
          tg.showAlert("⚠️ Ти ще не підписався на канал!");
        }
      }
    }, 5000);
  };

  const resetProgress = async () => {
    tg.showConfirm("УВАГА! Почати з нуля?", async (agreed) => {
      if (agreed) {
        try {
          const res = await axios.post(`${SERVER_URL}/user/reset`, {
            telegram_id: userData.telegram_id
          });
          setUserData(res.data.user);
          setPoints(0);
          setTotalEarned(0);
          setLevel(1);
          setEnergy(MAX_ENERGY);
          setPassiveIncome(0);
          triggerNotification('success');
          setActiveTab('tap');
          setShowSettings(false);
          localStorage.removeItem('onboarding_done');
          setShowOnboarding(true);
          setOnboardingStep(0);
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const endSeasonAdmin = async () => {
    tg.showConfirm("АДМІН! Завершити сезон прямо зараз?", async (agreed) => {
      if (agreed) {
        try {
          await axios.post(`${SERVER_URL}/admin/end_season`, {
            telegram_id: userData.telegram_id
          });
          tg.showAlert("✅ СЕЗОН ЗАВЕРШЕНО! Перевір бот.");
          window.location.reload();
        } catch (err) {
          tg.showAlert("Помилка Адмінки.");
        }
      }
    });
  };

  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    triggerHaptic('light');
    try {
      const res = await axios.get(`${SERVER_URL}/leaderboard?telegram_id=${user.id}`);
      setLeadersData({ players: res.data.players, squads: res.data.squads });
      setCurrentUserRankData(res.data.currentUser);
    } catch (err) {
      console.error(err);
    }
  };

  const claimDaily = async () => {
    try {
      const response = await axios.post(`${SERVER_URL}/user/daily`, {
        telegram_id: userData.telegram_id
      });
      setPoints(Number(response.data.user.season_points));
      setTotalEarned(Number(response.data.user.total_earned));
      setUserData(response.data.user);
      setShowDailyModal(false);
      setDailyAvailable(false);
      triggerNotification('success');
    } catch (err) {
      setShowDailyModal(false);
    }
  };

  const toggleHaptic = () => {
    const newState = !hapticEnabled;
    setHapticEnabled(newState);
    localStorage.setItem('haptic_enabled', newState);
    if (newState) triggerHaptic('light');
  };

  const finishOnboarding = () => {
    localStorage.setItem('onboarding_done', 'true');
    setShowOnboarding(false);
    if (dailyAvailable) setShowDailyModal(true);
  };

  const isCooldown = (readyAt) => readyAt && new Date(readyAt).getTime() > Date.now();
  const getRemainingMin = (readyAt) => Math.ceil((new Date(readyAt).getTime() - Date.now()) / 60000);

  // ==========================================
  // РЕНДЕР ІНТЕРФЕЙСУ
  // ==========================================

  if (!user || !userData) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col items-center justify-center font-bold text-yellow-400">
        Завантаження...
      </div>
    );
  }

  // ЕКРАН ОЗНАЙОМЛЕННЯ
  if (showOnboarding) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center select-none text-white z-[100] relative">
        <div className="flex flex-col items-center justify-center bg-gray-900 border border-gray-700 w-full max-w-sm rounded-3xl p-8 space-y-6 shadow-2xl animate-fade-in mb-10">
          
          {onboardingStep === 0 && (
            <>
              <div className="text-7xl">🦆</div>
              <h2 className="text-2xl font-black text-yellow-400 leading-tight">Привіт в Gold Duck!</h2>
              <p className="text-gray-300 text-sm leading-relaxed px-2">
                Це не просто клікер. Це чесна гра, де ми віддаємо <span className="font-bold text-white">15% доходу</span> лідерам наприкінці сезону.
              </p>
            </>
          )}
          
          {onboardingStep === 1 && (
            <>
              <div className="text-7xl">💸</div>
              <h2 className="text-2xl font-black text-green-400 leading-tight">Жодних Донатів!</h2>
              <p className="text-gray-300 text-sm leading-relaxed px-2">
                Найголовніший донат — це твій час! Ти не платиш нічого, але маєш шанс виграти <span className="font-bold text-white">круті призи</span> щомісяця.
              </p>
            </>
          )}
          
          {onboardingStep === 2 && (
            <>
              <div className="text-7xl">🛒</div>
              <h2 className="text-2xl font-black text-yellow-400 leading-tight">Пасивний дохід</h2>
              <p className="text-gray-300 text-sm leading-relaxed px-2">
                Зароблені монети витрачай на бізнеси. Качка буде працювати і приносити гроші, навіть коли ти офлайн (до 3-х годин).
              </p>
            </>
          )}
          
          {onboardingStep === 3 && (
            <>
              <div className="text-7xl">🛡️</div>
              <h2 className="text-2xl font-black text-yellow-400 leading-tight">Сквади (Команди)</h2>
              <p className="text-gray-300 text-sm leading-relaxed px-2">
                Об'єднуйся в команди з друзями! Якщо твій сквад переможе, всі його учасники отримають величезний бонус.
              </p>
            </>
          )}

        </div>
        
        <button
          onClick={() => {
            triggerHaptic('light');
            if (onboardingStep < 3) {
              setOnboardingStep(prev => prev + 1);
            } else {
              finishOnboarding();
            }
          }}
          className="bg-yellow-500 text-gray-900 font-black text-lg py-4 w-[90%] rounded-2xl active:scale-95 absolute bottom-8 shadow-xl"
        >
          {onboardingStep < 3 ? 'Далі ➔' : 'Почати Гру! 🚀'}
        </button>
      </div>
    );
  }

  const currentSkinImg = userData?.current_skin === 'default'
    ? LEVEL_SKINS[Math.min(level - 1, 9)]
    : SKINS.find(s => s.id === userData?.current_skin)?.img || LEVEL_SKINS[Math.min(level - 1, 9)];
    
  const league = getLeague(level);
  const energyPercent = (energy / MAX_ENERGY) * 100;
  
  const bgColors = [
    "from-gray-900 to-gray-950",
    "from-slate-900 to-slate-950",
    "from-blue-900 to-gray-950",
    "from-indigo-900 to-gray-950",
    "from-purple-900 to-gray-950",
    "from-fuchsia-900 to-gray-950",
    "from-rose-900 to-gray-950",
    "from-red-900 to-gray-950",
    "from-yellow-900 to-gray-950",
    "from-yellow-600 to-red-900"
  ];

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-b ${bgColors[Math.min(level-1, 9)]} select-none overflow-hidden text-white transition-colors duration-1000`}>
      
      {/* ПОВІДОМЛЕННЯ ПРО ОФЛАЙН ДОХІД */}
      {offlineEarned > 0 && (
        <div className="absolute top-20 left-4 right-4 bg-green-500 text-white p-4 rounded-2xl shadow-2xl z-50 text-center animate-fade-in border-2 border-green-400">
          <p className="font-black text-xl mb-1">Ти спав, а бізнес працював!</p>
          <p className="font-bold text-lg">+ {offlineEarned} 💰</p>
        </div>
      )}
      
      {/* ВЕРХНЯ ПАНЕЛЬ */}
      <div className="text-center w-full p-4 z-10 shrink-0">
        <div className="flex justify-between items-center mb-4">
          
          <div className="text-left flex flex-col items-start">
            <h1 className="text-sm font-bold text-gray-300">Привіт, {userData.first_name}!</h1>
            <span className={`text-[10px] font-black uppercase tracking-widest ${league.color}`}>
              {league.name}
            </span>
            
            {userData.squad_id ? (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-md border border-gray-600">
                  🛡️ {userData.squad_id}
                </span>
              </div>
            ) : (
              <button
                onClick={() => setShowSquadModal(true)}
                className="text-[10px] bg-blue-600/50 px-2 py-0.5 rounded-md mt-1 active:scale-95"
              >
                Вступити в Сквад
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="bg-gray-800 text-white font-bold w-10 h-10 rounded-xl shadow-lg active:scale-95 flex items-center justify-center text-lg"
            >
              ⚙️
            </button>
            <button
              onClick={openLeaderboard}
              className="bg-gradient-to-r from-yellow-500 to-yellow-400 text-gray-900 font-bold px-3 rounded-xl shadow-lg active:scale-95 flex items-center justify-center"
            >
              🏆 Топ
            </button>
          </div>
        </div>
        
        {/* АКТИВНІ БУСТИ */}
        {userData.auto_click && (
          <div className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 animate-pulse">
            🤖 ПРАЦЮЄ АВТОКЛІКЕР!
          </div>
        )}
        
        {userData.active_boost && (
          <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 ml-2 animate-bounce">
            🔥 БУСТ x5 АКТИВНИЙ!
          </div>
        )}
        
        {/* БАЛАНС */}
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-3xl p-5 shadow-2xl border border-gray-700/50 flex flex-col items-center justify-center">
          <div className="flex justify-center items-center gap-2 text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-1">
            <span>Баланс</span>
            <span className={passiveIncome > 0 ? "text-green-400" : "text-gray-500"}>
              +{passiveIncome}/год
            </span>
          </div>
          <p className="text-6xl font-black text-center text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-lg leading-tight">
            {Math.floor(points)}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative pb-[85px]">
        
        {/* ============================== */}
        {/* ВКЛАДКА: ГРАЙ */}
        {/* ============================== */}
        {activeTab === 'tap' && (
          <div className="flex-1 flex flex-col px-4 animate-fade-in">
            
            {/* КАЧКА */}
            <div
              className="relative flex-1 flex items-center justify-center w-full touch-none select-none cursor-pointer"
              onPointerDown={handleTap}
              ref={duckRef}
            >
              <div className="absolute bg-yellow-500/10 w-64 h-64 rounded-full blur-[50px] pointer-events-none"></div>
              
              <img
                src={currentSkinImg}
                alt="Duck"
                className={`w-64 h-64 object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] pointer-events-none transition-transform duration-75 
                  ${isWobbling ? 'scale-90 -rotate-12' : 'scale-100 rotate-0'} 
                  ${isFlipping ? 'animate-flip-360' : ''} 
                  ${userData.auto_click ? 'animate-pulse' : ''}`
                }
              />
              
              {/* ЦИФРИ КЛІКУ */}
              {clicks.map((c) => (
                <div
                  key={c.id}
                  className="absolute text-4xl font-black text-yellow-300 pointer-events-none z-50"
                  style={{ left: c.x - 20, top: c.y - 50, animation: 'floatUp 1s ease-out forwards' }}
                >
                  +{c.val}
                </div>
              ))}
            </div>

            {/* ПАНЕЛЬ ЕНЕРГІЇ ТА РІВНЯ */}
            <div className="w-full bg-gray-800/90 backdrop-blur-md p-4 rounded-3xl border border-gray-700/50 shrink-0 shadow-xl">
              
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-blue-300">⚡ Енергія</span>
                <span className="text-xs font-bold text-blue-300">
                  {Math.floor(energy)} / {MAX_ENERGY}
                </span>
              </div>
              
              <div className="w-full bg-gray-900 rounded-full h-2 mb-4 overflow-hidden border border-gray-950">
                <div
                  className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${energyPercent}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <span className="font-black text-white">
                  Рівень {level} <span className="text-gray-500 text-xs">({levelNames[level-1]})</span>
                </span>
              </div>
              
              <div className="w-full bg-gray-900 rounded-full h-5 overflow-hidden border border-gray-950 shadow-inner relative flex items-center justify-center">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-300 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(level < 10 ? ((totalEarned - LEVEL_THRESHOLDS[level-1]) / (LEVEL_THRESHOLDS[level] - LEVEL_THRESHOLDS[level-1])) * 100 : 100, 100)}%` }}
                ></div>
                <span className="relative z-10 text-[10px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] tracking-wider">
                  {level < 10 ? `${Math.floor(totalEarned)} / ${LEVEL_THRESHOLDS[level]}` : 'MAX LEVEL'}
                </span>
              </div>
              
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* ВКЛАДКА: МАГАЗИН */}
        {/* ============================== */}
        {activeTab === 'shop' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            
            {/* ПЕРЕМИКАЧ МАГАЗИНУ */}
            <div className="flex bg-gray-800 rounded-2xl p-1 mb-6">
              <button
                onClick={() => {
                  triggerSelection();
                  setShopSubTab('business');
                }}
                className={`flex-1 py-2 font-bold rounded-xl transition-all ${
                  shopSubTab === 'business' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-500'
                }`}
              >
                Бізнес
              </button>
              <button
                onClick={() => {
                  triggerSelection();
                  setShopSubTab('skins');
                }}
                className={`flex-1 py-2 font-bold rounded-xl transition-all ${
                  shopSubTab === 'skins' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-500'
                }`}
              >
                Скіни
              </button>
            </div>
            
            {/* БІЗНЕСИ */}
            {shopSubTab === 'business' ? (
              <div className="space-y-4">
                {SHOP_ITEMS.map(item => {
                  const ownedCount = userData?.businesses?.[item.id] || 0;
                  const currentCost = Math.floor(item.baseCost * Math.pow(1.3, ownedCount));
                  const isLocked = item.reqRefs && (userData.referrals_count || 0) < item.reqRefs;
                  
                  return (
                    <div
                      key={item.id}
                      className={`bg-gray-800 border p-4 rounded-2xl flex items-center justify-between ${
                        isLocked ? 'border-red-900/50 opacity-75' : 'border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">{item.icon}</div>
                        <div>
                          <h3 className="font-bold text-lg text-white">
                            {item.name} <span className="text-xs text-gray-500 ml-1">({ownedCount} шт)</span>
                          </h3>
                          <p className="text-xs text-green-400">{item.desc}</p>
                        </div>
                      </div>
                      
                      {isLocked ? (
                        <button disabled className="font-bold py-2 px-3 text-[10px] rounded-xl bg-gray-700 text-gray-400 border border-gray-600">
                          🔒 {item.reqRefs} друзів
                        </button>
                      ) : (
                        <button
                          onClick={() => buyUpgrade(item, currentCost)}
                          className={`font-bold py-2 px-3 text-sm rounded-xl active:scale-95 ${
                            points >= currentCost ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-500'
                          }`}
                        >
                          {currentCost} 💰
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              
              /* СКІНИ */
              <div className="grid grid-cols-2 gap-4">
                <div className={`bg-gray-800 border p-4 rounded-3xl text-center flex flex-col items-center justify-between h-48 ${
                  userData.current_skin === 'default' ? 'border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-gray-700'
                }`}>
                  <img src={LEVEL_SKINS[Math.min(level - 1, 9)]} className="w-16 h-16 object-contain mb-2 drop-shadow-lg" />
                  <h3 className="font-bold text-sm text-white mb-2">Еволюція</h3>
                  <button
                    onClick={resetToEvolutionSkin}
                    className={`w-full py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${
                      userData.current_skin === 'default' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-white'
                    }`}
                  >
                    {userData.current_skin === 'default' ? 'Одягнено' : 'Одягнути'}
                  </button>
                </div>
                
                {SKINS.map(skin => {
                  const isOwned = userData.unlocked_skins?.includes(skin.id);
                  const isEquipped = userData.current_skin === skin.id;
                  
                  return (
                    <div
                      key={skin.id}
                      className={`bg-gray-800 border p-4 rounded-3xl text-center flex flex-col items-center justify-between h-48 ${
                        isEquipped ? 'border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-gray-700'
                      }`}
                    >
                      <img src={skin.img} className="w-16 h-16 object-contain mb-2 drop-shadow-lg" />
                      <h3 className="font-bold text-sm text-white mb-2">{skin.name}</h3>
                      <button
                        onClick={() => handleSkin(skin)}
                        className={`w-full py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${
                          isEquipped ? 'bg-yellow-400 text-gray-900' : isOwned ? 'bg-gray-600 text-white' : points >= skin.cost ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'
                        }`}
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

        {/* ============================== */}
        {/* ВКЛАДКА: ЗАВДАННЯ */}
        {/* ============================== */}
        {activeTab === 'tasks' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            
            {dailyAvailable && (
              <button
                onClick={() => setShowDailyModal(true)}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-black py-4 rounded-2xl mb-6 shadow-[0_0_15px_rgba(249,115,22,0.5)] animate-pulse active:scale-95"
              >
                🎁 Забрати Щоденний Бонус!
              </button>
            )}

            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">🔄 Бусти (За відео)</h2>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              {/* ЕНЕРГІЯ */}
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🔋</div>
                <h3 className="font-bold text-xs text-white">Енергія</h3>
                <p className="text-[10px] text-gray-400">{userData.ad_energy_left}/3</p>
                <button
                  disabled={userData.ad_energy_left <= 0 || isCooldown(userData.ad_energy_ready_at)}
                  onClick={() => watchAdForBoost('energy')}
                  className={`w-full text-white text-[10px] font-bold py-2 rounded-lg ${
                    userData.ad_energy_left <= 0 ? 'bg-gray-700 text-gray-500' : isCooldown(userData.ad_energy_ready_at) ? 'bg-gray-600 text-orange-300' : 'bg-blue-500 active:scale-95'
                  }`}
                >
                  {userData.ad_energy_left <= 0 ? 'Завтра' : isCooldown(userData.ad_energy_ready_at) ? `⏳ ${getRemainingMin(userData.ad_energy_ready_at)} хв` : 'Дивитись'}
                </button>
              </div>
              
              {/* x5 БУСТ */}
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🚀</div>
                <h3 className="font-bold text-xs text-white">Буст x5</h3>
                <p className="text-[10px] text-gray-400">{userData.ad_x5_left}/3</p>
                <button
                  disabled={userData.ad_x5_left <= 0 || isCooldown(userData.ad_x5_ready_at)}
                  onClick={() => watchAdForBoost('x5')}
                  className={`w-full text-white text-[10px] font-bold py-2 rounded-lg ${
                    userData.ad_x5_left <= 0 ? 'bg-gray-700 text-gray-500' : isCooldown(userData.ad_x5_ready_at) ? 'bg-gray-600 text-orange-300' : 'bg-orange-500 active:scale-95'
                  }`}
                >
                  {userData.ad_x5_left <= 0 ? 'Завтра' : isCooldown(userData.ad_x5_ready_at) ? `⏳ ${getRemainingMin(userData.ad_x5_ready_at)} хв` : 'Дивитись'}
                </button>
              </div>
              
              {/* АВТОКЛІКЕР */}
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🤖</div>
                <h3 className="font-bold text-xs text-white">Автоклікер</h3>
                <p className="text-[10px] text-gray-400">{userData.ad_autoclick_left}/3</p>
                <button
                  disabled={userData.ad_autoclick_left <= 0 || isCooldown(userData.ad_autoclick_ready_at)}
                  onClick={() => watchAdForBoost('autoclick')}
                  className={`w-full text-white text-[10px] font-bold py-2 rounded-lg ${
                    userData.ad_autoclick_left <= 0 ? 'bg-gray-700 text-gray-500' : isCooldown(userData.ad_autoclick_ready_at) ? 'bg-gray-600 text-orange-300' : 'bg-purple-500 active:scale-95'
                  }`}
                >
                  {userData.ad_autoclick_left <= 0 ? 'Завтра' : isCooldown(userData.ad_autoclick_ready_at) ? `⏳ ${getRemainingMin(userData.ad_autoclick_ready_at)} хв` : 'Дивитись'}
                </button>
              </div>
              
              {/* МАГНІТ */}
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🧲</div>
                <h3 className="font-bold text-xs text-white">+5,000 Монет</h3>
                <p className="text-[10px] text-gray-400">{userData.ad_magnet_left}/3</p>
                <button
                  disabled={userData.ad_magnet_left <= 0 || isCooldown(userData.ad_magnet_ready_at)}
                  onClick={() => watchAdForBoost('magnet')}
                  className={`w-full text-white text-[10px] font-bold py-2 rounded-lg ${
                    userData.ad_magnet_left <= 0 ? 'bg-gray-700 text-gray-500' : isCooldown(userData.ad_magnet_ready_at) ? 'bg-gray-600 text-orange-300' : 'bg-green-500 active:scale-95'
                  }`}
                >
                  {userData.ad_magnet_left <= 0 ? 'Завтра' : isCooldown(userData.ad_magnet_ready_at) ? `⏳ ${getRemainingMin(userData.ad_magnet_ready_at)} хв` : 'Дивитись'}
                </button>
              </div>
            </div>

            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">🌐 Соцмережі</h2>
            <div className="space-y-3 mb-6">
              
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">📣 Підписка Telegram</h3>
                  <p className="text-[10px] text-yellow-400">+ 25,000</p>
                </div>
                <button
                  onClick={claimTelegramTask}
                  className={`text-xs font-bold py-2 px-4 rounded-xl ${
                    userData.task_tg_claimed ? 'bg-gray-700 text-gray-500' : 'bg-blue-500 text-white active:scale-95'
                  }`}
                >
                  {userData.task_tg_claimed ? 'Виконано' : 'Підписатись'}
                </button>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">✖️ Підписка на X</h3>
                  <p className="text-[10px] text-yellow-400">+ 10,000</p>
                </div>
                <button
                  onClick={() => claimSocialTask('x', 'https://twitter.com/')}
                  className={`text-xs font-bold py-2 px-4 rounded-xl ${
                    userData.task_x_claimed ? 'bg-gray-700 text-gray-500' : 'bg-gray-600 text-white active:scale-95'
                  }`}
                >
                  {userData.task_x_claimed ? 'Виконано' : 'Перейти'}
                </button>
              </div>
              
            </div>
            
            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">🏆 Досягнення</h2>
            <div className="space-y-2 mb-6">
              {[
                { id: 'first_10k', name: 'Назбирай 10,000 монет', type: 'points', goal: 10000, reward: 5000 },
                { id: 'lvl3', name: 'Досягни 3 рівня', type: 'level', goal: 3, reward: 25000 },
                { id: 'ref_3', name: 'Запроси 3 друзів', type: 'refs', goal: 3, reward: 200000 },
                { id: 'ref_10', name: 'Запроси 10 друзів', type: 'refs', goal: 10, reward: 1000000 }
              ].map(ach => {
                const isDone = userData.achievements?.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className="bg-gray-800 p-3 rounded-2xl flex justify-between items-center border border-gray-700"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-white">{ach.name}</h3>
                      <p className="text-[10px] text-yellow-400">Нагорода: +{ach.reward}</p>
                    </div>
                    <button
                      onClick={() => claimAchievement(ach.id, ach.reward, ach.goal, ach.type)}
                      className={`text-xs font-bold py-2 px-3 rounded-lg ${
                        isDone ? 'bg-gray-700 text-gray-500' : 'bg-green-500 text-white active:scale-95'
                      }`}
                    >
                      {isDone ? 'Забрано' : 'Забрати'}
                    </button>
                  </div>
                );
              })}
            </div>
            
          </div>
        )}

        {/* ============================== */}
        {/* 🔥 НОВА ВКЛАДКА: ДРУЗІ 🔥 */}
        {/* ============================== */}
        {activeTab === 'friends' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">👥 Ваші Друзі</h2>

            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-center mb-6 shadow-xl">
              <p className="text-sm text-gray-300 mb-4">
                Запрошуй друзів і отримуй <span className="text-yellow-400 font-bold">+10,000</span> одразу. <br/><br/>
                Допоможи другу прокачатися: <br/>
                Досягне 3-го рівня 👉 <span className="text-yellow-400 font-bold">+50,000</span><br/>
                Досягне 5-го рівня 👉 <span className="text-yellow-400 font-bold">+250,000</span>
              </p>
              
              <button
                onClick={() => {
                  triggerHaptic('light');
                  const link = `https://t.me/${BOT_USERNAME}?start=${userData.telegram_id}`;
                  const text = `🦆 Приєднуйся до Gold Duck і отримай 10,000 монет на старті! Заробляємо разом!`;
                  tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
                }}
                className="bg-blue-600 text-white font-black py-4 px-6 rounded-xl w-full active:scale-95 transition-all flex items-center justify-center gap-2 mb-3"
              >
                <span className="text-xl">🚀</span> Запросити друга
              </button>
              
              <button
                onClick={() => {
                  triggerHaptic('light');
                  const link = `https://t.me/${BOT_USERNAME}?start=${userData.telegram_id}`;
                  navigator.clipboard.writeText(link);
                  tg.showAlert('✅ Унікальне посилання скопійовано!');
                }}
                className="text-xs text-gray-400 underline active:text-white py-2"
              >
                Скопіювати своє посилання
              </button>
            </div>

            <h3 className="font-bold text-white mb-3 ml-2">Список рефералів ({friendsList.length}):</h3>

            {friendsList.length === 0 ? (
              <div className="text-center text-gray-500 mt-4 text-sm bg-gray-800/50 p-4 rounded-2xl border border-gray-700 border-dashed">
                Ви ще нікого не запросили 😢<br/> Відправте посилання другу, щоб отримати бонус!
              </div>
            ) : (
              <div className="space-y-3 pb-6">
                {friendsList.map((friend, index) => (
                  <div key={friend.telegram_id} className="bg-gray-800 border border-gray-700 p-4 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-gray-900 px-3 py-1 text-[10px] font-black text-gray-500 rounded-bl-xl border-b border-l border-gray-700">
                      #{index + 1}
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="font-bold text-white text-base">{friend.first_name}</h4>
                        <p className="text-xs text-yellow-400">{getLeague(friend.level).name}</p>
                      </div>
                      <div className="text-right mt-3">
                        <span className="font-black text-white text-lg">{friend.total_earned} 💰</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        disabled={friend.level < 3 || friend.ref_reward_lvl3_claimed}
                        onClick={() => claimFriendReward(friend.telegram_id, 3)}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-bold shadow-md transition-all ${
                          friend.ref_reward_lvl3_claimed ? 'bg-gray-900 text-gray-600 border border-gray-800' :
                          friend.level >= 3 ? 'bg-green-500 text-white active:scale-95' : 'bg-gray-700 text-gray-500'
                        }`}
                      >
                        {friend.ref_reward_lvl3_claimed ? '✅ Забрано' : friend.level >= 3 ? '🎁 +50k (Рівень 3)' : '🔒 Потрібен 3 Рівень'}
                      </button>

                      <button
                        disabled={friend.level < 5 || friend.ref_reward_lvl5_claimed}
                        onClick={() => claimFriendReward(friend.telegram_id, 5)}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-bold shadow-md transition-all ${
                          friend.ref_reward_lvl5_claimed ? 'bg-gray-900 text-gray-600 border border-gray-800' :
                          friend.level >= 5 ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 active:scale-95' : 'bg-gray-700 text-gray-500'
                        }`}
                      >
                        {friend.ref_reward_lvl5_claimed ? '✅ Забрано' : friend.level >= 5 ? '🎁 +250k (Рівень 5)' : '🔒 Потрібен 5 Рівень'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================== */}
        {/* ВКЛАДКА: ІНФО */}
        {/* ============================== */}
        {activeTab === 'info' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">ℹ️ Інфо та Правила</h2>
            
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-sm text-gray-300 space-y-4 mb-6 shadow-xl">
              <p>
                <strong className="text-yellow-400 text-base">🦆 Мета гри:</strong> Клікай, заробляй монети, купуй бізнеси та піднімайся в лігах. Чим вищий рівень — тим більший заробіток!
              </p>
              
              <hr className="border-gray-700"/>
              
              <p>
                <strong className="text-green-400 text-base">💸 Жодних Донатів:</strong> Найголовніший донат — це ваш час! Ми не продаємо нічого за реальні гроші.
              </p>
              
              <hr className="border-gray-700"/>
              
              <p>
                <strong className="text-white text-base">🏆 Чесний рейтинг:</strong> Нагороди отримують ті, хто закріпився в ТОП-11 рейтингу на момент закінчення сезону (1-го числа о 00:00).
              </p>
              
              <hr className="border-gray-700"/>
              
              <p>
                <strong className="text-blue-400 text-base">🛡️ Сквади (Команди):</strong> Об'єднуйся з друзями! Якщо ваш сквад перемагає, 50% нагороди отримує творець скваду, а інші 50% діляться між найактивнішими учасниками.
              </p>
              
              <hr className="border-gray-700"/>
              
              <p>
                <strong className="text-orange-400 text-base">💰 Призовий фонд:</strong> Ми віддаємо 15% від усього доходу з реклами щомісяця реальним гравцям.
              </p>
            </div>
            
            {String(user.id) === ADMIN_TELEGRAM_ID && (
              <div className="bg-red-900/50 border-2 border-red-500 p-5 rounded-3xl mb-6">
                <h3 className="text-white font-bold mb-2 text-center">Меню Адміністратора</h3>
                <button
                  onClick={endSeasonAdmin}
                  className="bg-red-600 text-white font-black py-4 rounded-xl w-full active:scale-95 transition-all"
                >
                  🛑 ТЕСТОВЕ ЗАВЕРШЕННЯ СЕЗОНУ
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* НИЖНЯ ПАНЕЛЬ НАВІГАЦІЇ (5 КНОПОК) */}
      {/* ========================================== */}

      <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 grid grid-cols-5 px-1 pb-safe z-40">
        
        <button
          onClick={() => {
            triggerSelection();
            setActiveTab('tap');
          }}
          className={`flex flex-col items-center justify-center transition-colors ${
            activeTab === 'tap' ? 'text-yellow-400' : 'text-gray-500'
          }`}
        >
          <span className="text-2xl mb-1">🦆</span>
          <span className="text-[9px] font-bold uppercase">Грай</span>
        </button>
        
        <button
          onClick={() => {
            triggerSelection();
            setActiveTab('shop');
          }}
          className={`flex flex-col items-center justify-center transition-colors ${
            activeTab === 'shop' ? 'text-yellow-400' : 'text-gray-500'
          }`}
        >
          <span className="text-2xl mb-1">🛒</span>
          <span className="text-[9px] font-bold uppercase">Магазин</span>
        </button>
        
        <button
          onClick={() => {
            triggerSelection();
            setActiveTab('tasks');
          }}
          className={`flex flex-col items-center justify-center transition-colors ${
            activeTab === 'tasks' ? 'text-yellow-400' : 'text-gray-500'
          }`}
        >
          <span className="text-2xl mb-1">🎯</span>
          <span className="text-[9px] font-bold uppercase">Завдання</span>
        </button>

        <button
          onClick={() => {
            triggerSelection();
            setActiveTab('friends');
          }}
          className={`flex flex-col items-center justify-center transition-colors ${
            activeTab === 'friends' ? 'text-yellow-400' : 'text-gray-500'
          }`}
        >
          <span className="text-2xl mb-1">👥</span>
          <span className="text-[9px] font-bold uppercase">Друзі</span>
        </button>
        
        <button
          onClick={() => {
            triggerSelection();
            setActiveTab('info');
          }}
          className={`flex flex-col items-center justify-center transition-colors ${
            activeTab === 'info' ? 'text-yellow-400' : 'text-gray-500'
          }`}
        >
          <span className="text-2xl mb-1">ℹ️</span>
          <span className="text-[9px] font-bold uppercase">Інфо</span>
        </button>

      </div>

      {/* ========================================== */}
      {/* МОДАЛЬНІ ВІКНА */}
      {/* ========================================== */}

      {/* 1. ЛІДЕРБОРД */}
      {showLeaderboard && (
        <div className="absolute inset-0 z-[80] bg-gray-950/95 flex flex-col p-4 animate-fade-in">
          <div className="flex justify-between items-center mb-6 mt-4">
            <h2 className="text-2xl font-black text-yellow-400">🏆 Лідерборд</h2>
            <button
              onClick={() => setShowLeaderboard(false)}
              className="bg-gray-800 text-gray-400 rounded-full w-8 h-8 flex items-center justify-center font-bold active:scale-95"
            >
              ✕
            </button>
          </div>
          
          <div className="flex bg-gray-800 rounded-xl p-1 mb-4 shrink-0">
            <button
              onClick={() => setLeaderboardTab('players')}
              className={`flex-1 py-2 font-bold rounded-lg transition-all ${
                leaderboardTab === 'players' ? 'bg-gray-700 text-white shadow' : 'text-gray-500'
              }`}
            >
              Гравці
            </button>
            <button
              onClick={() => setLeaderboardTab('squads')}
              className={`flex-1 py-2 font-bold rounded-lg transition-all ${
                leaderboardTab === 'squads' ? 'bg-gray-700 text-white shadow' : 'text-gray-500'
              }`}
            >
              Сквади
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pb-4">
            {leaderboardTab === 'players' ? (
              leadersData.players.map((p, i) => (
                <div
                  key={p.telegram_id}
                  className={`flex items-center justify-between p-3 rounded-2xl ${
                    p.telegram_id === String(user?.id) ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-black text-gray-500 w-6 text-center">{i + 1}</span>
                    <div>
                      <h3 className="font-bold text-white text-sm">{p.first_name}</h3>
                      <p className="text-[10px] text-yellow-400">{getLeague(p.level).name}</p>
                    </div>
                  </div>
                  <span className="font-black text-white">{p.total_earned} 💰</span>
                </div>
              ))
            ) : (
              leadersData.squads.map((s, i) => (
                <div
                  key={s.username}
                  className="flex items-center justify-between p-3 rounded-2xl bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-black text-gray-500 w-6 text-center">{i + 1}</span>
                    <div>
                      <h3 className="font-bold text-white text-sm">{s.name}</h3>
                      <p className="text-[10px] text-blue-400">{s.members_count} учасників</p>
                    </div>
                  </div>
                  <span className="font-black text-yellow-400">{s.total_points} 🏆</span>
                </div>
              ))
            )}
          </div>

          {currentUserRankData && leaderboardTab === 'players' && (
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-4 rounded-2xl mt-2 shrink-0 flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <span className="font-black text-white w-6 text-center">{currentUserRankData.rank || '-'}</span>
                <div>
                  <h3 className="font-bold text-white text-sm">Твоє місце</h3>
                  <p className="text-[10px] text-yellow-200">{getLeague(currentUserRankData.level).name}</p>
                </div>
              </div>
              <span className="font-black text-white">{currentUserRankData.total_earned} 💰</span>
            </div>
          )}
        </div>
      )}

      {/* 2. СКВАДИ */}
      {showSquadModal && (
        <div className="absolute inset-0 z-[90] bg-gray-950/95 flex flex-col p-6 items-center justify-center animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => setShowSquadModal(false)}
              className="absolute top-4 right-4 bg-gray-800 text-gray-400 rounded-full w-8 h-8 flex items-center justify-center font-bold"
            >
              ✕
            </button>
            <div className="text-6xl text-center mb-4">🛡️</div>
            <h2 className="text-2xl font-black text-white mb-2 text-center">Вступити в Сквад</h2>
            <p className="text-xs text-gray-400 text-center mb-6">
              Введи @username скваду або створи новий, просто ввівши назву.
            </p>
            <input
              type="text"
              placeholder="@squad_name"
              value={squadInput}
              onChange={(e) => setSquadInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white mb-4 outline-none focus:border-yellow-500"
            />
            <button
              onClick={submitSquad}
              className="bg-blue-600 text-white font-bold py-3 rounded-xl w-full active:scale-95 transition-all"
            >
              Приєднатися
            </button>
          </div>
        </div>
      )}

      {/* 3. НАЛАШТУВАННЯ */}
      {showSettings && (
        <div className="absolute inset-0 z-[90] bg-gray-950/95 flex flex-col p-6 items-center justify-center animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 bg-gray-800 text-gray-400 rounded-full w-8 h-8 flex items-center justify-center font-bold"
            >
              ✕
            </button>
            <h2 className="text-2xl font-black text-white mb-6 text-center">⚙️ Налаштування</h2>
            
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex justify-between items-center mb-6">
              <span className="font-bold text-white">Вібрація (Haptic)</span>
              <button
                onClick={toggleHaptic}
                className={`w-12 h-6 rounded-full relative transition-colors ${hapticEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${hapticEnabled ? 'left-6.5 right-0.5' : 'left-0.5'}`}></div>
              </button>
            </div>
            
            <button
              onClick={resetProgress}
              className="bg-red-900/30 border border-red-500/50 text-red-500 font-bold py-3 rounded-xl w-full active:scale-95 transition-all"
            >
              ⚠️ Скинути прогрес
            </button>
          </div>
        </div>
      )}

      {/* 4. ЩОДЕННИЙ БОНУС */}
      {showDailyModal && (
        <div className="absolute inset-0 z-50 bg-gray-950/95 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-md text-center">
          <div className="text-7xl mb-6 animate-bounce">🎁</div>
          <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest mb-4">Щоденний бонус!</h2>
          <button
            onClick={claimDaily}
            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-black text-xl py-4 px-10 rounded-2xl w-full active:scale-95"
          >
            Забрати нагороду!
          </button>
        </div>
      )}

      {/* 5. НОВИЙ РІВЕНЬ */}
      {showLevelUp && justReachedLevel && (
        <div className="absolute inset-0 z-[70] bg-gray-950/90 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-lg text-center">
          <div className="text-8xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2">Новий Рівень!</h2>
          <p className="text-2xl text-yellow-400 font-bold mb-8">
            Ти тепер <span className="uppercase text-3xl block mt-2">{levelNames[justReachedLevel - 1]}</span>
          </p>
          <button
            onClick={() => setShowLevelUp(false)}
            className="bg-yellow-500 text-gray-900 font-black text-xl py-4 px-12 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.5)] active:scale-95 transition-all w-full"
          >
            Продовжити!
          </button>
        </div>
      )}

      {/* ========================================== */}
      {/* CSS-Анімації */}
      {/* ========================================== */}
      <style>{`
        @keyframes floatUp { 
          0% { opacity: 1; transform: translateY(0) scale(1); } 
          100% { opacity: 0; transform: translateY(-100px) scale(1.5); } 
        } 
        
        @keyframes fade-in { 
          from { opacity: 0; transform: translateY(20px); } 
          to { opacity: 1; transform: translateY(0); } 
        } 
        
        @keyframes flip-360 {
          0% { transform: rotateY(0deg) scale(1); }
          50% { transform: rotateY(180deg) scale(1.3); }
          100% { transform: rotateY(360deg) scale(1); }
        }

        .animate-flip-360 { 
          animation: flip-360 1s ease-in-out !important; 
        }
        
        .animate-fade-in { 
          animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; 
        } 
        
        .pb-safe { 
          padding-bottom: env(safe-area-inset-bottom); 
        }
      `}</style>
    </div>
  );
}

export default App;