
import { useEffect, useState } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * NativePushManager - Handles browser-level push notifications
 * 
 * Features:
 * - Requests permission for native OS notifications
 * - Provides a visual UI for the user to enable alerts
 * - Mock/Local notification triggering
 */
export default function NativePushManager() {
  const [permission, setPermission] = useState('default');
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      
      // If not granted or denied, show prompt after a delay
      if (Notification.permission === 'default') {
        const timer = setTimeout(() => setShowPrompt(true), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setShowPrompt(false);
      
      if (result === 'granted') {
        // Send a welcome native notification
        new Notification('🔔 Bildirishnomalar yoqildi!', {
          body: 'Endi qabullar haqida to\'g\'ridan-to\'g\'ri telefoningizga xabar keladi.',
          icon: '/favicon.ico' // Should use the heart icon later
        });
      }
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 20, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex justify-center px-4 pointer-events-none"
        >
          <div className="bg-white/90 backdrop-blur-xl border border-white shadow-2xl rounded-[2rem] p-4 flex items-center gap-4 max-w-sm pointer-events-auto">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 animate-pulse">
              <Bell className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Eslatmalarni oling</p>
              <p className="text-[10px] text-slate-500 font-medium">Qabullarni o'tkazib yubormaslik uchun bildirishnomalarni yoqing.</p>
            </div>
            <div className="flex flex-col gap-1">
              <button 
                onClick={requestPermission}
                className="bg-slate-900 text-white p-2 rounded-xl hover:bg-slate-800 transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowPrompt(false)}
                className="bg-slate-100 text-slate-400 p-2 rounded-xl hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Universal helper to send a native notification
 */
export const sendNativeNotification = (title, body, icon) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: icon || '/heart-icon.png'
    });
    return true;
  }
  return false;
};
