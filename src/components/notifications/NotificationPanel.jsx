import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Trash2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { notificationStore } from '@/lib/notificationStore';

export default function NotificationPanel({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(() => {
    const data = notificationStore.getNotifications();
    setNotifications(data);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  useEffect(() => {
    window.addEventListener('notifications-updated', loadNotifications);
    return () => window.removeEventListener('notifications-updated', loadNotifications);
  }, [loadNotifications]);

  const handleClear = () => {
    notificationStore.clearAll();
  };

  const getTimeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.round((now - date) / 60000); // minutes
    
    if (diff < 1) return 'Hozirgina';
    if (diff < 60) return `${diff} daqiqa oldin`;
    const hours = Math.round(diff / 60);
    if (hours < 24) return `${hours} soat oldin`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[360px] bg-slate-50 shadow-2xl z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="bg-white p-5 border-b sticky top-0 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Bildirishnomalar</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Xabarlar tarixi</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleClear}
                  className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Barchasini tozalash"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={onClose}
                  className="p-2.5 rounded-xl bg-slate-100 text-slate-500 active:scale-90 transition-transform"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={n.id}
                    className={`bg-white rounded-[1.5rem] p-4 shadow-sm border border-slate-100 relative group transition-opacity ${
                      n.read ? 'opacity-60' : 'opacity-100'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        n.type === 'appointment' ? 'bg-blue-50 text-blue-600' :
                        n.type === 'recall' ? 'bg-pink-50 text-pink-600' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {n.type === 'appointment' ? <Clock className="w-5 h-5" /> :
                         n.type === 'recall' ? <AlertCircle className="w-5 h-5" /> :
                         <Bell className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-black text-slate-900 leading-tight truncate mr-2">{n.title}</h4>
                          {!n.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">{n.message}</p>
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2 block">
                          {getTimeAgo(n.time)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Bell className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Xabarlar yo'q</h3>
                  <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mt-2">Hozircha barchasi tinch</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-4 bg-white border-t">
                <button 
                  onClick={async () => {
                    notificationStore.markAllAsRead();
                    // Small delay to let user see the change before closing
                    setTimeout(onClose, 200);
                  }}
                  className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black tracking-tight shadow-xl shadow-slate-200 active:scale-[0.98] transition-all hover:bg-slate-800"
                >
                  O'qilgan deb belgilash
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
