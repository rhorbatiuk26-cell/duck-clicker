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
  0, 50000, 500000, 2500000, 10000000, 
  50000000, 250000000, 1000000000, 10000000000, 100000000000
];

const MAX_ENERGY = 2000;

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

const SKINS = [
  { id: 'cool', nameKey: 'skin_cool', img: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f916.svg', cost: 5000000 },
  { id: 'rich', nameKey: 'skin_rich', img: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f911.svg', cost: 10000000 },
];

const SHOP_ITEMS = [
  { id: 1, nameKey: "item1_name", baseCost: 2500, income: 300, icon: "🍞" },
  { id: 2, nameKey: "item2_name", baseCost: 15000, income: 1500, icon: "🧢" },
  { id: 3, nameKey: "item3_name", baseCost: 75000, income: 6000, icon: "🎸" },
  { id: 4, nameKey: "item4_name", baseCost: 300000, income: 20000, icon: "🌮" },
  { id: 5, nameKey: "item5_name", baseCost: 1500000, income: 85000, icon: "💻" },
  { id: 6, nameKey: "item6_name", baseCost: 10000000, income: 450000, icon: "🏦" },
  { id: 7, nameKey: "item7_name", baseCost: 50000000, income: 2000000, icon: "🤖" },
  { id: 8, nameKey: "item8_name", baseCost: 250000000, income: 7500000, icon: "🚀" },
  { id: 9, nameKey: "item9_name", baseCost: 1000000000, income: 30000000, icon: "📈", reqRefs: 3 },
  { id: 10, nameKey: "item10_name", baseCost: 5000000000, income: 150000000, icon: "📺", reqRefs: 7 },
];

// ==========================================
// СЛОВНИК (ЛОКАЛІЗАЦІЯ)
// ==========================================
const translations = {
  en: {
    hello: "Hello",
    balance: "Balance",
    per_hour: "/hour",
    join_squad: "Join Squad",
    top: "Top",
    energy: "Energy",
    level: "Level",
    max_level: "MAX LEVEL",
    tab_play: "Play",
    tab_shop: "Shop",
    tab_tasks: "Tasks",
    tab_friends: "Friends",
    tab_info: "Info",
    
    shop_business: "Business",
    shop_skins: "Skins",
    pcs: "pcs",
    friends_req: "friends req.",
    equipped: "Equipped",
    equip: "Equip",
    evolution: "Evolution",
    skin_cool: "Cyborg Duck",
    skin_rich: "Golden Duck",

    item1_name: "Breadcrumbs",
    item2_name: "Old Cap",
    item3_name: "Tramp's Guitar",
    item4_name: "Shawarma Kiosk",
    item5_name: "Crypto Farm",
    item6_name: "Bank Network",
    item7_name: "Duck AI",
    item8_name: "Mars Mission",
    item9_name: "Crypto Exchange",
    item10_name: "TV Channel",

    daily_bonus: "🎁 Claim Daily Bonus!",
    boosts: "🔄 Video Boosts",
    boost_energy: "Energy",
    boost_x5: "x5 Boost",
    boost_auto: "Auto-clicker",
    boost_magnet: "+5,000 Coins",
    tomorrow: "Tomorrow",
    watch: "Watch",
    min: "min",
    socials: "🌐 Socials",
    sub_tg: "📣 Telegram Sub",
    sub_x: "✖️ X (Twitter) Sub",
    done: "Done",
    go: "Go",
    achievements: "🏆 Achievements",
    claim: "Claim",
    claimed: "Claimed",
    reward: "Reward",
    ach_10k: "Collect 10,000 coins",
    ach_lvl3: "Reach Level 3",
    ach_ref3: "Invite 3 friends",
    ach_ref10: "Invite 10 friends",

    friends_title: "👥 Your Friends",
    friends_desc_1: "Invite friends and get ",
    friends_desc_2: " immediately.",
    friends_desc_3: "Help your friend level up:",
    friends_desc_4: "Reaches Level 3 👉 ",
    friends_desc_5: "Reaches Level 5 👉 ",
    invite_btn: "🚀 Invite a Friend",
    copy_link: "Copy your link",
    friends_list: "Referrals list",
    no_friends: "You haven't invited anyone yet 😢\nSend a link to a friend to get a bonus!",
    req_lvl: "Req. Lvl",

    info_title: "ℹ️ Info & Rules",
    info_goal_title: "🦆 Game Goal:",
    info_goal_desc: "Tap, earn coins, buy businesses, and climb the leagues. Higher level = more earnings!",
    info_donate_title: "💸 No Donations:",
    info_donate_desc: "Your main resource is your time! We don't sell anything for real money.",
    info_fair_title: "🏆 Fair Ranking:",
    info_fair_desc: "On the 1st of every month, we record the top players and reset coins (but skins and friends stay forever).",
    info_pool_title: "💰 Prize Pool (20% of revenue):",
    info_pool_desc: "We give exactly 20% of all ad revenue every month!\n• 10% — shared among TOP-11 players.\n• 10% — goes to the TOP-1 Squad (50% to creator, 50% to top 5 players).",

    onb_1_title: "Welcome to Gold Duck!",
    onb_1_desc: "Not just a clicker. A fair game where we give 20% of revenue to top players and squads monthly.",
    onb_2_title: "No Donations!",
    onb_2_desc: "Your time is the currency! You pay nothing but have a chance to win real prizes.",
    onb_3_title: "Passive Income",
    onb_3_desc: "Spend coins on businesses. The duck works while you are offline (up to 3 hours).",
    onb_4_title: "Squads (Teams)",
    onb_4_desc: "Team up with friends! If your squad wins, all top members share a huge bonus.",
    onb_next: "Next ➔",
    onb_start: "Start Playing! 🚀",

    lvl_names: ["Tramp", "Rookie", "Seeker", "Hooligan", "Businessman", "Boss", "Tycoon", "Oligarch", "Deity", "Creator"],
    league_1: "Bronze League 🥉",
    league_2: "Silver League 🥈",
    league_3: "Gold League 🏆",
    league_4: "Diamond League 💎"
  },
  uk: {
    hello: "Привіт",
    balance: "Баланс",
    per_hour: "/год",
    join_squad: "Вступити в Сквад",
    top: "Топ",
    energy: "Енергія",
    level: "Рівень",
    max_level: "МАКС РІВЕНЬ",
    tab_play: "Грай",
    tab_shop: "Магазин",
    tab_tasks: "Завдання",
    tab_friends: "Друзі",
    tab_info: "Інфо",
    
    shop_business: "Бізнес",
    shop_skins: "Скіни",
    pcs: "шт",
    friends_req: "друзів",
    equipped: "Одягнено",
    equip: "Одягнути",
    evolution: "Еволюція",
    skin_cool: "Качка-Кіборг",
    skin_rich: "Золота Качка",

    item1_name: "Крихти Хліба",
    item2_name: "Стара Кепка",
    item3_name: "Гітара Бродяги",
    item4_name: "Кіоск з Шаурмою",
    item5_name: "Крипто-Ферма",
    item6_name: "Мережа Банків",
    item7_name: "Качиний ШІ",
    item8_name: "Місія на Марс",
    item9_name: "Крипто-Біржа",
    item10_name: "Телеканал",

    daily_bonus: "🎁 Забрати Щоденний Бонус!",
    boosts: "🔄 Бусти (За відео)",
    boost_energy: "Енергія",
    boost_x5: "Буст x5",
    boost_auto: "Автоклікер",
    boost_magnet: "+5,000 Монет",
    tomorrow: "Завтра",
    watch: "Дивитись",
    min: "хв",
    socials: "🌐 Соцмережі",
    sub_tg: "📣 Підписка Telegram",
    sub_x: "✖️ Підписка на X",
    done: "Виконано",
    go: "Перейти",
    achievements: "🏆 Досягнення",
    claim: "Забрати",
    claimed: "Забрано",
    reward: "Нагорода",
    ach_10k: "Назбирай 10,000 монет",
    ach_lvl3: "Досягни 3 рівня",
    ach_ref3: "Запроси 3 друзів",
    ach_ref10: "Запроси 10 друзів",

    friends_title: "👥 Ваші Друзі",
    friends_desc_1: "Запрошуй друзів і отримуй ",
    friends_desc_2: " одразу.",
    friends_desc_3: "Допоможи другу прокачатися:",
    friends_desc_4: "Досягне 3-го рівня 👉 ",
    friends_desc_5: "Досягне 5-го рівня 👉 ",
    invite_btn: "🚀 Запросити друга",
    copy_link: "Скопіювати своє посилання",
    friends_list: "Список рефералів",
    no_friends: "Ви ще нікого не запросили 😢\nВідправте посилання другу, щоб отримати бонус!",
    req_lvl: "Потрібен Рівень",

    info_title: "ℹ️ Інфо та Правила",
    info_goal_title: "🦆 Мета гри:",
    info_goal_desc: "Клікай, заробляй монети, купуй бізнеси та піднімайся в лігах. Чим вищий рівень — тим більший заробіток!",
    info_donate_title: "💸 Жодних Донатів:",
    info_donate_desc: "Найголовніший донат — це ваш час! Ми не продаємо нічого за реальні гроші.",
    info_fair_title: "🏆 Чесний рейтинг:",
    info_fair_desc: "Кожного 1-го числа ми фіксуємо найкращих гравців та обнуляємо монети (але скіни та друзі залишаються назавжди).",
    info_pool_title: "💰 Призовий фонд (20% від доходу):",
    info_pool_desc: "Ми віддаємо рівно 20% від доходу з реклами щомісяця!\n• 10% — ділять між собою ТОП-11 гравців.\n• 10% — забирає ТОП-1 Сквад (50% творцю, 50% активним учасникам).",

    onb_1_title: "Привіт в Gold Duck!",
    onb_1_desc: "Це чесна гра, де ми віддаємо 20% доходу гравцям та сквадам наприкінці сезону.",
    onb_2_title: "Жодних Донатів!",
    onb_2_desc: "Найголовніший донат — це твій час! Ти не платиш нічого, але маєш шанс виграти призи.",
    onb_3_title: "Пасивний дохід",
    onb_3_desc: "Зароблені монети витрачай на бізнеси. Качка буде працювати навіть коли ти офлайн (до 3 годин).",
    onb_4_title: "Сквади (Команди)",
    onb_4_desc: "Об'єднуйся в команди з друзями! Якщо ваш сквад переможе, всі отримають великий бонус.",
    onb_next: "Далі ➔",
    onb_start: "Почати Гру! 🚀",

    lvl_names: ["Бродяга", "Новачок", "Шукач", "Хуліган", "Бізнесмен", "Бос", "Магнат", "Олігарх", "Божество", "Творець"],
    league_1: "Бронзова Ліга 🥉",
    league_2: "Срібна Ліга 🥈",
    league_3: "Золота Ліга 🏆",
    league_4: "Діамантова Ліга 💎"
  },
  ru: {
    hello: "Привет",
    balance: "Баланс",
    per_hour: "/час",
    join_squad: "Вступить в Сквад",
    top: "Топ",
    energy: "Энергия",
    level: "Уровень",
    max_level: "МАКС УРОВЕНЬ",
    tab_play: "Играть",
    tab_shop: "Магазин",
    tab_tasks: "Задания",
    tab_friends: "Друзья",
    tab_info: "Инфо",
    
    shop_business: "Бизнес",
    shop_skins: "Скины",
    pcs: "шт",
    friends_req: "друзей",
    equipped: "Надето",
    equip: "Надеть",
    evolution: "Эволюция",
    skin_cool: "Утка-Киборг",
    skin_rich: "Золотая Утка",

    item1_name: "Крошки Хлеба",
    item2_name: "Старая Кепка",
    item3_name: "Гитара Бродяги",
    item4_name: "Киоск с Шаурмой",
    item5_name: "Крипто-Ферма",
    item6_name: "Сеть Банков",
    item7_name: "Утиный ИИ",
    item8_name: "Миссия на Марс",
    item9_name: "Крипто-Биржа",
    item10_name: "Телеканал",

    daily_bonus: "🎁 Забрать Ежедневный Бонус!",
    boosts: "🔄 Бусты (За видео)",
    boost_energy: "Энергия",
    boost_x5: "Буст x5",
    boost_auto: "Автокликер",
    boost_magnet: "+5,000 Монет",
    tomorrow: "Завтра",
    watch: "Смотреть",
    min: "мин",
    socials: "🌐 Соцсети",
    sub_tg: "📣 Подписка Telegram",
    sub_x: "✖️ Подписка на X",
    done: "Выполнено",
    go: "Перейти",
    achievements: "🏆 Достижения",
    claim: "Забрать",
    claimed: "Забрано",
    reward: "Награда",
    ach_10k: "Накопи 10,000 монет",
    ach_lvl3: "Достигни 3 уровня",
    ach_ref3: "Пригласи 3 друзей",
    ach_ref10: "Пригласи 10 друзей",

    friends_title: "👥 Ваши Друзья",
    friends_desc_1: "Приглашай друзей и получай ",
    friends_desc_2: " сразу.",
    friends_desc_3: "Помоги другу прокачаться:",
    friends_desc_4: "Достигнет 3-го уровня 👉 ",
    friends_desc_5: "Достигнет 5-го уровня 👉 ",
    invite_btn: "🚀 Пригласить друга",
    copy_link: "Скопировать свою ссылку",
    friends_list: "Список рефералов",
    no_friends: "Вы еще никого не пригласили 😢\nОтправьте ссылку другу, чтобы получить бонус!",
    req_lvl: "Нужен Ур.",

    info_title: "ℹ️ Инфо и Правила",
    info_goal_title: "🦆 Цель игры:",
    info_goal_desc: "Кликай, зарабатывай монеты, покупай бизнесы. Чем выше уровень — тем больше заработок!",
    info_donate_title: "💸 Никаких Донатов:",
    info_donate_desc: "Главный донат — это ваше время! Мы ничего не продаем за реальные деньги.",
    info_fair_title: "🏆 Честный рейтинг:",
    info_fair_desc: "Каждого 1-го числа мы фиксируем лучших игроков и обнуляем монеты (но скины и друзья остаются).",
    info_pool_title: "💰 Призовой фонд (20% от дохода):",
    info_pool_desc: "Мы отдаем ровно 20% от дохода с рекламы каждый месяц!\n• 10% — делят ТОП-11 игроков.\n• 10% — забирает ТОП-1 Сквад (50% создателю, 50% активным участникам).",

    onb_1_title: "Привет в Gold Duck!",
    onb_1_desc: "Это честная игра, где мы отдаем 20% дохода игрокам и сквадам в конце сезона.",
    onb_2_title: "Никаких Донатов!",
    onb_2_desc: "Твое время — главная валюта! Ты не платишь ничего, но можешь выиграть реальные призы.",
    onb_3_title: "Пассивный доход",
    onb_3_desc: "Покупай бизнесы. Утка работает, даже когда ты оффлайн (до 3 часов).",
    onb_4_title: "Сквады (Команды)",
    onb_4_desc: "Объединяйся в команды с друзьями! Если ваш сквад победит, все получат большой бонус.",
    onb_next: "Далее ➔",
    onb_start: "Начать Игру! 🚀",

    lvl_names: ["Бродяга", "Новичок", "Искатель", "Хулиган", "Бизнесмен", "Босс", "Магнат", "Олигарх", "Божество", "Творец"],
    league_1: "Бронзовая Лига 🥉",
    league_2: "Серебряная Лига 🥈",
    league_3: "Золотая Лига 🏆",
    league_4: "Бриллиантовая Лига 💎"
  }
};

// ==========================================
// ГОЛОВНИЙ КОМПОНЕНТ
// ==========================================

function App() {
  const tg = window.Telegram.WebApp;
  const user = tg.initDataUnsafe?.user;
  const startParam = tg.initDataUnsafe?.start_param;

  // Визначення мови гравця (Fallback: Англійська)
  const userLang = user?.language_code || 'en';
  const currentLang = translations[userLang] ? userLang : 'en';
  const t = (key) => translations[currentLang][key] || key;

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

  const duckRef = useRef(null);
  const pendingTaps = useRef(0);
  const tapTimeout = useRef(null);

  // Хелпери для ліги
  const getLeagueData = (lvl) => {
    if (lvl <= 3) return { name: t('league_1'), color: "text-orange-400" };
    if (lvl <= 6) return { name: t('league_2'), color: "text-gray-300" };
    if (lvl <= 9) return { name: t('league_3'), color: "text-yellow-400" };
    return { name: t('league_4'), color: "text-cyan-400" };
  };

  // ==========================================
  // ВІБРАЦІЯ
  // ==========================================
  const triggerHaptic = (type) => {
    try {
      if (hapticEnabled && tg?.HapticFeedback?.impactOccurred) {
        tg.HapticFeedback.impactOccurred(type);
      }
    } catch (e) {}
  };

  const triggerNotification = (type) => {
    try {
      if (hapticEnabled && tg?.HapticFeedback?.notificationOccurred) {
        tg.HapticFeedback.notificationOccurred(type);
      }
    } catch (e) {}
  };

  const triggerSelection = () => {
    try {
      if (hapticEnabled && tg?.HapticFeedback?.selectionChanged) {
        tg.HapticFeedback.selectionChanged();
      }
    } catch (e) {}
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
          first_name: user.first_name || 'Player',
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
    
    if (userData?.auto_click) addedPerSec += (7 * level);
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
    if (!userData || showLeaderboard || showDailyModal || showLevelUp || showSquadModal || showOnboarding || showSettings) return;
    if (energy <= 0) return;

    triggerHaptic('medium');
    setIsWobbling(true);
    setTimeout(() => setIsWobbling(false), 150);

    const tapValue = userData.active_boost ? level * userData.boost_multiplier : level;

    setTotalEarned(prev => {
      const newTotal = prev + tapValue;
      let calcLevel = 1;
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (newTotal >= LEVEL_THRESHOLDS[i]) { calcLevel = i + 1; break; }
      }
      if (calcLevel > 10) calcLevel = 10;
      
      setLevel(currentLevel => {
        if (calcLevel > currentLevel) { triggerLevelUp(calcLevel); return calcLevel; }
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
        } catch (err) { console.error(err); }
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
            
            if (boostType === 'energy') setEnergy(MAX_ENERGY);
            tg.showAlert("Boost Activated! 🚀");
          } catch (err) { 
            tg.showAlert("Error"); 
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
              if (Number(res.data.user.total_earned) >= LEVEL_THRESHOLDS[i]) { calcLvl = i + 1; break; }
            }
            if (calcLvl > level) { triggerLevelUp(calcLvl); setLevel(calcLvl); }
            tg.showAlert("No ads right now. Bonus +1500 coins! 💰");
          } catch (err) { 
            tg.showAlert("Cooldown active"); 
          }
        });
    } else {
      tg.showAlert("Ads error.");
    }
  };

  // ==========================================
  // ІНШІ ФУНКЦІЇ ТА ДРУЗІ
  // ==========================================
  const buyUpgrade = async (item, currentCost) => {
    if (points < currentCost) { triggerNotification('error'); return; }
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
      tg.showAlert("Error"); 
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
    } catch (err) {}
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
    } catch (err) {}
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
      tg.showAlert(`Success! @${res.data.squad.username}`);
    } catch (err) { 
      tg.showAlert("Error"); 
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
      tg.showAlert(`+${res.data.reward} 💰`);
      
      setFriendsList(prev => prev.map(f => {
        if (f.telegram_id === friendId) {
          if (reqLevel === 3) return { ...f, ref_reward_lvl3_claimed: true };
          if (reqLevel === 5) return { ...f, ref_reward_lvl5_claimed: true };
        }
        return f;
      }));
    } catch (err) {
      tg.showAlert('Error');
    }
  };

  const claimAchievement = async (id, reward, goal, type = 'points') => {
    if (userData.achievements?.includes(id)) return;
    if (type === 'points' && totalEarned < goal) return;
    if (type === 'level' && level < goal) return;
    if (type === 'refs' && (userData.referrals_count || 0) < goal) return;

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
      tg.showAlert(`+${reward} 💰`);
    } catch (err) {}
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
        tg.showAlert(`+${response.data.reward} 💰`);
      } catch (err) {}
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
        tg.showAlert("+25,000 💰");
      } catch (err) {}
    }, 5000);
  };

  const resetProgress = async () => {
    tg.showConfirm("Restart from Zero?", async (agreed) => {
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
        } catch (err) {}
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
    } catch (err) {}
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
        Loading...
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center select-none text-white z-[100] relative">
        <div className="flex flex-col items-center justify-center bg-gray-900 border border-gray-700 w-full max-w-sm rounded-3xl p-8 space-y-6 shadow-2xl animate-fade-in mb-10">
          
          {onboardingStep === 0 && (
            <>
              <div className="text-7xl">🦆</div>
              <h2 className="text-2xl font-black text-yellow-400 leading-tight">{t('onb_1_title')}</h2>
              <p className="text-gray-300 text-sm leading-relaxed px-2">{t('onb_1_desc')}</p>
            </>
          )}
          {onboardingStep === 1 && (
            <>
              <div className="text-7xl">💸</div>
              <h2 className="text-2xl font-black text-green-400 leading-tight">{t('onb_2_title')}</h2>
              <p className="text-gray-300 text-sm leading-relaxed px-2">{t('onb_2_desc')}</p>
            </>
          )}
          {onboardingStep === 2 && (
            <>
              <div className="text-7xl">🛒</div>
              <h2 className="text-2xl font-black text-yellow-400 leading-tight">{t('onb_3_title')}</h2>
              <p className="text-gray-300 text-sm leading-relaxed px-2">{t('onb_3_desc')}</p>
            </>
          )}
          {onboardingStep === 3 && (
            <>
              <div className="text-7xl">🛡️</div>
              <h2 className="text-2xl font-black text-yellow-400 leading-tight">{t('onb_4_title')}</h2>
              <p className="text-gray-300 text-sm leading-relaxed px-2">{t('onb_4_desc')}</p>
            </>
          )}

        </div>
        <button 
          onClick={() => { 
            triggerHaptic('light'); 
            if (onboardingStep < 3) setOnboardingStep(prev => prev + 1); 
            else finishOnboarding(); 
          }} 
          className="bg-yellow-500 text-gray-900 font-black text-lg py-4 w-[90%] rounded-2xl active:scale-95 absolute bottom-8 shadow-xl"
        >
          {onboardingStep < 3 ? t('onb_next') : t('onb_start')}
        </button>
      </div>
    );
  }

  const currentSkinImg = userData?.current_skin === 'default'
    ? LEVEL_SKINS[Math.min(level - 1, 9)]
    : SKINS.find(s => s.id === userData?.current_skin)?.img || LEVEL_SKINS[Math.min(level - 1, 9)];
    
  const league = getLeagueData(level);
  const energyPercent = (energy / MAX_ENERGY) * 100;
  const levelNamesList = t('lvl_names');
  
  const bgColors = [
    "from-gray-900 to-gray-950", "from-slate-900 to-slate-950", "from-blue-900 to-gray-950", 
    "from-indigo-900 to-gray-950", "from-purple-900 to-gray-950", "from-fuchsia-900 to-gray-950", 
    "from-rose-900 to-gray-950", "from-red-900 to-gray-950", "from-yellow-900 to-gray-950", 
    "from-yellow-600 to-red-900"
  ];

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-b ${bgColors[Math.min(level-1, 9)]} select-none overflow-hidden text-white transition-colors duration-1000`}>
      
      {offlineEarned > 0 && (
        <div className="absolute top-20 left-4 right-4 bg-green-500 text-white p-4 rounded-2xl shadow-2xl z-50 text-center animate-fade-in border-2 border-green-400">
          <p className="font-black text-xl mb-1">Offline Bonus!</p>
          <p className="font-bold text-lg">+ {offlineEarned} 💰</p>
        </div>
      )}
      
      {/* HEADER */}
      <div className="text-center w-full p-4 z-10 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div className="text-left flex flex-col items-start">
            <h1 className="text-sm font-bold text-gray-300">{t('hello')}, {userData.first_name}!</h1>
            <span className={`text-[10px] font-black uppercase tracking-widest ${league.color}`}>
              {league.name}
            </span>
            
            {userData.squad_id ? (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-md border border-gray-600">🛡️ {userData.squad_id}</span>
              </div>
            ) : (
              <button 
                onClick={() => setShowSquadModal(true)} 
                className="text-[10px] bg-blue-600/50 px-2 py-0.5 rounded-md mt-1 active:scale-95"
              >
                {t('join_squad')}
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
              🏆 {t('top')}
            </button>
          </div>
        </div>
        
        {userData.auto_click && <div className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 animate-pulse">🤖 AUTO-CLICKER</div>}
        {userData.active_boost && <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 ml-2 animate-bounce">🔥 BOOST x5</div>}
        
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-3xl p-5 shadow-2xl border border-gray-700/50 flex flex-col items-center justify-center">
          <div className="flex justify-center items-center gap-2 text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-1">
            <span>{t('balance')}</span>
            <span className={passiveIncome > 0 ? "text-green-400" : "text-gray-500"}>
              +{passiveIncome}{t('per_hour')}
            </span>
          </div>
          <p className="text-6xl font-black text-center text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-lg leading-tight">
            {Math.floor(points)}
          </p>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative pb-[85px]">
        
        {/* ============================== TAB: PLAY ============================== */}
        {activeTab === 'tap' && (
          <div className="flex-1 flex flex-col px-4 animate-fade-in">
            <div 
              className="relative flex-1 flex items-center justify-center w-full touch-none select-none cursor-pointer" 
              onPointerDown={handleTap} 
              ref={duckRef}
            >
              <div className="absolute bg-yellow-500/10 w-64 h-64 rounded-full blur-[50px] pointer-events-none"></div>
              <img 
                src={currentSkinImg} 
                alt="Duck" 
                className={`w-64 h-64 object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] pointer-events-none transition-transform duration-75 ${isWobbling ? 'scale-90 -rotate-12' : 'scale-100 rotate-0'} ${isFlipping ? 'animate-flip-360' : ''} ${userData.auto_click ? 'animate-pulse' : ''}`} 
              />
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

            <div className="w-full bg-gray-800/90 backdrop-blur-md p-4 rounded-3xl border border-gray-700/50 shrink-0 shadow-xl">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-blue-300">⚡ {t('energy')}</span>
                <span className="text-xs font-bold text-blue-300">{Math.floor(energy)} / {MAX_ENERGY}</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2 mb-4 overflow-hidden border border-gray-950">
                <div className="bg-blue-500 h-full transition-all duration-300 rounded-full" style={{ width: `${energyPercent}%` }}></div>
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <span className="font-black text-white">
                  {t('level')} {level} <span className="text-gray-500 text-xs">({levelNamesList[level-1]})</span>
                </span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-5 overflow-hidden border border-gray-950 shadow-inner relative flex items-center justify-center">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-300 transition-all duration-300 rounded-full" 
                  style={{ width: `${Math.min(level < 10 ? ((totalEarned - LEVEL_THRESHOLDS[level-1]) / (LEVEL_THRESHOLDS[level] - LEVEL_THRESHOLDS[level-1])) * 100 : 100, 100)}%` }}
                ></div>
                <span className="relative z-10 text-[10px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] tracking-wider">
                  {level < 10 ? `${Math.floor(totalEarned)} / ${LEVEL_THRESHOLDS[level]}` : t('max_level')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ============================== TAB: SHOP ============================== */}
        {activeTab === 'shop' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <div className="flex bg-gray-800 rounded-2xl p-1 mb-6">
              <button 
                onClick={() => {triggerSelection(); setShopSubTab('business');}} 
                className={`flex-1 py-2 font-bold rounded-xl transition-all ${shopSubTab === 'business' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-500'}`}
              >
                {t('shop_business')}
              </button>
              <button 
                onClick={() => {triggerSelection(); setShopSubTab('skins');}} 
                className={`flex-1 py-2 font-bold rounded-xl transition-all ${shopSubTab === 'skins' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-500'}`}
              >
                {t('shop_skins')}
              </button>
            </div>
            
            {shopSubTab === 'business' ? (
              <div className="space-y-4">
                {SHOP_ITEMS.map(item => {
                  const ownedCount = userData?.businesses?.[item.id] || 0;
                  const currentCost = Math.floor(item.baseCost * Math.pow(1.3, ownedCount));
                  const isLocked = item.reqRefs && (userData.referrals_count || 0) < item.reqRefs;
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`bg-gray-800 border p-4 rounded-2xl flex items-center justify-between ${isLocked ? 'border-red-900/50 opacity-75' : 'border-gray-700'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">{item.icon}</div>
                        <div>
                          <h3 className="font-bold text-lg text-white">
                            {t(item.nameKey)} <span className="text-xs text-gray-500 ml-1">({ownedCount} {t('pcs')})</span>
                          </h3>
                          <p className="text-xs text-green-400">+{item.income} {t('per_hour')}</p>
                        </div>
                      </div>
                      
                      {isLocked ? (
                        <button disabled className="font-bold py-2 px-3 text-[10px] rounded-xl bg-gray-700 text-gray-400 border border-gray-600">
                          🔒 {item.reqRefs} {t('friends_req')}
                        </button>
                      ) : (
                        <button 
                          onClick={() => buyUpgrade(item, currentCost)} 
                          className={`font-bold py-2 px-3 text-sm rounded-xl active:scale-95 ${points >= currentCost ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-500'}`}
                        >
                          {currentCost} 💰
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className={`bg-gray-800 border p-4 rounded-3xl text-center flex flex-col items-center justify-between h-48 ${userData.current_skin === 'default' ? 'border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-gray-700'}`}>
                  <img src={LEVEL_SKINS[Math.min(level - 1, 9)]} className="w-16 h-16 object-contain mb-2 drop-shadow-lg" />
                  <h3 className="font-bold text-sm text-white mb-2">{t('evolution')}</h3>
                  <button 
                    onClick={resetToEvolutionSkin} 
                    className={`w-full py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${userData.current_skin === 'default' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-white'}`}
                  >
                    {userData.current_skin === 'default' ? t('equipped') : t('equip')}
                  </button>
                </div>
                
                {SKINS.map(skin => {
                  const isOwned = userData.unlocked_skins?.includes(skin.id);
                  const isEquipped = userData.current_skin === skin.id;
                  
                  return (
                    <div 
                      key={skin.id} 
                      className={`bg-gray-800 border p-4 rounded-3xl text-center flex flex-col items-center justify-between h-48 ${isEquipped ? 'border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-gray-700'}`}
                    >
                      <img src={skin.img} className="w-16 h-16 object-contain mb-2 drop-shadow-lg" />
                      <h3 className="font-bold text-sm text-white mb-2">{t(skin.nameKey)}</h3>
                      <button 
                        onClick={() => handleSkin(skin)} 
                        className={`w-full py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${isEquipped ? 'bg-yellow-400 text-gray-900' : isOwned ? 'bg-gray-600 text-white' : points >= skin.cost ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'}`}
                      >
                        {isEquipped ? t('equipped') : isOwned ? t('equip') : `${skin.cost} 💰`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================== TAB: TASKS ============================== */}
        {activeTab === 'tasks' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            {dailyAvailable && (
              <button 
                onClick={() => setShowDailyModal(true)} 
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-black py-4 rounded-2xl mb-6 shadow-[0_0_15px_rgba(249,115,22,0.5)] animate-pulse active:scale-95"
              >
                {t('daily_bonus')}
              </button>
            )}

            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">{t('boosts')}</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🔋</div>
                <h3 className="font-bold text-xs text-white">{t('boost_energy')}</h3>
                <p className="text-[10px] text-gray-400">{userData.ad_energy_left}/3</p>
                <button 
                  disabled={userData.ad_energy_left <= 0 || isCooldown(userData.ad_energy_ready_at)} 
                  onClick={() => watchAdForBoost('energy')} 
                  className={`w-full text-white text-[10px] font-bold py-2 rounded-lg ${userData.ad_energy_left <= 0 ? 'bg-gray-700 text-gray-500' : isCooldown(userData.ad_energy_ready_at) ? 'bg-gray-600 text-orange-300' : 'bg-blue-500 active:scale-95'}`}
                >
                  {userData.ad_energy_left <= 0 ? t('tomorrow') : isCooldown(userData.ad_energy_ready_at) ? `⏳ ${getRemainingMin(userData.ad_energy_ready_at)} ${t('min')}` : t('watch')}
                </button>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🚀</div>
                <h3 className="font-bold text-xs text-white">{t('boost_x5')}</h3>
                <p className="text-[10px] text-gray-400">{userData.ad_x5_left}/3</p>
                <button 
                  disabled={userData.ad_x5_left <= 0 || isCooldown(userData.ad_x5_ready_at)} 
                  onClick={() => watchAdForBoost('x5')} 
                  className={`w-full text-white text-[10px] font-bold py-2 rounded-lg ${userData.ad_x5_left <= 0 ? 'bg-gray-700 text-gray-500' : isCooldown(userData.ad_x5_ready_at) ? 'bg-gray-600 text-orange-300' : 'bg-orange-500 active:scale-95'}`}
                >
                  {userData.ad_x5_left <= 0 ? t('tomorrow') : isCooldown(userData.ad_x5_ready_at) ? `⏳ ${getRemainingMin(userData.ad_x5_ready_at)} ${t('min')}` : t('watch')}
                </button>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🤖</div>
                <h3 className="font-bold text-xs text-white">{t('boost_auto')}</h3>
                <p className="text-[10px] text-gray-400">{userData.ad_autoclick_left}/3</p>
                <button 
                  disabled={userData.ad_autoclick_left <= 0 || isCooldown(userData.ad_autoclick_ready_at)} 
                  onClick={() => watchAdForBoost('autoclick')} 
                  className={`w-full text-white text-[10px] font-bold py-2 rounded-lg ${userData.ad_autoclick_left <= 0 ? 'bg-gray-700 text-gray-500' : isCooldown(userData.ad_autoclick_ready_at) ? 'bg-gray-600 text-orange-300' : 'bg-purple-500 active:scale-95'}`}
                >
                  {userData.ad_autoclick_left <= 0 ? t('tomorrow') : isCooldown(userData.ad_autoclick_ready_at) ? `⏳ ${getRemainingMin(userData.ad_autoclick_ready_at)} ${t('min')}` : t('watch')}
                </button>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl flex flex-col items-center text-center gap-2">
                <div className="text-2xl">🧲</div>
                <h3 className="font-bold text-xs text-white">{t('boost_magnet')}</h3>
                <p className="text-[10px] text-gray-400">{userData.ad_magnet_left}/3</p>
                <button 
                  disabled={userData.ad_magnet_left <= 0 || isCooldown(userData.ad_magnet_ready_at)} 
                  onClick={() => watchAdForBoost('magnet')} 
                  className={`w-full text-white text-[10px] font-bold py-2 rounded-lg ${userData.ad_magnet_left <= 0 ? 'bg-gray-700 text-gray-500' : isCooldown(userData.ad_magnet_ready_at) ? 'bg-gray-600 text-orange-300' : 'bg-green-500 active:scale-95'}`}
                >
                  {userData.ad_magnet_left <= 0 ? t('tomorrow') : isCooldown(userData.ad_magnet_ready_at) ? `⏳ ${getRemainingMin(userData.ad_magnet_ready_at)} ${t('min')}` : t('watch')}
                </button>
              </div>
            </div>

            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">{t('socials')}</h2>
            <div className="space-y-3 mb-6">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">{t('sub_tg')}</h3>
                  <p className="text-[10px] text-yellow-400">+ 25,000</p>
                </div>
                <button 
                  onClick={claimTelegramTask} 
                  className={`text-xs font-bold py-2 px-4 rounded-xl ${userData.task_tg_claimed ? 'bg-gray-700 text-gray-500' : 'bg-blue-500 text-white active:scale-95'}`}
                >
                  {userData.task_tg_claimed ? t('done') : t('go')}
                </button>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">{t('sub_x')}</h3>
                  <p className="text-[10px] text-yellow-400">+ 10,000</p>
                </div>
                <button 
                  onClick={() => claimSocialTask('x', 'https://twitter.com/')} 
                  className={`text-xs font-bold py-2 px-4 rounded-xl ${userData.task_x_claimed ? 'bg-gray-700 text-gray-500' : 'bg-gray-600 text-white active:scale-95'}`}
                >
                  {userData.task_x_claimed ? t('done') : t('go')}
                </button>
              </div>
            </div>
            
            <h2 className="text-lg font-black text-yellow-400 mb-2 ml-2">{t('achievements')}</h2>
            <div className="space-y-2 mb-6">
              {[
                { id: 'first_10k', nameKey: 'ach_10k', type: 'points', goal: 10000, reward: 5000 },
                { id: 'lvl3', nameKey: 'ach_lvl3', type: 'level', goal: 3, reward: 25000 },
                { id: 'ref_3', nameKey: 'ach_ref3', type: 'refs', goal: 3, reward: 200000 },
                { id: 'ref_10', nameKey: 'ach_ref10', type: 'refs', goal: 10, reward: 1000000 }
              ].map(ach => {
                const isDone = userData.achievements?.includes(ach.id);
                return (
                  <div key={ach.id} className="bg-gray-800 p-3 rounded-2xl flex justify-between items-center border border-gray-700">
                    <div>
                      <h3 className="text-sm font-bold text-white">{t(ach.nameKey)}</h3>
                      <p className="text-[10px] text-yellow-400">{t('reward')}: +{ach.reward}</p>
                    </div>
                    <button 
                      onClick={() => claimAchievement(ach.id, ach.reward, ach.goal, ach.type)} 
                      className={`text-xs font-bold py-2 px-3 rounded-lg ${isDone ? 'bg-gray-700 text-gray-500' : 'bg-green-500 text-white active:scale-95'}`}
                    >
                      {isDone ? t('claimed') : t('claim')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================== TAB: FRIENDS ============================== */}
        {activeTab === 'friends' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">{t('friends_title')}</h2>

            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-center mb-6 shadow-xl">
              <p className="text-sm text-gray-300 mb-4">
                {t('friends_desc_1')}<span className="text-yellow-400 font-bold">+10,000</span>{t('friends_desc_2')}<br/><br/>
                {t('friends_desc_3')}<br/>
                {t('friends_desc_4')}<span className="text-yellow-400 font-bold">+50,000</span><br/>
                {t('friends_desc_5')}<span className="text-yellow-400 font-bold">+250,000</span>
              </p>
              
              <button
                onClick={() => {
                  triggerHaptic('light');
                  const link = `https://t.me/${BOT_USERNAME}?start=${userData.telegram_id}`;
                  const text = `🦆 Gold Duck!`;
                  tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
                }}
                className="bg-blue-600 text-white font-black py-4 px-6 rounded-xl w-full active:scale-95 transition-all flex items-center justify-center gap-2 mb-3"
              >
                <span className="text-xl">🚀</span> {t('invite_btn')}
              </button>
              
              <button
                onClick={() => {
                  triggerHaptic('light');
                  const link = `https://t.me/${BOT_USERNAME}?start=${userData.telegram_id}`;
                  navigator.clipboard.writeText(link);
                  tg.showAlert('✅ Copied!');
                }}
                className="text-xs text-gray-400 underline active:text-white py-2"
              >
                {t('copy_link')}
              </button>
            </div>

            <h3 className="font-bold text-white mb-3 ml-2">{t('friends_list')} ({friendsList.length}):</h3>

            {friendsList.length === 0 ? (
              <div className="text-center text-gray-500 mt-4 text-sm bg-gray-800/50 p-4 rounded-2xl border border-gray-700 border-dashed">
                {t('no_friends')}
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
                        <p className="text-xs text-yellow-400">{getLeagueData(friend.level).name}</p>
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
                        {friend.ref_reward_lvl3_claimed ? `✅ ${t('claimed')}` : friend.level >= 3 ? '🎁 +50k' : `🔒 ${t('req_lvl')} 3`}
                      </button>

                      <button
                        disabled={friend.level < 5 || friend.ref_reward_lvl5_claimed}
                        onClick={() => claimFriendReward(friend.telegram_id, 5)}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-bold shadow-md transition-all ${
                          friend.ref_reward_lvl5_claimed ? 'bg-gray-900 text-gray-600 border border-gray-800' :
                          friend.level >= 5 ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 active:scale-95' : 'bg-gray-700 text-gray-500'
                        }`}
                      >
                        {friend.ref_reward_lvl5_claimed ? `✅ ${t('claimed')}` : friend.level >= 5 ? '🎁 +250k' : `🔒 ${t('req_lvl')} 5`}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================== TAB: INFO ============================== */}
        {activeTab === 'info' && (
          <div className="flex-1 flex flex-col p-4 animate-fade-in overflow-y-auto">
            <h2 className="text-2xl font-black text-yellow-400 mb-4 text-center">{t('info_title')}</h2>
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-3xl text-sm text-gray-300 space-y-4 mb-6 shadow-xl">
              <p><strong className="text-yellow-400 text-base">{t('info_goal_title')}</strong><br/>{t('info_goal_desc')}</p>
              <hr className="border-gray-700"/>
              <p><strong className="text-green-400 text-base">{t('info_donate_title')}</strong><br/>{t('info_donate_desc')}</p>
              <hr className="border-gray-700"/>
              <p><strong className="text-white text-base">{t('info_fair_title')}</strong><br/>{t('info_fair_desc')}</p>
              <hr className="border-gray-700"/>
              <p className="whitespace-pre-line"><strong className="text-orange-400 text-base">{t('info_pool_title')}</strong><br/>{t('info_pool_desc')}</p>
            </div>
            
            {String(user.id) === ADMIN_TELEGRAM_ID && (
              <div className="bg-red-900/50 border-2 border-red-500 p-5 rounded-3xl mb-6">
                <h3 className="text-white font-bold mb-2 text-center">Admin Panel</h3>
                <button 
                  onClick={endSeasonAdmin} 
                  className="bg-red-600 text-white font-black py-4 rounded-xl w-full active:scale-95 transition-all"
                >
                  🛑 END SEASON
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* BOTTOM NAVIGATION */}
      {/* ========================================== */}
      <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 grid grid-cols-5 px-1 pb-safe z-40">
        <button onClick={() => { triggerSelection(); setActiveTab('tap'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'tap' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">🦆</span><span className="text-[9px] font-bold uppercase">{t('tab_play')}</span>
        </button>
        <button onClick={() => { triggerSelection(); setActiveTab('shop'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'shop' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">🛒</span><span className="text-[9px] font-bold uppercase">{t('tab_shop')}</span>
        </button>
        <button onClick={() => { triggerSelection(); setActiveTab('tasks'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'tasks' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">🎯</span><span className="text-[9px] font-bold uppercase">{t('tab_tasks')}</span>
        </button>
        <button onClick={() => { triggerSelection(); setActiveTab('friends'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'friends' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">👥</span><span className="text-[9px] font-bold uppercase">{t('tab_friends')}</span>
        </button>
        <button onClick={() => { triggerSelection(); setActiveTab('info'); }} className={`flex flex-col items-center justify-center transition-colors ${activeTab === 'info' ? 'text-yellow-400' : 'text-gray-500'}`}>
          <span className="text-2xl mb-1">ℹ️</span><span className="text-[9px] font-bold uppercase">{t('tab_info')}</span>
        </button>
      </div>

      {/* ========================================== */}
      {/* MODALS */}
      {/* ========================================== */}
      {showLeaderboard && (
        <div className="absolute inset-0 z-[80] bg-gray-950/95 flex flex-col p-4 animate-fade-in">
          <div className="flex justify-between items-center mb-6 mt-4">
            <h2 className="text-2xl font-black text-yellow-400">🏆 Leaderboard</h2>
            <button onClick={() => setShowLeaderboard(false)} className="bg-gray-800 text-gray-400 rounded-full w-8 h-8 flex items-center justify-center font-bold active:scale-95">✕</button>
          </div>
          <div className="flex bg-gray-800 rounded-xl p-1 mb-4 shrink-0">
            <button onClick={() => setLeaderboardTab('players')} className={`flex-1 py-2 font-bold rounded-lg transition-all ${leaderboardTab === 'players' ? 'bg-gray-700 text-white shadow' : 'text-gray-500'}`}>Players</button>
            <button onClick={() => setLeaderboardTab('squads')} className={`flex-1 py-2 font-bold rounded-lg transition-all ${leaderboardTab === 'squads' ? 'bg-gray-700 text-white shadow' : 'text-gray-500'}`}>Squads</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pb-4">
            {leaderboardTab === 'players' ? (
              leadersData.players.map((p, i) => (
                <div key={p.telegram_id} className={`flex items-center justify-between p-3 rounded-2xl ${p.telegram_id === String(user?.id) ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-gray-800'}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-gray-500 w-6 text-center">{i + 1}</span>
                    <div><h3 className="font-bold text-white text-sm">{p.first_name}</h3><p className="text-[10px] text-yellow-400">{getLeagueData(p.level).name}</p></div>
                  </div>
                  <span className="font-black text-white">{p.total_earned} 💰</span>
                </div>
              ))
            ) : (
              leadersData.squads.map((s, i) => (
                <div key={s.username} className="flex items-center justify-between p-3 rounded-2xl bg-gray-800">
                  <div className="flex items-center gap-3"><span className="font-black text-gray-500 w-6 text-center">{i + 1}</span><div><h3 className="font-bold text-white text-sm">{s.name}</h3><p className="text-[10px] text-blue-400">{s.members_count} members</p></div></div>
                  <span className="font-black text-yellow-400">{s.total_points} 🏆</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showSquadModal && (
        <div className="absolute inset-0 z-[90] bg-gray-950/95 flex flex-col p-6 items-center justify-center animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowSquadModal(false)} className="absolute top-4 right-4 bg-gray-800 text-gray-400 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
            <div className="text-6xl text-center mb-4">🛡️</div>
            <h2 className="text-2xl font-black text-white mb-2 text-center">{t('join_squad')}</h2>
            <input type="text" placeholder="@squad_name" value={squadInput} onChange={(e) => setSquadInput(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white mb-4 outline-none focus:border-yellow-500" />
            <button onClick={submitSquad} className="bg-blue-600 text-white font-bold py-3 rounded-xl w-full active:scale-95 transition-all">Join</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 z-[90] bg-gray-950/95 flex flex-col p-6 items-center justify-center animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 bg-gray-800 text-gray-400 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
            <h2 className="text-2xl font-black text-white mb-6 text-center">⚙️ Settings</h2>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex justify-between items-center mb-6">
              <span className="font-bold text-white">Haptic Feedback</span>
              <button onClick={toggleHaptic} className={`w-12 h-6 rounded-full relative transition-colors ${hapticEnabled ? 'bg-green-500' : 'bg-gray-600'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${hapticEnabled ? 'left-6.5 right-0.5' : 'left-0.5'}`}></div>
              </button>
            </div>
            <button onClick={resetProgress} className="bg-red-900/30 border border-red-500/50 text-red-500 font-bold py-3 rounded-xl w-full active:scale-95 transition-all">⚠️ Reset Progress</button>
          </div>
        </div>
      )}

      {showDailyModal && (
        <div className="absolute inset-0 z-50 bg-gray-950/95 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-md text-center">
          <div className="text-7xl mb-6 animate-bounce">🎁</div>
          <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest mb-4">Daily Bonus!</h2>
          <button onClick={claimDaily} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-black text-xl py-4 px-10 rounded-2xl w-full active:scale-95">Claim!</button>
        </div>
      )}

      {showLevelUp && justReachedLevel && (
        <div className="absolute inset-0 z-[70] bg-gray-950/90 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-lg text-center">
          <div className="text-8xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2">New Level!</h2>
          <p className="text-2xl text-yellow-400 font-bold mb-8">You are now <span className="uppercase text-3xl block mt-2">{levelNamesList[justReachedLevel - 1]}</span></p>
          <button onClick={() => setShowLevelUp(false)} className="bg-yellow-500 text-gray-900 font-black text-xl py-4 px-12 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.5)] active:scale-95 transition-all w-full">Continue!</button>
        </div>
      )}

      <style>{`
        @keyframes floatUp { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-100px) scale(1.5); } } 
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } 
        @keyframes flip-360 { 0% { transform: rotateY(0deg) scale(1); } 50% { transform: rotateY(180deg) scale(1.3); } 100% { transform: rotateY(360deg) scale(1); } }
        .animate-flip-360 { animation: flip-360 1s ease-in-out !important; }
        .animate-fade-in { animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; } 
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}

export default App;