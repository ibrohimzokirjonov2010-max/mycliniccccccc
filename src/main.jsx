import '@/safeLocalStorage'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bootstrapTelegramBotConfig } from '@/lib/telegramBotConfig'
import { listenForAppUpdates } from '@/lib/swUpdate'

bootstrapTelegramBotConfig()
listenForAppUpdates()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
