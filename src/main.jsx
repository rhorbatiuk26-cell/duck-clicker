import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Ініціалізуємо Telegram Mini App
const tg = window.Telegram.WebApp;
tg.expand(); // Розгортаємо на весь екран

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)