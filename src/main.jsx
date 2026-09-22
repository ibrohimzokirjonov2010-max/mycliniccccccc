import '@/safeLocalStorage'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bootstrapTelegramBotConfig } from '@/lib/telegramBotConfig'
import { registerSW } from 'virtual:pwa-register'
import { registerAppUpdate } from '@/pwa/registerAppUpdate'

bootstrapTelegramBotConfig()
registerAppUpdate(registerSW)

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

