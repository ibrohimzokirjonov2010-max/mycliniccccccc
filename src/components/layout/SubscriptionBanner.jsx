import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

/**
 * SubscriptionBanner Component
 * 
 * Shows a professional, non-intrusive warning when the clinic subscription is close to expiry.
 * Blocks access or restricts behavior if expired.
 */
export default function SubscriptionBanner() {
  const navigate = useNavigate();
  const [clinic, setClinic] = useState(null);
  const [daysLeft, setDaysLeft] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const clinics = await base44.clinic.getAll();
        const currentClinicId = localStorage.getItem('current_clinic_id');
        const currentClinic = clinics.find(c => c.id === currentClinicId);

        if (currentClinic && currentClinic.expires_at) {
          setClinic(currentClinic);
          const expiryDate = new Date(currentClinic.expires_at);
          const today = new Date();
          const diffTime = expiryDate - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          setDaysLeft(diffDays);

          if (diffDays <= 0) {
            setIsExpired(true);
            setIsVisible(true);
          } else if (diffDays <= 15) {
            setIsVisible(true);
          }
        }
      } catch (error) {
        console.error('Failed to check subscription:', error);
      }
    };

    checkSubscription();
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`mb-6 p-4 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl transition-all ${
          isExpired 
            ? 'bg-rose-50 border-rose-200 shadow-rose-500/5' 
            : 'bg-amber-50 border-amber-200 shadow-amber-500/5'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
            isExpired ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h4 className={`text-sm font-black uppercase tracking-tight ${isExpired ? 'text-rose-900' : 'text-amber-900'}`}>
              {isExpired ? "To'lov muddati tugagan" : "To'lov muddati yaqinlashmoqda"}
            </h4>
            <p className={`text-[11px] font-bold ${isExpired ? 'text-rose-600' : 'text-amber-700'}`}>
              {isExpired 
                ? "Tizimdan foydalanishni davom ettirish uchun to'lovni amalga oshiring." 
                : `Obuna muddati tugashiga ${daysLeft} kun qoldi. To'lovni o'z vaqtida amalga oshiring.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => window.open('https://t.me/dentist_shaxin', '_blank')}
            className={`h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
              isExpired 
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200' 
                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            To'lov qilish
          </Button>
          
          {!isExpired && (
            <button 
              onClick={() => setIsVisible(false)}
              className="p-3 hover:bg-black/5 rounded-xl text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
