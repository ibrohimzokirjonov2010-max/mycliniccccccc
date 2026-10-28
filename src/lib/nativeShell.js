// Native (Capacitor) shell setup. No-op on the web.
import { Capacitor } from '@capacitor/core'

export async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return
  document.documentElement.classList.add('native-app')
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#1499AD' })
      await StatusBar.setOverlaysWebView({ overlay: false })
    }
  } catch { /* ignore */ }
  try {
    const { App } = await import('@capacitor/app')
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.location.pathname !== '/' && window.location.pathname !== '/login') window.history.back()
      else App.exitApp()
    })
  } catch { /* ignore */ }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    setTimeout(() => SplashScreen.hide(), 300)
  } catch { /* ignore */ }
}
