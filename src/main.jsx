import '@/safeLocalStorage'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bootstrapTelegramBotConfig } from '@/lib/telegramBotConfig'
import { listenForAppUpdates } from '@/lib/swUpdate'
import { initNativeShell } from '@/lib/nativeShell'

bootstrapTelegramBotConfig()
listenForAppUpdates()
initNativeShell()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
