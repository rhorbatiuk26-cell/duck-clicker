import { useState, useEffect } from 'react'

function App() {
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const user = window.Telegram.WebApp.initDataUnsafe?.user;

  // Логіка тапу
  const handleTap = () => {
    setPoints(prev => prev + 1);
    // Проста вібрація при тапі (працює на телефонах)
    window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
  };

  // Перевірка рівня (дуже базова логіка еволюції)
  useEffect(() => {
    if (points >= 100 && level === 1) setLevel(2);
    if (points >= 500 && level === 2) setLevel(3);
  }, [points, level]);

  return (
    <div className="flex flex-col items-center justify-between h-screen py-8 px-4">
      {/* Шапка */}
      <div className="text-center w-full">
        <h1 className="text-2xl font-bold mb-2">
          Привіт, {user?.first_name || 'Гравець'}! 👋
        </h1>
        <div className="bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-700">
          <p className="text-gray-400 text-sm uppercase tracking-wider">Твій баланс</p>
          <p className="text-5xl font-black text-yellow-400 mt-1">{points} <span className="text-2xl">💰</span></p>
        </div>
      </div>

      {/* Зона кліку з Качкою */}
      <div 
        className="relative active:scale-95 transition-transform duration-100 cursor-pointer flex-1 flex items-center justify-center"
        onClick={handleTap}
      >
        <div className="absolute bg-yellow-500/20 w-64 h-64 rounded-full blur-3xl -z-10"></div>
        {/* Тут посилання на картинку качки-бродяги. Потім замінимо на твої згенеровані. */}
        <img 
          src="https://cdn.midjourney.com/f98ea76f-24ec-4f4f-b8b4-0b1a0e1c0c1b/0_1.webp" 
          alt="Duck Mascot" 
          className="w-64 h-64 object-contain drop-shadow-2xl"
          draggable="false"
        />
      </div>

      {/* Низ: Прогрес бар та Рівень */}
      <div className="w-full bg-gray-800 p-4 rounded-t-3xl border-t border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-gray-300">Рівень {level}</span>
          <span className="text-sm text-gray-500">{level === 1 ? 'Бродяга' : 'Розвивається...'}</span>
        </div>
        <div className="w-full bg-gray-900 rounded-full h-4">
          <div 
            className="bg-yellow-400 h-4 rounded-full transition-all duration-300" 
            style={{ width: `${Math.min((points % 100) / 100 * 100, 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  )
}

export default App